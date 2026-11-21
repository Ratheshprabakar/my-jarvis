export type TaskStatus = "pending" | "in_progress" | "completed" | "blocked";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type MeetingStatus = "scheduled" | "cancelled" | "completed";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  tags: string[];
}

export interface Meeting {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  attendees: string[];
  location: string;
  organizer: string;
  created_at: string;
  status: MeetingStatus;
  html_link?: string | null;
  hangout_link?: string | null;
}

export interface Employee {
  name: string;
  role: string;
  team: string;
}

export interface GoogleCalendarStatus {
  configured: boolean;
  connected: boolean;
  email?: string | null;
  connect_url?: string | null;
  error?: string;
}

export interface DashboardData {
  employee: Employee;
  tasks: Task[];
  meetings: Meeting[];
  activity: ActivityEvent[];
  google_calendar?: GoogleCalendarStatus;
}

export type WSEventType =
  | "tool_called"
  | "task_created"
  | "task_updated"
  | "meeting_scheduled"
  | "meeting_updated"
  | "meeting_deleted"
  | "calendar_synced"
  | "knowledge_queried"
  | "agent_joined"
  | "agent_left"
  | "briefing_generated"
  | "notification_sent";

export interface ActivityEvent {
  type: WSEventType;
  payload: Record<string, unknown>;
  timestamp: string;
}

export type VoiceSessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "speaking"
  | "listening"
  | "processing"
  | "error";
