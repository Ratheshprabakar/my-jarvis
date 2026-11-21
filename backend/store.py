"""
In-memory data store for the demo.
Provides seed data for tasks, meetings, and employees,
and allows live mutation so the UI reflects changes in real time.
"""
from __future__ import annotations
from datetime import datetime, timedelta
from models import Task, Meeting
from typing import Optional
import json
import asyncio

# ── Seed data helpers ──────────────────────────────────────────────────────

def _dt(days: int = 0, hour: int = 10, minute: int = 0) -> str:
    base = datetime.now().replace(hour=hour, minute=minute, second=0, microsecond=0)
    return (base + timedelta(days=days)).isoformat()


# ── Tasks ──────────────────────────────────────────────────────────────────

_TASKS: list[Task] = [
    Task(
        id="TASK-001",
        title="Fix payment gateway timeout in checkout service",
        description="Users are experiencing 504 errors during peak traffic. Need to investigate and patch the retry logic.",
        status="in_progress",
        priority="critical",
        assignee="Alex Johnson",
        due_date=_dt(0),
        tags=["backend", "payments", "production"],
    ),
    Task(
        id="TASK-002",
        title="Code review: Auth microservice PR #247",
        description="Review OAuth2 token refresh implementation added by James.",
        status="pending",
        priority="high",
        assignee="Alex Johnson",
        due_date=_dt(1),
        tags=["review", "auth"],
    ),
    Task(
        id="TASK-003",
        title="Update internal API documentation",
        description="Reflect the new endpoints added in v2.3 release. Swagger + Confluence pages.",
        status="pending",
        priority="medium",
        assignee="Alex Johnson",
        due_date=_dt(3),
        tags=["docs"],
    ),
    Task(
        id="TASK-004",
        title="Set up monitoring dashboards for new microservices",
        description="Datadog dashboards for order-service and inventory-service.",
        status="pending",
        priority="medium",
        assignee="Alex Johnson",
        due_date=_dt(5),
        tags=["devops", "monitoring"],
    ),
]


# ── Mutable runtime state ──────────────────────────────────────────────────

class DataStore:
    def __init__(self):
        self.tasks: list[Task] = list(_TASKS)
        # Meetings come from Google Calendar — no mock invites
        self.meetings: list[Meeting] = []
        self.activity_log: list[dict] = []

    # ── Tasks ──────────────────────────────────────────────────────────────

    def get_tasks(self, status: Optional[str] = None) -> list[Task]:
        if status and status != "all":
            return [t for t in self.tasks if t.status == status]
        return self.tasks

    def get_task(self, task_id: str) -> Optional[Task]:
        return next((t for t in self.tasks if t.id == task_id), None)

    def create_task(self, task: Task) -> Task:
        self.tasks.append(task)
        self._log("task_created", task.model_dump())
        return task

    def update_task(self, task_id: str, updates: dict) -> Optional[Task]:
        task = self.get_task(task_id)
        if not task:
            return None
        for key, value in updates.items():
            if value is not None and hasattr(task, key):
                setattr(task, key, value)
        task.updated_at = datetime.now().isoformat()
        self._log("task_updated", task.model_dump())
        return task

    # ── Meetings ───────────────────────────────────────────────────────────

    def get_meetings(self, upcoming_only: bool = False) -> list[Meeting]:
        if upcoming_only:
            now = datetime.now().isoformat()
            return [m for m in self.meetings if m.start_time >= now and m.status == "scheduled"]
        return self.meetings

    def create_meeting(self, meeting: Meeting) -> Meeting:
        self.meetings = [m for m in self.meetings if m.id != meeting.id] + [meeting]
        self._log("meeting_scheduled", meeting.model_dump())
        return meeting

    def upsert_meeting(self, meeting: Meeting) -> Meeting:
        found = False
        for i, m in enumerate(self.meetings):
            if m.id == meeting.id:
                self.meetings[i] = meeting
                found = True
                break
        if not found:
            self.meetings.append(meeting)
        self._log("meeting_updated", meeting.model_dump())
        return meeting

    def remove_meeting(self, meeting_id: str) -> Optional[Meeting]:
        meeting = next((m for m in self.meetings if m.id == meeting_id), None)
        self.meetings = [m for m in self.meetings if m.id != meeting_id]
        if meeting:
            self._log("meeting_deleted", {"id": meeting_id, "title": meeting.title})
        return meeting

    def replace_meetings(self, meetings: list[Meeting]) -> None:
        self.meetings = list(meetings)

    # ── Activity ───────────────────────────────────────────────────────────

    def _log(self, event_type: str, payload: dict):
        self.activity_log.append({
            "type": event_type,
            "payload": payload,
            "timestamp": datetime.now().isoformat(),
        })

    def get_activity(self, limit: int = 20) -> list[dict]:
        return self.activity_log[-limit:][::-1]


# Singleton instance
store = DataStore()
