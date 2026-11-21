# 🎙️ AI Workplace Assistant

> **Hackathon submission** — Theme: *From Workplace Assistance to Intelligent Action*

A **voice-first, agentic workplace assistant** that lets employees manage tasks, schedule meetings, look up company policies, and get daily briefings through **natural, hands-free voice conversations**.

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                     Employee's Browser                      │
│                                                            │
│  ┌──────────────┐   Agora RTC   ┌──────────────────────┐  │
│  │  React UI    │◄─────────────►│  Agora Conv. AI Agent│  │
│  │  (Voice +    │               │  • STT (English)      │  │
│  │   Dashboard) │               │  • GPT-4o LLM         │  │
│  └──────┬───────┘               │  • Murf Falcon TTS    │  │
│         │ WebSocket             └──────────┬───────────┘  │
│         │ (real-time events)               │ Tool calls   │
└─────────┼───────────────────────────────── │ ─────────────┘
          │                                  │
          ▼                                  ▼
┌──────────────────────────────────────────────────────────┐
│                    FastAPI Backend                        │
│                                                          │
│  /api/agora/token          → Agora RTC token gen         │
│  /api/agora/agent/start    → Deploy Conv. AI agent       │
│  /api/tools/tasks/*        → Task CRUD                   │
│  /api/tools/calendar/*     → Meeting management          │
│  /api/tools/knowledge/*    → RAG knowledge search        │
│  /api/tools/briefing       → Daily briefing              │
│  /api/tools/notifications  → Send notifications          │
│  /ws                       → WebSocket event stream      │
│  /api/dashboard            → Dashboard data              │
└──────────────────────────────────────────────────────────┘
```

## Demo Workflow (End-to-End)

| Step | What happens |
|------|-------------|
| **Initiate** | Employee clicks the mic button → joins Agora RTC channel |
| **Connect** | Backend deploys Agora Conversational AI agent to same channel |
| **Understand** | Agora STT transcribes speech → GPT-4o analyzes intent |
| **Execute** | LLM calls tool endpoint → backend mutates data store |
| **Live Update** | Backend pushes WebSocket event → React dashboard updates instantly |
| **Confirm** | Murf Falcon TTS speaks the result back to the employee |
| **Follow Up** | Full history in Activity Feed; tasks/meetings persist across session |

## Voice Commands to Demo

| Command | What happens |
|---------|-------------|
| "What are my tasks today?" | Lists tasks from the store |
| "Create a critical task: fix the payment gateway timeout" | Creates task, card appears instantly |
| "Mark TASK-001 as completed" | Updates task status live on dashboard |
| "Schedule a sprint planning tomorrow at 10am" | Creates meeting card on calendar panel |
| "What's our work from home policy?" | RAG search, reads policy aloud |
| "Give me my daily briefing" | Summarises tasks + meetings for the day |
| "Notify Priya that I'll be 5 minutes late" | Mock Slack DM, appears in Activity Feed |
| "What's the incident response process?" | Retrieves engineering runbook |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Voice I/O** | [Agora RTC Web SDK](https://docs.agora.io/en/video-calling/get-started/get-started-sdk) |
| **Conversational AI** | [Agora Conversational AI](https://docs.agora.io/en/conversational-ai/overview/product-overview) |
| **TTS** | [Murf AI Falcon TTS](https://murf.ai) — `en-US-natalie` voice |
| **LLM** | GPT-4o via **[Cursor API](https://cursor.com/dashboard/integrations)** (`api.cursor.sh/v1`, OpenAI-compatible) |
| **Knowledge (RAG)** | Custom TF-IDF search over 8 company KB articles |
| **Backend** | Python FastAPI + WebSocket |
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS |

---

## Quick Start

### 1 — Prerequisites

```bash
node >= 18
python >= 3.11
```

### 2 — Clone & configure

```bash
cp .env.example .env
# Fill in your keys:
#   AGORA_APP_ID, AGORA_APP_CERTIFICATE
#   AGORA_CUSTOMER_ID, AGORA_CUSTOMER_SECRET
#   OPENAI_API_KEY
#   MURF_API_KEY, MURF_VOICE_ID
#   BACKEND_PUBLIC_URL  ← use ngrok for Agora tool callbacks
```

> **Getting Agora credentials**
> 1. Create a project at [console.agora.io](https://console.agora.io)
> 2. Enable *Conversational AI* in the project
> 3. Create RESTful API credentials (Customer ID + Secret) under **Developer Tools**

> **Getting Murf credentials**
> Sign up at [murf.ai](https://murf.ai) → API Keys → copy your key

### 3 — Start the backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs available at `http://localhost:8000/docs`

### 4 — Expose backend publicly (for Agora tool calls)

```bash
# In a separate terminal:
ngrok http 8000
# Copy the https URL and set it as BACKEND_PUBLIC_URL in .env
# Then restart the backend
```

### 5 — Start the frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

---

## Project Structure

```
ai_assistant/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Pydantic settings from .env
│   ├── models.py            # Pydantic data models (Task, Meeting, …)
│   ├── agora_token.py       # Agora AccessToken2 generator (pure Python)
│   ├── store.py             # In-memory data store with seed data
│   ├── knowledge_base.py    # TF-IDF RAG over 8 company KB articles
│   └── routes/
│       ├── agora.py         # /api/agora/* — token + agent lifecycle
│       ├── tools.py         # /api/tools/* — tool execution endpoints
│       ├── ws.py            # /ws — WebSocket broadcast
│       └── dashboard.py     # /api/dashboard/* — dashboard REST API
├── frontend/
│   └── src/
│       ├── App.tsx          # Root component, state orchestration
│       ├── types.ts         # TypeScript type definitions
│       ├── services/api.ts  # Backend API client
│       ├── hooks/
│       │   ├── useAgora.ts      # Agora RTC + agent lifecycle hook
│       │   └── useRealtime.ts   # WebSocket hook with auto-reconnect
│       └── components/
│           ├── Header.tsx        # App header with status indicators
│           ├── VoiceButton.tsx   # Animated voice control button
│           ├── TaskPanel.tsx     # Live task management panel
│           ├── MeetingPanel.tsx  # Calendar & meetings panel
│           ├── ActivityFeed.tsx  # Real-time tool call activity
│           └── DemoScenarios.tsx # Quick-start voice command hints
├── .env.example
└── README.md
```

---

## Agentic Workflow: Task Lifecycle

```
Employee: "Create a high-priority task to fix the payment gateway timeout"
    │
    ▼  [Agora STT]
    │  "Create a high priority task to fix the payment gateway timeout"
    ▼  [GPT-4o tool selection]
    │  → calls create_task(title="Fix payment gateway timeout", priority="high")
    ▼  [POST /api/tools/tasks/create]
    │  Task created: TASK-XXX
    ▼  [WebSocket broadcast]
    │  → frontend adds new task card (highlighted in blue)
    ▼  [Murf Falcon TTS]
    Employee hears: "Done — I've created TASK-XXX: Fix payment gateway timeout,
                     marked as high priority and assigned to you."
```

## Knowledge Base Articles Included

1. Work From Home (WFH) Policy
2. Annual Leave & PTO Policy
3. IT Support & Helpdesk Procedures
4. Expense Reimbursement Policy
5. Employee Onboarding Checklist
6. Code Review Standards & Process
7. Incident Response Playbook
8. Performance Review Process

---

## License

MIT
