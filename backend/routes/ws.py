"""
WebSocket endpoint for real-time event streaming to the frontend.
Clients subscribe at /ws and receive JSON events when tools are executed.
"""
from __future__ import annotations
import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

log = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])

# All active WebSocket connections
_connections: set[WebSocket] = set()


async def broadcast(message: str):
    """Send a JSON message to all connected WebSocket clients."""
    if not _connections:
        return
    dead: set[WebSocket] = set()
    for ws in list(_connections):
        try:
            await ws.send_text(message)
        except Exception:
            dead.add(ws)
    _connections.difference_update(dead)


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    _connections.add(ws)
    log.info("WebSocket client connected. Total: %d", len(_connections))
    try:
        while True:
            # Keep connection alive; ignore client messages (ping/pong handled by framework)
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        _connections.discard(ws)
        log.info("WebSocket client disconnected. Total: %d", len(_connections))
