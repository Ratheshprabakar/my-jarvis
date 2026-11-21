"""
Routes for Agora RTC token generation and Conversational AI agent lifecycle.
"""
from __future__ import annotations
import base64
import logging
import time
import uuid
from fastapi import APIRouter, HTTPException, Depends
import httpx

from config import get_settings, Settings
from models import TokenRequest, TokenResponse, AgentStartRequest, AgentStartResponse, AgentStopRequest
from agora_token import generate_rtc_token

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/agora", tags=["agora"])

# Track active agents: channel → agent_id
_active_agents: dict[str, str] = {}

# Agora Conversational AI Engine REST API (v2)
AGORA_CONVO_AI_BASE = "https://api.agora.io/api/conversational-ai-agent/v2"


def _auth_header(s: Settings) -> str:
    """HTTP Basic auth header for Agora REST API."""
    creds = f"{s.agora_customer_id}:{s.agora_customer_secret}"
    return "Basic " + base64.b64encode(creds.encode()).decode()


def _build_system_prompt(s: Settings) -> str:
    return f"""You are an intelligent workplace assistant for {s.demo_employee_name}, a {s.demo_employee_role} in the {s.demo_employee_team} team.

You help employees with:
1. **Task Management** – create, update, track, and prioritize work tasks and Jira tickets.
2. **Google Calendar** – list, schedule, reschedule/move, invite guests, and delete real calendar events.
3. **Company Knowledge** – answer questions about HR policies, IT procedures, and company guidelines using the knowledge base.
4. **Daily Briefing** – provide a summary of the day's priorities, meetings, and pending tasks.

You have access to powerful tools. ALWAYS use the appropriate tool when asked to perform an action.
Be concise, professional, and conversational. Keep responses to 2–3 sentences unless the user asks for details.
When completing an action (e.g., creating a task), confirm it briefly: "Done — I've created TASK-XXX..."
Always ask for clarification before escalating or cancelling critical items."""


def _tool(name: str, description: str, parameters: dict, url: str, body: dict) -> dict:
    """Build a Conversational AI Engine custom tool (v2 schema)."""
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": parameters,
        },
        "server": {
            "method": "POST",
            "url": url,
            "timeout_ms": 15000,
            "body": body,
        },
    }


def _build_llm_config(s: Settings) -> dict:
    """LLM block — Agora managed OpenAI by default (Cursor has no chat-completions API)."""
    common = {
        "system_messages": [{"role": "system", "content": _build_system_prompt(s)}],
        "greeting_message": (
            f"Hello {s.demo_employee_name}! I'm your workplace assistant. "
            "How can I help you today? Ask about tasks, meetings, or company policies."
        ),
        "failure_message": "I'm sorry, I encountered an issue processing that. Please try again.",
        "max_history": 20,
        "tools": _build_tools(s.backend_public_url),
    }
    mode = (s.llm_mode or "managed").strip().lower()
    if mode == "custom" and s.cursor_api_key:
        return {
            **common,
            "vendor": "custom",
            "style": "openai",
            "url": s.cursor_api_url,
            "api_key": s.cursor_api_key,
            "params": {
                "model": s.cursor_model,
                "temperature": 0.4,
                "max_tokens": 512,
            },
        }
    # Agora-managed OpenAI — no customer LLM key required
    return {
        **common,
        "credential_mode": "managed",
        "vendor": "openai",
        "style": "openai",
        "url": "https://api.openai.com/v1/chat/completions",
        "params": {"model": "gpt-4o-mini"},
    }


def _build_tts_config(s: Settings) -> dict:
    """TTS block — managed MiniMax by default; Murf Falcon when TTS_MODE=murf + valid key."""
    mode = (s.tts_mode or "managed").strip().lower()
    if mode == "murf" and s.murf_api_key:
        return {
            "vendor": "murf",
            "params": {
                "api_key": s.murf_api_key,
                "base_url": "wss://global.api.murf.ai/v1/speech/stream-input",
                # Falcon streaming IDs are names (Natalie), not Gen2 IDs (en-US-natalie)
                "voiceId": s.murf_voice_id,
                "locale": "en-US",
                "rate": 0,
                "pitch": 0,
                "model": s.murf_model,
                "sample_rate": 24000,
            },
        }
    return {
        "credential_mode": "managed",
        "vendor": "minimax",
        "params": {
            "url": "wss://api.minimax.io/ws/v1/t2a_v2",
            "model": "speech-2.6-turbo",
            "voice_setting": {"voice_id": "English_captivating_female1"},
        },
    }


