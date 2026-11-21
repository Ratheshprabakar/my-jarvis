"""
Tool execution endpoints called by the Agora Conversational AI agent.

Agora POSTs to these endpoints when the LLM decides to call a tool.
Each endpoint performs the action against the in-memory store,
broadcasts a WebSocket event to the frontend, and returns the result
as a JSON string that is fed back to the LLM.
"""
from __future__ import annotations
import json
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Request

from models import Task, WSEvent
from store import store
from knowledge_base import search_knowledge_base
from routes.ws import broadcast

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tools", tags=["tools"])


def _ok(data: dict | list | str) -> dict:
    """Wrap a successful tool result."""
    return {"success": True, "result": data}


def _err(msg: str) -> dict:
    return {"success": False, "error": msg}


async def _emit(event_type: str, payload: dict):
    """Broadcast a WebSocket event to all connected frontend clients."""
    event = WSEvent(type=event_type, payload=payload)  # type: ignore[arg-type]
    await broadcast(event.model_dump_json())


# ── Task tools ─────────────────────────────────────────────────────────────

@router.post("/tasks/list")
async def tool_list_tasks(request: Request):
    """Return the employee's tasks (optionally filtered by status)."""
    body = await request.json()
    args = body.get("arguments", body)
    status = args.get("status", "all")

    tasks = store.get_tasks(status)
    result = [t.model_dump() for t in tasks]

    await _emit("tool_called", {"tool": "get_my_tasks", "args": {"status": status}})
    log.info("[tool] get_my_tasks → %d tasks", len(result))
    return _ok(result)


@router.post("/tasks/create")
async def tool_create_task(request: Request):
    """Create a new task."""
    body = await request.json()
    args = body.get("arguments", body)

    from config import get_settings
    s = get_settings()

    task = Task(
        title=args.get("title", "Untitled Task"),
        description=args.get("description", ""),
        priority=args.get("priority", "medium"),
        assignee=s.demo_employee_name,
        due_date=args.get("due_date"),
        tags=args.get("tags", []),
    )
    created = store.create_task(task)

    await _emit("task_created", created.model_dump())
    log.info("[tool] create_task → %s", created.id)
    return _ok({
        "task_id": created.id,
        "title": created.title,
        "priority": created.priority,
        "status": created.status,
        "message": f"Task {created.id} created successfully.",
    })


@router.post("/tasks/update")
async def tool_update_task(request: Request):
    """Update an existing task."""
    body = await request.json()
    args = body.get("arguments", body)

    task_id = args.get("task_id", "")
    updates = {k: v for k, v in args.items() if k != "task_id"}

    task = store.update_task(task_id, updates)
    if not task:
        return _err(f"Task {task_id} not found.")

    await _emit("task_updated", task.model_dump())
    log.info("[tool] update_task → %s %s", task.id, updates)
    return _ok({
        "task_id": task.id,
        "title": task.title,
        "status": task.status,
        "message": f"Task {task.id} updated successfully.",
    })


# ── Calendar tools (Google Calendar) ───────────────────────────────────────

def _parse_attendees(raw) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(x).strip() for x in raw if str(x).strip()]
    # Comma / semicolon separated emails or names
    return [p.strip() for p in str(raw).replace(";", ",").split(",") if p.strip()]


@router.post("/calendar/list")
async def tool_list_calendar(request: Request):
    """Return meetings from Google Calendar (falls back to empty if disconnected)."""
    import google_calendar as gcal

    body = await request.json()
    args = body.get("arguments", body)
    upcoming_only = args.get("upcoming_only", True)
    if isinstance(upcoming_only, str):
        upcoming_only = upcoming_only.lower() in ("1", "true", "yes")

    await _emit("tool_called", {"tool": "get_calendar", "args": {"upcoming_only": upcoming_only}})

    if not gcal.is_connected():
        return _err("Google Calendar is not connected. Open /api/google/connect in the browser.")

    try:
        meetings = gcal.list_events(upcoming_only=upcoming_only)
        store.replace_meetings(meetings)
        result = [m.model_dump() for m in meetings]
        log.info("[tool] get_calendar → %d meetings", len(result))
        return _ok(result)
    except Exception as exc:
        log.error("get_calendar failed: %s", exc)
        return _err(f"Google Calendar error: {exc}")


