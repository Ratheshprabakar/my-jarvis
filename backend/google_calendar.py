"""
Google Calendar client — OAuth2 + Calendar API v3.

Token storage: backend/data/google_token.json (created by /api/google/callback).
Optional bootstrap: GOOGLE_REFRESH_TOKEN in .env (with client id/secret).
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from config import get_settings
from models import Meeting

log = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/calendar"]
TOKEN_PATH = Path(__file__).resolve().parent / "data" / "google_token.json"
OAUTH_PENDING_PATH = Path(__file__).resolve().parent / "data" / "oauth_pending.json"
# Watch channel state (for push notifications)
_WATCH_STATE: dict[str, Any] = {}


def _client_config() -> dict:
    s = get_settings()
    if not s.google_client_id or not s.google_client_secret:
        raise RuntimeError(
            "Google Calendar is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
        )
    return {
        "web": {
            "client_id": s.google_client_id,
            "client_secret": s.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [s.google_redirect_uri],
        }
    }


def is_configured() -> bool:
    s = get_settings()
    return bool(s.google_client_id and s.google_client_secret)


def is_connected() -> bool:
    if TOKEN_PATH.exists():
        return True
    s = get_settings()
    return bool(s.google_refresh_token)


def _save_creds(creds: Credentials) -> None:
    TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")


def get_credentials() -> Credentials:
    """Load and refresh OAuth credentials."""
    s = get_settings()
    creds: Optional[Credentials] = None

    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
    elif s.google_refresh_token:
        creds = Credentials(
            token=None,
            refresh_token=s.google_refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=s.google_client_id,
            client_secret=s.google_client_secret,
            scopes=SCOPES,
        )

    if not creds:
        raise RuntimeError("Google Calendar not connected. Visit /api/google/connect")

    if not creds.valid:
        if creds.refresh_token:
            creds.refresh(Request())
            _save_creds(creds)
        else:
            raise RuntimeError("Google credentials expired. Reconnect via /api/google/connect")

    return creds


def build_auth_url(state: str = "workplace-ai") -> str:
    """Start OAuth and persist PKCE code_verifier for the callback."""
    flow = Flow.from_client_config(
        _client_config(),
        scopes=SCOPES,
        redirect_uri=get_settings().google_redirect_uri,
        autogenerate_code_verifier=True,
    )
    url, flow_state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state,
    )
    # Callback creates a new Flow — without this verifier Google returns invalid_grant
    OAUTH_PENDING_PATH.parent.mkdir(parents=True, exist_ok=True)
    OAUTH_PENDING_PATH.write_text(
        json.dumps(
            {
                "state": flow_state,
                "code_verifier": flow.code_verifier,
            }
        ),
        encoding="utf-8",
    )
    return url


def exchange_code(code: str, state: str | None = None) -> Credentials:
    """Finish OAuth using the PKCE verifier saved during build_auth_url."""
    if not OAUTH_PENDING_PATH.exists():
        raise RuntimeError(
            "OAuth session expired. Start again from /api/google/connect"
        )
    pending = json.loads(OAUTH_PENDING_PATH.read_text(encoding="utf-8"))
    if state and pending.get("state") and state != pending["state"]:
        raise RuntimeError("OAuth state mismatch. Start again from /api/google/connect")

    flow = Flow.from_client_config(
        _client_config(),
        scopes=SCOPES,
        redirect_uri=get_settings().google_redirect_uri,
        autogenerate_code_verifier=False,
    )
    flow.code_verifier = pending["code_verifier"]
    flow.fetch_token(code=code)
    creds = flow.credentials
    _save_creds(creds)
    OAUTH_PENDING_PATH.unlink(missing_ok=True)
    return creds


def _service():
    return build("calendar", "v3", credentials=get_credentials(), cache_discovery=False)


def _parse_event_dt(event: dict, key: str) -> str:
    block = event.get(key) or {}
    if "dateTime" in block:
        return block["dateTime"]
    if "date" in block:
        # All-day → treat as midnight local ISO
        return f"{block['date']}T00:00:00"
    return datetime.now(timezone.utc).isoformat()


def event_to_meeting(event: dict) -> Meeting:
    attendees = [
        (a.get("email") or a.get("displayName") or "")
        for a in (event.get("attendees") or [])
        if a.get("email") or a.get("displayName")
    ]
    status_map = {
        "confirmed": "scheduled",
        "tentative": "scheduled",
        "cancelled": "cancelled",
    }
    loc = event.get("location") or ""
    if not loc and event.get("hangoutLink"):
        loc = event["hangoutLink"]
    elif not loc and (event.get("conferenceData") or {}).get("entryPoints"):
        loc = event["conferenceData"]["entryPoints"][0].get("uri", "Google Meet")

    return Meeting(
        id=event.get("id", ""),
        title=event.get("summary") or "(No title)",
        description=event.get("description") or "",
        start_time=_parse_event_dt(event, "start"),
        end_time=_parse_event_dt(event, "end"),
        attendees=attendees,
        location=loc or "Google Calendar",
        organizer=(event.get("organizer") or {}).get("email", ""),
        status=status_map.get(event.get("status", "confirmed"), "scheduled"),  # type: ignore[arg-type]
        html_link=event.get("htmlLink"),
        hangout_link=event.get("hangoutLink"),
    )


def _to_rfc3339(value: str) -> str:
    """Normalize ISO-ish strings to RFC3339 for Google Calendar."""
    v = value.strip()
    if v.endswith("Z") or "+" in v[10:] or (len(v) > 19 and v[19] == "-"):
        return v
    # Naive local → assume Asia/Kolkata offset from settings? Use Z-less with local tz name
    # Google accepts local without Z if timeZone is set separately; for dateTime alone add offset.
    try:
        dt = datetime.fromisoformat(v)
        if dt.tzinfo is None:
            # Attach configured timezone as fixed offset via zoneinfo if available
            from zoneinfo import ZoneInfo
            tz = ZoneInfo(get_settings().google_calendar_timezone)
            dt = dt.replace(tzinfo=tz)
        return dt.isoformat()
    except Exception:
        return v


def list_events(
    upcoming_only: bool = True,
    max_results: int = 50,
    days_ahead: int = 30,
) -> list[Meeting]:
    svc = _service()
    s = get_settings()
    now = datetime.now(timezone.utc)
    params: dict[str, Any] = {
        "calendarId": s.google_calendar_id,
        "maxResults": max_results,
        "singleEvents": True,
        "orderBy": "startTime",
    }
    if upcoming_only:
        params["timeMin"] = now.isoformat()
        params["timeMax"] = (now + timedelta(days=days_ahead)).isoformat()
    else:
        params["timeMin"] = (now - timedelta(days=7)).isoformat()
        params["timeMax"] = (now + timedelta(days=days_ahead)).isoformat()

    result = svc.events().list(**params).execute()
    meetings = [event_to_meeting(e) for e in result.get("items", [])]
    return [m for m in meetings if m.status != "cancelled"]


def create_event(
    title: str,
    start_time: str,
    end_time: str,
    description: str = "",
    attendees: Optional[list[str]] = None,
    location: str = "",
    add_meet: bool = True,
) -> Meeting:
    svc = _service()
    s = get_settings()
    body: dict[str, Any] = {
        "summary": title,
        "description": description,
        "start": {
            "dateTime": _to_rfc3339(start_time),
            "timeZone": s.google_calendar_timezone,
        },
        "end": {
            "dateTime": _to_rfc3339(end_time),
            "timeZone": s.google_calendar_timezone,
        },
    }
    if location:
        body["location"] = location
    emails = [e.strip() for e in (attendees or []) if e and "@" in e.strip()]
    if emails:
        body["attendees"] = [{"email": e} for e in emails]
    if add_meet:
        body["conferenceData"] = {
            "createRequest": {
                "requestId": f"wa-{int(datetime.now().timestamp())}",
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        }

    event = (
        svc.events()
        .insert(
            calendarId=s.google_calendar_id,
            body=body,
            conferenceDataVersion=1 if add_meet else 0,
            sendUpdates="all" if emails else "none",
        )
        .execute()
    )
    return event_to_meeting(event)


def update_event(
    event_id: str,
    *,
    title: Optional[str] = None,
    description: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    location: Optional[str] = None,
    attendees: Optional[list[str]] = None,
    merge_attendees: bool = False,
) -> Meeting:
    svc = _service()
    s = get_settings()
    existing = svc.events().get(calendarId=s.google_calendar_id, eventId=event_id).execute()

    if title is not None:
        existing["summary"] = title
    if description is not None:
        existing["description"] = description
    if location is not None:
        existing["location"] = location
    if start_time is not None:
        existing["start"] = {
            "dateTime": _to_rfc3339(start_time),
            "timeZone": s.google_calendar_timezone,
        }
    if end_time is not None:
        existing["end"] = {
            "dateTime": _to_rfc3339(end_time),
            "timeZone": s.google_calendar_timezone,
        }
    if attendees is not None:
        emails = [e.strip() for e in attendees if e and "@" in e.strip()]
        if merge_attendees:
            current = {
                (a.get("email") or "").lower()
                for a in (existing.get("attendees") or [])
                if a.get("email")
            }
            for e in emails:
                current.add(e.lower())
            existing["attendees"] = [{"email": e} for e in sorted(current) if e]
        else:
            existing["attendees"] = [{"email": e} for e in emails]

    event = (
        svc.events()
        .patch(
            calendarId=s.google_calendar_id,
            eventId=event_id,
            body=existing,
            sendUpdates="all",
        )
        .execute()
    )
    return event_to_meeting(event)


def delete_event(event_id: str) -> None:
    svc = _service()
    s = get_settings()
    svc.events().delete(
        calendarId=s.google_calendar_id,
        eventId=event_id,
        sendUpdates="all",
    ).execute()


def get_account_email() -> Optional[str]:
    try:
        svc = _service()
        acl = svc.calendarList().get(calendarId="primary").execute()
        return acl.get("id") or acl.get("summary")
    except Exception as exc:
        log.warning("Could not fetch calendar account: %s", exc)
        return None


def start_watch(webhook_url: str) -> dict:
    """Register a push notification channel for calendar changes."""
    svc = _service()
    s = get_settings()
    import uuid

    body = {
        "id": str(uuid.uuid4()),
        "type": "web_hook",
        "address": webhook_url,
    }
    # Channel expires ~7 days max for Calendar API; renew as needed
    result = (
        svc.events()
        .watch(calendarId=s.google_calendar_id, body=body)
        .execute()
    )
    _WATCH_STATE.clear()
    _WATCH_STATE.update(result)
    TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    (TOKEN_PATH.parent / "google_watch.json").write_text(
        json.dumps(result, indent=2), encoding="utf-8"
    )
    return result


def stop_watch() -> None:
    if not _WATCH_STATE and not (TOKEN_PATH.parent / "google_watch.json").exists():
        return
    data = _WATCH_STATE or json.loads(
        (TOKEN_PATH.parent / "google_watch.json").read_text(encoding="utf-8")
    )
    try:
        svc = _service()
        svc.channels().stop(
            body={"id": data["id"], "resourceId": data["resourceId"]}
        ).execute()
    except Exception as exc:
        log.warning("Stop watch failed: %s", exc)
    (TOKEN_PATH.parent / "google_watch.json").unlink(missing_ok=True)
    _WATCH_STATE.clear()