def _build_tools(public_url: str) -> list[dict]:
    """Build tool definitions for the Agora Conversational AI agent."""
    base = public_url.rstrip("/") + "/api/tools"
    return [
        _tool(
            "get_my_tasks",
            "Get the employee's current tasks and tickets. Use this when asked about pending work, tasks, to-do list, or what to focus on.",
            {
                "type": "object",
                "required": ["status"],
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": ["all", "pending", "in_progress", "completed", "blocked"],
                        "description": "Filter tasks by status. Use 'all' unless the user asks for a specific status.",
                    }
                },
            },
            f"{base}/tasks/list",
            {"status": "{{args.status}}"},
        ),
        _tool(
            "create_task",
            "Create a new task or Jira ticket. Use when asked to add, create, or raise a task, ticket, or action item.",
            {
                "type": "object",
                "required": ["title", "description", "priority"],
                "properties": {
                    "title": {"type": "string", "description": "Short title of the task."},
                    "description": {"type": "string", "description": "Detailed description. Use empty string if none."},
                    "priority": {
                        "type": "string",
                        "enum": ["low", "medium", "high", "critical"],
                        "description": "Task priority. Default medium.",
                    },
                },
            },
            f"{base}/tasks/create",
            {
                "title": "{{args.title}}",
                "description": "{{args.description}}",
                "priority": "{{args.priority}}",
            },
        ),
        _tool(
            "update_task",
            "Update the status or details of an existing task. Use when asked to mark a task as done, in progress, or blocked.",
            {
                "type": "object",
                "required": ["task_id", "status"],
                "properties": {
                    "task_id": {"type": "string", "description": "Task ID, e.g., 'TASK-001'."},
                    "status": {
                        "type": "string",
                        "enum": ["pending", "in_progress", "completed", "blocked"],
                    },
                },
            },
            f"{base}/tasks/update",
            {"task_id": "{{args.task_id}}", "status": "{{args.status}}"},
        ),
        _tool(
            "get_calendar",
            "Get upcoming Google Calendar meetings/events for the employee.",
            {
                "type": "object",
                "required": ["upcoming_only"],
                "properties": {
                    "upcoming_only": {
                        "type": "boolean",
                        "description": "If true, return only future meetings.",
                    }
                },
            },
            f"{base}/calendar/list",
            {"upcoming_only": "{{args.upcoming_only}}"},
        ),
        _tool(
            "schedule_meeting",
            "Create a Google Calendar event with a Meet link. Invite guests via attendee_emails (comma-separated emails).",
            {
                "type": "object",
                "required": ["title", "start_time", "end_time", "attendee_emails"],
                "properties": {
                    "title": {"type": "string", "description": "Meeting title."},
                    "start_time": {
                        "type": "string",
                        "description": "ISO datetime, e.g., '2026-11-22T10:00:00'.",
                    },
                    "end_time": {
                        "type": "string",
                        "description": "ISO datetime, e.g., '2026-11-22T11:00:00'.",
                    },
                    "attendee_emails": {
                        "type": "string",
                        "description": "Comma-separated guest emails. Use empty string if none.",
                    },
                },
            },
            f"{base}/calendar/schedule",
            {
                "title": "{{args.title}}",
                "start_time": "{{args.start_time}}",
                "end_time": "{{args.end_time}}",
                "attendees": "{{args.attendee_emails}}",
            },
        ),
        _tool(
            "reschedule_meeting",
            "Move or reschedule an existing Google Calendar meeting to a new start/end time.",
            {
                "type": "object",
                "required": ["meeting_id", "start_time", "end_time"],
                "properties": {
                    "meeting_id": {"type": "string", "description": "Google Calendar event id."},
                    "start_time": {"type": "string", "description": "New start ISO datetime."},
                    "end_time": {"type": "string", "description": "New end ISO datetime."},
                },
            },
            f"{base}/calendar/reschedule",
            {
                "meeting_id": "{{args.meeting_id}}",
                "start_time": "{{args.start_time}}",
                "end_time": "{{args.end_time}}",
            },
        ),
        _tool(
            "invite_to_meeting",
            "Invite additional people to an existing meeting by email.",
            {
                "type": "object",
                "required": ["meeting_id", "attendee_emails"],
                "properties": {
                    "meeting_id": {"type": "string", "description": "Google Calendar event id."},
                    "attendee_emails": {
                        "type": "string",
                        "description": "Comma-separated emails to invite.",
                    },
                },
            },
            f"{base}/calendar/invite",
            {
                "meeting_id": "{{args.meeting_id}}",
                "attendees": "{{args.attendee_emails}}",
            },
        ),
        _tool(
            "delete_meeting",
            "Cancel/delete a Google Calendar meeting and notify guests.",
            {
                "type": "object",
                "required": ["meeting_id"],
                "properties": {
                    "meeting_id": {"type": "string", "description": "Google Calendar event id."},
                },
            },
            f"{base}/calendar/delete",
            {"meeting_id": "{{args.meeting_id}}"},
        ),
        _tool(
            "search_knowledge_base",
            "Search the company knowledge base for HR policies, IT procedures, expense rules, onboarding guides, and engineering standards. Use for any policy or procedure question.",
            {
                "type": "object",
                "required": ["query"],
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Natural language question or search query.",
                    }
                },
            },
            f"{base}/knowledge/search",
            {"query": "{{args.query}}"},
        ),
        _tool(
            "get_daily_briefing",
            "Generate a daily briefing with today's meetings, top priority tasks, and key reminders.",
            {"type": "object", "properties": {}},
            f"{base}/briefing",
            {},
        ),
        _tool(
            "send_notification",
            "Send a notification or message to a colleague via Slack/Teams. Use when the user asks to notify, ping, or message someone.",
            {
                "type": "object",
                "required": ["recipient", "message"],
                "properties": {
                    "recipient": {"type": "string", "description": "Name or email of the recipient."},
                    "message": {"type": "string", "description": "The message to send."},
                },
            },
            f"{base}/notifications/send",
            {"recipient": "{{args.recipient}}", "message": "{{args.message}}"},
        ),
    ]


