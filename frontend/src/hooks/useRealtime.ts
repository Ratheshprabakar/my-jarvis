/**
 * WebSocket hook — connects to /ws and returns a live stream of events.
 * Automatically reconnects on disconnect.
 */
import { useEffect, useRef, useCallback, useState } from "react";
import type { ActivityEvent } from "../types";

export function useRealtime(onEvent: (event: ActivityEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  const [connected, setConnected] = useState(false);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${protocol}://${window.location.host}/ws`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setConnected(true);
      // Keepalive ping every 20s
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 20_000);
      (ws as WebSocket & { _ping?: ReturnType<typeof setInterval> })._ping = ping;
    };

    ws.onmessage = (e) => {
      if (e.data === "pong") return;
      try {
        const event: ActivityEvent = JSON.parse(e.data);
        onEventRef.current(event);
      } catch {
        // non-JSON message
      }
    };

    ws.onclose = () => {
      setConnected(false);
      const typed = ws as WebSocket & { _ping?: ReturnType<typeof setInterval> };
      if (typed._ping) clearInterval(typed._ping);
      // Reconnect after 2 seconds
      reconnectTimer.current = setTimeout(connect, 2_000);
    };

    ws.onerror = () => ws.close();
    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected };
}
