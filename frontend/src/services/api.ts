/**
 * API client for the FastAPI backend.
 * All paths go through Vite's proxy (/api → http://localhost:8000/api).
 */

const BASE = "/api";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ── Agora ──────────────────────────────────────────────────────────────────

export interface TokenResponse {
  token: string | null;   // null = Agora Testing Mode (no App Certificate)
  channel: string;
  uid: number;
  app_id: string;
}

export function fetchToken(channel: string, uid: number): Promise<TokenResponse> {
  return post("/agora/token", { channel, uid });
}

export interface AgentStartResponse {
  agent_id: string;
  channel: string;
  status: string;
}

export function startAgent(channel: string, userUid: number): Promise<AgentStartResponse> {
  return post("/agora/agent/start", { channel, user_uid: userUid });
}

export function stopAgent(agentId: string, channel: string): Promise<void> {
  return post("/agora/agent/stop", { agent_id: agentId, channel });
}

/** Cut off the agent's current speech/thinking without ending the session. */
export function interruptAgent(agentId: string, channel: string): Promise<void> {
  return post("/agora/agent/interrupt", { agent_id: agentId, channel });
}

// ── Dashboard ──────────────────────────────────────────────────────────────

import type { DashboardData } from "../types";

export function fetchDashboard(): Promise<DashboardData> {
  return get("/dashboard/");
}
