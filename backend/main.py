"""
AI Workplace Assistant — FastAPI backend

Responsibilities:
  • Serve Agora RTC tokens to the frontend
  • Start / stop Agora Conversational AI agents
  • Expose tool endpoints that the AI agent calls during conversations
  • Push real-time updates to the frontend via WebSocket
  • Serve dashboard data (tasks, meetings, activity)

Run:
    cd backend
    uvicorn main:app --reload --port 8000
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.agora import router as agora_router
from routes.tools import router as tools_router
from routes.ws import router as ws_router
from routes.dashboard import router as dashboard_router
from routes.google_cal import router as google_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)

app = FastAPI(
    title="AI Workplace Assistant API",
    description="Voice-first agentic workplace assistant powered by Agora + Murf + OpenAI",
    version="1.0.0",
)

# Allow requests from the React dev server and any ngrok tunnel
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(agora_router)
app.include_router(tools_router)
app.include_router(ws_router)
app.include_router(dashboard_router)
app.include_router(google_router)


@app.get("/")
async def root():
    return {
        "service": "AI Workplace Assistant",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
