"""
Google Calendar OAuth + webhook routes.
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from config import get_settings, Settings
import google_calendar as gcal
from store import store
from models import WSEvent
from routes.ws import broadcast

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/google", tags=["google-calendar"])


@router.get("/status")
async def google_status(s: Settings = Depends(get_settings)):
    configured = gcal.is_configured()
    connected = configured and gcal.is_connected()
    email = None
    if connected:
        try:
            email = gcal.get_account_email()
        except Exception:
            email = None
    return {
        "configured": configured,
        "connected": connected,
        "email": email,
        "calendar_id": s.google_calendar_id,
        "connect_url": "/api/google/connect" if configured else None,
    }


@router.get("/connect")
async def google_connect(s: Settings = Depends(get_settings)):
    if not gcal.is_configured():
        raise HTTPException(
            status_code=400,
            detail="Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.",
        )
    try:
        url = gcal.build_auth_url()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return RedirectResponse(url)


@router.get("/callback")
async def google_callback(code: str = "", error: str = "", state: str = ""):
    if error:
        return HTMLResponse(
            f"<h2>Google auth failed</h2><p>{error}</p>",
            status_code=400,
        )
    if not code:
        raise HTTPException(status_code=400, detail="Missing code")
    try:
        gcal.exchange_code(code, state=state or None)
        # Sync meetings into store + try watch webhook
        meetings = gcal.list_events(upcoming_only=False)
        store.replace_meetings(meetings)
        s = get_settings()
        watch_note = ""
        webhook = s.backend_public_url.rstrip("/") + "/api/google/webhook"
        if webhook.startswith("https://"):
            try:
                gcal.start_watch(webhook)
                watch_note = "<p>Push notifications enabled for real-time sync.</p>"
            except Exception as exc:
                watch_note = f"<p>Watch not enabled ({exc}). Manual/tool updates still push live.</p>"
        else:
            watch_note = (
                "<p>Set BACKEND_PUBLIC_URL to an https ngrok URL to enable Google push sync.</p>"
            )
        email = gcal.get_account_email() or "connected"
        return HTMLResponse(
            f"""
            <html><body style="font-family:system-ui;background:#09090b;color:#f4f4f5;padding:2rem">
              <h2>Google Calendar connected</h2>
              <p>Account: <strong>{email}</strong></p>
              <p>Loaded {len(meetings)} events.</p>
              {watch_note}
              <p><a href="http://localhost:5173" style="color:#38bdf8">Back to WorkplaceAI</a></p>
              <script>setTimeout(() => window.close(), 2500)</script>
            </body></html>
            """
        )
    except Exception as exc:
        log.exception("OAuth callback failed")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/sync")
async def google_sync():
    """Pull latest events from Google and broadcast to the UI."""
    if not gcal.is_connected():
        raise HTTPException(status_code=400, detail="Google Calendar not connected")
    try:
        meetings = gcal.list_events(upcoming_only=False)
        store.replace_meetings(meetings)
        event = WSEvent(
            type="calendar_synced",
            payload={"count": len(meetings), "meetings": [m.model_dump() for m in meetings]},
        )
        await broadcast(event.model_dump_json())
        return {"status": "ok", "count": len(meetings), "meetings": [m.model_dump() for m in meetings]}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/webhook")
async def google_webhook(request: Request):
    """
    Google Calendar push notification receiver.
    Headers: X-Goog-Channel-ID, X-Goog-Resource-State, …
    """
    state = request.headers.get("X-Goog-Resource-State", "")
    log.info("Google webhook: state=%s channel=%s", state, request.headers.get("X-Goog-Channel-ID"))
    if state in ("exists", "sync", "update"):
        try:
            if gcal.is_connected():
                meetings = gcal.list_events(upcoming_only=False)
                store.replace_meetings(meetings)
                event = WSEvent(
                    type="calendar_synced",
                    payload={
                        "count": len(meetings),
                        "meetings": [m.model_dump() for m in meetings],
                        "source": "webhook",
                    },
                )
                await broadcast(event.model_dump_json())
        except Exception as exc:
            log.error("Webhook sync failed: %s", exc)
    return {"status": "ok"}


@router.post("/disconnect")
async def google_disconnect():
    try:
        gcal.stop_watch()
    except Exception:
        pass
    gcal.TOKEN_PATH.unlink(missing_ok=True)
    store.replace_meetings([])
    return {"status": "disconnected"}