# ── Endpoints ──────────────────────────────────────────────────────────────

def _has_certificate(s: Settings) -> bool:
    """Return True only when a real App Certificate is configured."""
    cert = (s.agora_app_certificate or "").strip()
    return bool(cert) and cert not in ("your_app_certificate", "demo")


@router.post("/token", response_model=TokenResponse)
async def get_token(req: TokenRequest, s: Settings = Depends(get_settings)):
    """Generate an Agora RTC token (or null if project is in Testing Mode)."""
    if not _has_certificate(s):
        # Agora Testing Mode — no App Certificate means no token required.
        # Pass null directly to client.join(); the gateway accepts it.
        log.info("No App Certificate configured — returning null token (Testing Mode)")
        return TokenResponse(token=None, channel=req.channel, uid=req.uid, app_id=s.agora_app_id)

    try:
        token = generate_rtc_token(
            app_id=s.agora_app_id,
            app_certificate=s.agora_app_certificate,
            channel_name=req.channel,
            uid=req.uid,
        )
    except Exception as exc:
        log.error("Token generation failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Token generation failed: {exc}")

    return TokenResponse(token=token, channel=req.channel, uid=req.uid, app_id=s.agora_app_id)


@router.post("/agent/start", response_model=AgentStartResponse)
async def start_agent(req: AgentStartRequest, s: Settings = Depends(get_settings)):
    """
    Deploy an Agora Conversational AI agent to the RTC channel.
    The agent will join as a listener + speaker using Murf Falcon TTS.
    """
    # Generate token for the AI agent UID (empty string if Testing Mode)
    if not _has_certificate(s):
        agent_token = ""
        log.info("No App Certificate — using empty agent token (Testing Mode)")
    else:
        try:
            agent_token = generate_rtc_token(
                app_id=s.agora_app_id,
                app_certificate=s.agora_app_certificate,
                channel_name=req.channel,
                uid=s.agora_agent_uid,
            )
        except Exception as exc:
            log.error("Agent token generation failed: %s", exc, exc_info=True)
            raise HTTPException(status_code=500, detail=f"Agent token generation failed: {exc}")

    # Agent names must be unique across join calls
    agent_name = f"{req.agent_name}-{int(time.time())}-{uuid.uuid4().hex[:6]}"

    payload = {
        "name": agent_name,
        "properties": {
            "channel": req.channel,
            "token": agent_token,
            "agent_rtc_uid": str(s.agora_agent_uid),
            # Only one remote UID is supported — subscribe to the human user
            "remote_rtc_uids": [str(req.user_uid)],
            "enable_string_uid": False,
            "idle_timeout": 300,
            "advanced_features": {
                "enable_tools": True,
            },
            "asr": {
                "language": "en-US",
            },
            "llm": _build_llm_config(s),
            "tts": _build_tts_config(s),
            # Speak over the agent to barge in; also exposed via /agent/interrupt
            "interruption": {
                "enable": True,
                "mode": "start_of_speech",
            },
            "turn_detection": {
                "type": "agora_vad",
                "interrupt_mode": "interrupt",
                "interrupt_duration_ms": 160,
                "silence_duration_ms": 480,
            },
        },
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{AGORA_CONVO_AI_BASE}/projects/{s.agora_app_id}/join",
                json=payload,
                headers={
                    "Authorization": _auth_header(s),
                    "Content-Type": "application/json",
                },
            )
            if resp.status_code >= 400:
                log.error("Agora agent start failed: %s — %s", resp.status_code, resp.text)
                raise HTTPException(
                    status_code=502,
                    detail=f"Agora agent start failed ({resp.status_code}): {resp.text[:400]}",
                )
            data = resp.json()
            agent_id = data.get("agent_id")
            if not agent_id:
                raise HTTPException(status_code=502, detail="Agora join returned no agent_id")
    except HTTPException:
        raise
    except Exception as exc:
        log.error("Agora agent start error: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail=f"Agora agent start error: {exc}")

    _active_agents[req.channel] = agent_id
    log.info("Agent %s started on channel %s", agent_id, req.channel)

    return AgentStartResponse(agent_id=agent_id, channel=req.channel, status="running")


@router.post("/agent/stop")
async def stop_agent(req: AgentStopRequest, s: Settings = Depends(get_settings)):
    """Stop the Conversational AI agent (leave channel)."""
    agent_id = req.agent_id or _active_agents.get(req.channel)
    if not agent_id:
        raise HTTPException(status_code=404, detail="No active agent for this channel")

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{AGORA_CONVO_AI_BASE}/projects/{s.agora_app_id}/agents/{agent_id}/leave",
                json={},
                headers={
                    "Authorization": _auth_header(s),
                    "Content-Type": "application/json",
                },
            )
            if resp.status_code >= 400 and resp.status_code != 404:
                log.warning("Agent leave warning: %s — %s", resp.status_code, resp.text)
    except Exception as exc:
        log.warning("Agent stop warning: %s", exc)

    _active_agents.pop(req.channel, None)
    return {"status": "stopped", "agent_id": agent_id}


