"""Pydantic models shared across the backend."""
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
import uuid


# ── Task / Ticket ──────────────────────────────────────────────────────────

class Task(BaseModel):
    id: str = Field(default_factory=lambda: f"TASK-{str(uuid.uuid4())[:6].upper()}")
    title: str
    description: str = ""
    status: Literal["pending", "in_progress", "completed", "blocked"] = "pending"
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    assignee: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    due_date: Optional[str] = None
    tags: list[str] = []


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[Literal["pending", "in_progress", "completed", "blocked"]] = None
    priority: Optional[Literal["low", "medium", "high", "critical"]] = None
    due_date: Optional[str] = None


# ── Meeting / Calendar ─────────────────────────────────────────────────────

class Meeting(BaseModel):
    id: str = Field(default_factory=lambda: f"MTG-{str(uuid.uuid4())[:6].upper()}")
    title: str
    description: str = ""
    start_time: str
    end_time: str
    attendees: list[str] = []
    location: str = "Google Calendar"
    organizer: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    status: Literal["scheduled", "cancelled", "completed"] = "scheduled"
    html_link: Optional[str] = None
    hangout_link: Optional[str] = None


# ── API request / response models ─────────────────────────────────────────

class TokenRequest(BaseModel):
    channel: str
    uid: int = 1


class TokenResponse(BaseModel):
    token: Optional[str] = None   # None = Testing Mode (no App Certificate)
    channel: str
    uid: int
    app_id: str


class AgentStartRequest(BaseModel):
    channel: str
    user_uid: int = 1
    agent_name: str = "workplace-assistant"


class AgentStartResponse(BaseModel):
    agent_id: str
    channel: str
    status: str


class AgentStopRequest(BaseModel):
    agent_id: str
    channel: str


# ── Tool call payloads (sent by Agora agent) ───────────────────────────────

class ToolCallPayload(BaseModel):
    """Generic payload Agora sends when the LLM calls a tool."""
    tool_call_id: str = ""
    name: str = ""
    arguments: dict = Field(default_factory=dict)


# ── WebSocket event pushed to frontend ─────────────────────────────────────

class WSEvent(BaseModel):
    type: Literal[
        "tool_called",
        "task_created",
        "task_updated",
        "meeting_scheduled",
        "meeting_updated",
        "meeting_deleted",
        "calendar_synced",
        "knowledge_queried",
        "agent_joined",
        "agent_left",
        "briefing_generated",
        "notification_sent",
    ]
    payload: dict
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
