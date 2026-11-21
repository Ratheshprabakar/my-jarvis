"""
Dashboard REST endpoints — the frontend polls or fetches these on load.
"""
from __future__ import annotations
import logging
from fastapi import APIRouter, Depends
from store import store
from config import get_settings, Settings
import google_calendar as gcal

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/")
async def get_dashboard(s: Settings = Depends(get_settings)):
    """Return full dashboard data: tasks, meetings, activity."""
    meetings = []
    google = {
        "configured": gcal.is_configured(),
        "connected": False,
        "email": None,
        "connect_url": "/api/google/connect" if gcal.is_configured() else None,
    }

    if gcal.is_connected():
        try:
            live = gcal.list_events(upcoming_only=False)
            store.replace_meetings(live)
            meetings = [m.model_dump() for m in live]
            google["connected"] = True
            google["email"] = gcal.get_account_email()
        except Exception as exc:
            log.warning("Dashboard Google Calendar fetch failed: %s", exc)
            meetings = [m.model_dump() for m in store.get_meetings()]
            google["connected"] = True
            google["error"] = str(exc)
    else:
        meetings = []

    return {
        "employee": {
            "name": s.demo_employee_name,
            "role": s.demo_employee_role,
            "team": s.demo_employee_team,
        },
        "tasks": [t.model_dump() for t in store.get_tasks()],
        "meetings": meetings,
        "activity": store.get_activity(30),
        "google_calendar": google,
    }


@router.get("/tasks")
async def get_tasks(status: str = "all"):
    return [t.model_dump() for t in store.get_tasks(status)]


@router.get("/meetings")
async def get_meetings(upcoming_only: bool = False):
    if gcal.is_connected():
        try:
            return [m.model_dump() for m in gcal.list_events(upcoming_only=upcoming_only)]
        except Exception as exc:
            log.warning("meetings fetch failed: %s", exc)
    return [m.model_dump() for m in store.get_meetings(upcoming_only)]


@router.get("/activity")
async def get_activity(limit: int = 20):
    return store.get_activity(limit)