@router.post("/calendar/schedule")
async def tool_schedule_meeting(request: Request):
    """Create a Google Calendar event (+ optional Meet link + invites)."""
    import google_calendar as gcal

    body = await request.json()
    args = body.get("arguments", body)

    if not gcal.is_connected():
        return _err("Google Calendar is not connected. Open /api/google/connect first.")

    start_time = args.get("start_time") or (
        datetime.now().replace(hour=14, minute=0, second=0, microsecond=0) + timedelta(days=1)
    ).isoformat()
    end_time = args.get("end_time")
    if not end_time:
        try:
            end_time = (datetime.fromisoformat(str(start_time).replace("Z", "+00:00")) + timedelta(hours=1)).isoformat()
        except Exception:
            end_time = (datetime.now() + timedelta(days=1, hours=15)).isoformat()

    attendees = _parse_attendees(args.get("attendees", args.get("attendee_emails", "")))
    title = args.get("title", "Team Meeting")

    try:
        created = gcal.create_event(
            title=title,
            start_time=str(start_time),
            end_time=str(end_time),
            description=args.get("description", ""),
            attendees=attendees,
            location=args.get("location", ""),
            add_meet=True,
        )
        store.create_meeting(created)
        await _emit("meeting_scheduled", created.model_dump())
        log.info("[tool] schedule_meeting → %s", created.id)
        return _ok({
            "meeting_id": created.id,
            "title": created.title,
            "start_time": created.start_time,
            "end_time": created.end_time,
            "attendees": created.attendees,
            "html_link": created.html_link,
            "hangout_link": created.hangout_link,
            "message": f"Scheduled '{created.title}' on Google Calendar and sent invites.",
        })
    except Exception as exc:
        log.error("schedule_meeting failed: %s", exc)
        return _err(f"Failed to schedule meeting: {exc}")


@router.post("/calendar/reschedule")
async def tool_reschedule_meeting(request: Request):
    """Move / reschedule an existing Google Calendar event."""
    import google_calendar as gcal

    body = await request.json()
    args = body.get("arguments", body)
    meeting_id = args.get("meeting_id") or args.get("event_id")
    start_time = args.get("start_time")
    end_time = args.get("end_time")

    if not meeting_id or not start_time or not end_time:
        return _err("meeting_id, start_time, and end_time are required.")
    if not gcal.is_connected():
        return _err("Google Calendar is not connected.")

    try:
        updated = gcal.update_event(
            meeting_id,
            start_time=str(start_time),
            end_time=str(end_time),
            title=args.get("title"),
        )
        store.upsert_meeting(updated)
        await _emit("meeting_updated", updated.model_dump())
        log.info("[tool] reschedule_meeting → %s", updated.id)
        return _ok({
            "meeting_id": updated.id,
            "title": updated.title,
            "start_time": updated.start_time,
            "end_time": updated.end_time,
            "message": f"Rescheduled '{updated.title}'.",
        })
    except Exception as exc:
        log.error("reschedule failed: %s", exc)
        return _err(f"Failed to reschedule: {exc}")


@router.post("/calendar/update")
async def tool_update_meeting(request: Request):
    """Update title/description/location of a meeting."""
    import google_calendar as gcal

    body = await request.json()
    args = body.get("arguments", body)
    meeting_id = args.get("meeting_id") or args.get("event_id")
    if not meeting_id:
        return _err("meeting_id is required.")
    if not gcal.is_connected():
        return _err("Google Calendar is not connected.")

    try:
        updated = gcal.update_event(
            meeting_id,
            title=args.get("title"),
            description=args.get("description"),
            location=args.get("location"),
        )
        store.upsert_meeting(updated)
        await _emit("meeting_updated", updated.model_dump())
        return _ok({
            "meeting_id": updated.id,
            "title": updated.title,
            "message": f"Updated '{updated.title}'.",
        })
    except Exception as exc:
        return _err(f"Failed to update meeting: {exc}")


@router.post("/calendar/invite")
async def tool_invite_attendees(request: Request):
    """Add one or more attendees (email invites) to an existing meeting."""
    import google_calendar as gcal

    body = await request.json()
    args = body.get("arguments", body)
    meeting_id = args.get("meeting_id") or args.get("event_id")
    attendees = _parse_attendees(args.get("attendees", args.get("attendee_emails", "")))

    if not meeting_id or not attendees:
        return _err("meeting_id and attendees (comma-separated emails) are required.")
    if not gcal.is_connected():
        return _err("Google Calendar is not connected.")

    try:
        updated = gcal.update_event(
            meeting_id,
            attendees=attendees,
            merge_attendees=True,
        )
        store.upsert_meeting(updated)
        await _emit("meeting_updated", updated.model_dump())
        log.info("[tool] invite → %s + %s", meeting_id, attendees)
        return _ok({
            "meeting_id": updated.id,
            "title": updated.title,
            "attendees": updated.attendees,
            "message": f"Invited {', '.join(attendees)} to '{updated.title}'.",
        })
    except Exception as exc:
        return _err(f"Failed to invite: {exc}")


