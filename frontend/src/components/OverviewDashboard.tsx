import type { ComponentType } from "react";
import {
  CheckCircle2, Circle, AlertCircle, Calendar, Activity, Link2, Mic2,
} from "lucide-react";
import type { ActivityEvent, GoogleCalendarStatus, Meeting, Task } from "../types";

interface Props {
  tasks: Task[];
  meetings: Meeting[];
  activity: ActivityEvent[];
  google: GoogleCalendarStatus | null;
  employeeName?: string;
}

function isUpcoming(iso: string) {
  return new Date(iso) > new Date();
}

function isToday(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  return d.toDateString() === n.toDateString();
}

function StatCard({
  label, value, hint, icon: Icon, tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "default" | "danger" | "ok";
}) {
  const toneCls =
    tone === "danger" ? "text-red-500" :
    tone === "ok"     ? "text-emerald-500" :
                        "text-accent";

  return (
    <div className="card rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide font-medium text-fg-muted">{label}</span>
        <Icon className={`w-4 h-4 ${toneCls}`} aria-hidden="true" />
      </div>
      <p className="text-2xl font-semibold tabular text-fg tracking-tight">{value}</p>
      {hint && <p className="text-xs text-fg-subtle leading-relaxed">{hint}</p>}
    </div>
  );
}

export function OverviewDashboard({ tasks, meetings, activity, google, employeeName }: Props) {
  const open = tasks.filter((t) => t.status !== "completed");
  const critical = open.filter((t) => t.priority === "critical");
  const inProgress = open.filter((t) => t.status === "in_progress");
  const done = tasks.filter((t) => t.status === "completed");
  const upcoming = meetings.filter((m) => isUpcoming(m.start_time) && m.status === "scheduled");
  const today = upcoming.filter((m) => isToday(m.start_time));

  return (
    <div className="flex flex-col gap-4 panel-shell overflow-auto">
      <div className="card rounded-xl px-5 py-4">
        <p className="text-xs text-fg-muted uppercase tracking-wide font-medium">Overview</p>
        <h2 className="text-lg font-semibold text-fg mt-1 tracking-tight">
          {employeeName ? `Welcome back, ${employeeName.split(" ")[0]}` : "Workplace dashboard"}
        </h2>
        <p className="text-sm text-fg-muted mt-1 max-w-2xl leading-relaxed">
          Snapshot of open work, today’s calendar, and recent assistant activity. Use Workspace for voice control, or Activity for the live event stream.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Open tasks" value={open.length} hint={`${inProgress.length} in progress`} icon={Circle} />
        <StatCard
          label="Critical"
          value={critical.length}
          hint={critical.length ? "Needs attention" : "None right now"}
          icon={AlertCircle}
          tone={critical.length ? "danger" : "ok"}
        />
        <StatCard label="Meetings today" value={today.length} hint={`${upcoming.length} upcoming total`} icon={Calendar} />
        <StatCard label="Activity" value={activity.length} hint="Recent events" icon={Activity} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0">
        <section className="card rounded-xl p-4 flex flex-col min-h-0">
          <h3 className="text-sm font-semibold text-fg mb-3">Priorities</h3>
          <ul className="space-y-2 overflow-auto min-h-0 flex-1">
            {(critical.length ? critical : open.slice(0, 5)).map((t) => (
              <li key={t.id} className="flex items-start gap-2 text-sm">
                <span className={`dot mt-1.5 ${t.priority === "critical" ? "bg-red-500" : "bg-accent"}`} />
                <div className="min-w-0">
                  <p className="text-fg truncate">{t.title}</p>
                  <p className="text-[11px] text-fg-subtle">{t.id} · {t.status.replace("_", " ")}</p>
                </div>
              </li>
            ))}
            {open.length === 0 && (
              <li className="text-sm text-fg-subtle flex items-center gap-2 py-6 justify-center">
                <CheckCircle2 className="w-4 h-4" /> No open tasks
              </li>
            )}
          </ul>
        </section>

        <section className="card rounded-xl p-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-fg">Integrations</h3>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-2/60 border border-surface-3/40">
            <Link2 className="w-4 h-4 text-accent shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-fg">Google Calendar</p>
              <p className="text-[11px] text-fg-muted truncate">
                {google?.connected
                  ? `Connected${google.email ? ` · ${google.email}` : ""}`
                  : google?.configured
                    ? "Configured — connect to sync"
                    : "Add Google OAuth credentials in .env"}
              </p>
            </div>
            <span className={`dot ${google?.connected ? "bg-emerald-500" : "bg-fg-subtle"}`} />
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-2/60 border border-surface-3/40">
            <Mic2 className="w-4 h-4 text-accent shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-fg">Voice assistant</p>
              <p className="text-[11px] text-fg-muted">Realtime voice session with tool actions</p>
            </div>
            <span className="dot bg-accent" />
          </div>
          <p className="text-[11px] text-fg-subtle leading-relaxed mt-auto pt-2">
            Completed tasks: {done.length}. Upcoming meetings: {upcoming.length}.
          </p>
        </section>
      </div>
    </div>
  );
}