@router.post("/agent/interrupt")
async def interrupt_agent(req: AgentStopRequest, s: Settings = Depends(get_settings)):
    """
    Stop the agent mid-speech / mid-think so the user can ask something new.
    Keeps the agent in the channel (unlike /agent/stop).
    """
    agent_id = req.agent_id or _active_agents.get(req.channel)
    if not agent_id:
        raise HTTPException(status_code=404, detail="No active agent for this channel")

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{AGORA_CONVO_AI_BASE}/projects/{s.agora_app_id}/agents/{agent_id}/interrupt",
                json={},
                headers={
                    "Authorization": _auth_header(s),
                    "Content-Type": "application/json",
                },
            )
            if resp.status_code >= 400:
                log.error("Agent interrupt failed: %s — %s", resp.status_code, resp.text)
                raise HTTPException(
                    status_code=502,
                    detail=f"Interrupt failed ({resp.status_code}): {resp.text[:300]}",
                )
    except HTTPException:
        raise
    except Exception as exc:
        log.error("Agent interrupt error: %s", exc)
        raise HTTPException(status_code=502, detail=f"Interrupt error: {exc}")

    return {"status": "interrupted", "agent_id": agent_id}


@router.get("/agents")
async def list_agents():
    """List all active agents (for debugging)."""
    return {"active_agents": _active_agents}


@router.get("/agent/{agent_id}/status")
async def agent_status(agent_id: str, s: Settings = Depends(get_settings)):
    """Proxy Agora agent status — useful when the agent dies after join."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{AGORA_CONVO_AI_BASE}/projects/{s.agora_app_id}/agents/{agent_id}",
                headers={"Authorization": _auth_header(s)},
            )
            if resp.status_code >= 400:
                return {"agent_id": agent_id, "status": "UNKNOWN", "detail": resp.text[:300]}
            return resp.json()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))