@router.post("/calendar/delete")
async def tool_delete_meeting(request: Request):
    """Cancel / delete a Google Calendar event."""
    import google_calendar as gcal

    body = await request.json()
    args = body.get("arguments", body)
    meeting_id = args.get("meeting_id") or args.get("event_id")
    if not meeting_id:
        return _err("meeting_id is required.")
    if not gcal.is_connected():
        return _err("Google Calendar is not connected.")

    try:
        # Capture title before delete for UI
        title = next((m.title for m in store.get_meetings() if m.id == meeting_id), meeting_id)
        gcal.delete_event(meeting_id)
        store.remove_meeting(meeting_id)
        await _emit("meeting_deleted", {"id": meeting_id, "title": title})
        log.info("[tool] delete_meeting → %s", meeting_id)
        return _ok({
            "meeting_id": meeting_id,
            "message": f"Deleted meeting '{title}'. Guests were notified.",
        })
    except Exception as exc:
        return _err(f"Failed to delete meeting: {exc}")


# ── Knowledge base tool ────────────────────────────────────────────────────

@router.post("/knowledge/search")
async def tool_search_knowledge(request: Request):
    """Search the company knowledge base."""
    body = await request.json()
    args = body.get("arguments", body)
    query = args.get("query", "")

    if not query:
        return _err("Query is required.")

    results = search_knowledge_base(query)
    await _emit("knowledge_queried", {"query": query, "results_count": len(results)})
    log.info("[tool] search_knowledge_base → query='%s' → %d results", query, len(results))

    if not results:
        return _ok("No relevant articles found in the knowledge base.")

    # Format for LLM consumption
    formatted = "\n\n---\n\n".join(
        f"**{r['title']}** ({r['category']})\n{r['content']}"
        for r in results
    )
    return _ok(formatted)


# ── Daily briefing tool ────────────────────────────────────────────────────

@router.post("/briefing")
async def tool_daily_briefing(request: Request):
    """Generate a daily briefing."""
    from config import get_settings
    s = get_settings()
    now = datetime.now()

    pending_tasks = store.get_tasks("pending")
    in_progress = store.get_tasks("in_progress")
    critical = [t for t in pending_tasks + in_progress if t.priority == "critical"]

    import google_calendar as gcal
    if gcal.is_connected():
        try:
            upcoming = gcal.list_events(upcoming_only=True)
            store.replace_meetings(upcoming)
        except Exception:
            upcoming = store.get_meetings(upcoming_only=True)
    else:
        upcoming = store.get_meetings(upcoming_only=True)

    def _safe_date(iso: str):
        try:
            return datetime.fromisoformat(iso.replace("Z", "+00:00")).date()
        except Exception:
            return None

    today_meetings = [m for m in upcoming if _safe_date(m.start_time) == now.date()]

    briefing = {
        "employee": s.demo_employee_name,
        "date": now.strftime("%A, %B %d %Y"),
        "critical_tasks": [{"id": t.id, "title": t.title} for t in critical],
        "pending_tasks_count": len(pending_tasks),
        "in_progress_tasks_count": len(in_progress),
        "todays_meetings": [
            {
                "id": m.id,
                "title": m.title,
                "time": datetime.fromisoformat(m.start_time).strftime("%I:%M %p"),
            }
            for m in today_meetings
        ],
        "summary": (
            f"Good morning, {s.demo_employee_name}! "
            f"You have {len(pending_tasks)} pending tasks "
            f"({len(critical)} critical), "
            f"{len(in_progress)} in progress, "
            f"and {len(today_meetings)} meeting(s) today."
        ),
    }

    await _emit("briefing_generated", briefing)
    log.info("[tool] get_daily_briefing")
    return _ok(briefing)


# ── Notification tool ──────────────────────────────────────────────────────

@router.post("/notifications/send")
async def tool_send_notification(request: Request):
    """Mock sending a notification/Slack message."""
    body = await request.json()
    args = body.get("arguments", body)

    recipient = args.get("recipient", "Unknown")
    message = args.get("message", "")
    channel = args.get("channel", None)

    destination = channel if channel else f"DM to {recipient}"

    await _emit("notification_sent", {
        "recipient": recipient,
        "message": message,
        "channel": channel,
        "destination": destination,
    })
    log.info("[tool] send_notification → %s: %s", destination, message[:60])

    return _ok({
        "status": "sent",
        "destination": destination,
        "message": f"Notification sent to {destination}.",
    })
