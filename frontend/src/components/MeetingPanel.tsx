import { Calendar, Clock, MapPin, MessageCircle, ExternalLink, RefreshCw } from "lucide-react";
import type { Meeting, GoogleCalendarStatus } from "../types";
import { ScrollArea }  from "./ui/scroll-area";
import { Collapsible } from "./ui/collapsible";
import { AvatarStack } from "./ui/avatar";
import { Tooltip }     from "./ui/tooltip";
import { Separator }   from "./ui/separator";

interface Props {
  meetings: Meeting[];
  google?: GoogleCalendarStatus | null;
  onSync?: () => void;
}

function fmtTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  } catch { return iso; }
}

function dayLabel(iso: string): string {
  const d    = new Date(iso);
  const now  = new Date();
  const diff = Math.floor(
    (new Date(d.toDateString()).getTime() - new Date(now.toDateString()).getTime()) / 86_400_000
  );
  if (diff === 0)  return "Today";
  if (diff === 1)  return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(d);
}

function isFutureDate(iso: string): boolean {
  return new Date(iso) > new Date();
}

function MeetingRow({ meeting, isNew }: { meeting: Meeting; isNew: boolean }) {
  const upcoming = isFutureDate(meeting.start_time);
  const link = meeting.hangout_link || meeting.html_link;

  return (
    <li
      className={[
        "flex items-start gap-3 px-3 py-2.5 rounded-lg",
        "transition-[background-color] duration-100 hover:bg-surface-2/70",
        isNew    ? "ring-1 ring-emerald-500/35 bg-success-soft" : "",
        !upcoming ? "opacity-35" : "",
      ].join(" ")}
      aria-label={`${meeting.title}, ${dayLabel(meeting.start_time)} ${fmtTime(meeting.start_time)}`}
    >
      <div className="shrink-0 w-14 text-right">
        <p className="text-xs font-medium text-fg-muted tabular">{fmtTime(meeting.start_time)}</p>
        <p className="text-[10px] text-fg-subtle tabular">{fmtTime(meeting.end_time)}</p>
      </div>

      <div
        className={`w-[2px] self-stretch rounded-full shrink-0 mt-0.5 ${upcoming ? "bg-accent/40" : "bg-surface-3/50"}`}
        aria-hidden="true"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <p className="text-sm text-fg leading-snug truncate flex-1">{meeting.title}</p>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="text-fg-subtle hover:text-accent shrink-0"
              aria-label="Open in Google Calendar"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <Tooltip content={meeting.location} side="bottom">
            <span className="flex items-center gap-1 text-[11px] text-fg-muted cursor-default">
              <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span className="truncate max-w-[100px]">{meeting.location}</span>
            </span>
          </Tooltip>

          {meeting.attendees.length > 0 && (
            <Tooltip content={meeting.attendees.join(", ")} side="bottom">
              <span className="cursor-default">
                <AvatarStack names={meeting.attendees} max={4} />
              </span>
            </Tooltip>
          )}
        </div>
      </div>
    </li>
  );
}

function DateGroup({ label, meetings }: { label: string; meetings: Meeting[] }) {
  const isToday = label === "Today";
  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span
          className={`text-[11px] font-semibold uppercase tracking-wider shrink-0 ${isToday ? "text-accent" : "text-fg-subtle"}`}
        >
          {label}
        </span>
        <div className="flex-1 h-px bg-surface-3/40" aria-hidden="true" />
      </div>
      <ul className="space-y-0.5">
        {meetings.map((m) => (
          <MeetingRow
            key={m.id}
            meeting={m}
            isNew={Date.now() - new Date(m.created_at || 0).getTime() < 12_000}
          />
        ))}
      </ul>
    </div>
  );
}

export function MeetingPanel({ meetings, google, onSync }: Props) {
  const connected = Boolean(google?.connected);
  const upcoming = meetings
    .filter((m) => isFutureDate(m.start_time) && m.status === "scheduled")
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const past = meetings.filter(
    (m) => !isFutureDate(m.start_time) || m.status !== "scheduled"
  );

  const groups = upcoming.reduce<Record<string, Meeting[]>>((acc, m) => {
    const key = dayLabel(m.start_time);
    (acc[key] ??= []).push(m);
    return acc;
  }, {});

  return (
    <section aria-label="Calendar & Meetings" className="card rounded-xl flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-3/50 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <Calendar className="w-3.5 h-3.5 text-fg-muted shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-fg">Calendar</h2>
          <span className="text-[11px] tabular text-fg-muted font-medium">{upcoming.length} upcoming</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {connected && onSync && (
            <Tooltip content="Refresh from Google" side="bottom">
              <button
                type="button"
                onClick={onSync}
                className="p-1 rounded text-fg-muted hover:text-fg hover:bg-surface-2"
                aria-label="Sync Google Calendar"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          )}
          <span
            className={[
              "text-[10px] px-1.5 py-0.5 rounded border",
              connected
                ? "text-success border-success-soft bg-success-soft"
                : "text-fg-muted border-surface-3/60 bg-surface-2",
            ].join(" ")}
          >
            {connected ? "Google" : "Offline"}
          </span>
        </div>
      </div>

      {!connected ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 px-6 py-10 text-center">
          <Calendar className="w-8 h-8 text-fg-subtle" aria-hidden="true" />
          <div>
            <p className="text-sm text-fg font-medium">Connect Google Calendar</p>
            <p className="text-xs text-fg-subtle mt-1 leading-relaxed">
              Mock invites were removed. Link your Google account to schedule, reschedule, invite, and delete for real.
            </p>
          </div>
          {google?.configured && google.connect_url ? (
            <a
              href={google.connect_url}
              target="_blank"
              rel="noreferrer"
              className="touch-manip text-xs font-medium px-3 py-2 rounded-lg bg-accent text-white hover:bg-accent-dark border border-accent"
            >
              Connect Google Calendar
            </a>
          ) : (
            <p className="text-[11px] text-amber-400/90 leading-relaxed">
              Add <code className="text-amber-300">GOOGLE_CLIENT_ID</code> and{" "}
              <code className="text-amber-300">GOOGLE_CLIENT_SECRET</code> to <code>.env</code>, then restart the backend.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 px-4 py-2 border-b border-surface-3/20 shrink-0">
            <MessageCircle className="w-3 h-3 text-fg-subtle shrink-0" aria-hidden="true" />
            <p className="text-[11px] text-fg-subtle italic truncate">
              {google?.email
                ? `Synced as ${google.email}`
                : '"Schedule standup tomorrow at 10 am with alex@company.com"'}
            </p>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="py-1">
              {upcoming.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Clock className="w-7 h-7 text-fg-subtle" aria-hidden="true" />
                  <p className="text-sm text-fg-muted">No upcoming meetings</p>
                  <p className="text-xs text-fg-subtle">Ask the assistant to schedule one</p>
                </div>
              ) : (
                Object.entries(groups).map(([label, items]) => (
                  <DateGroup key={label} label={label} meetings={items} />
                ))
              )}

              {past.length > 0 && (
                <>
                  <Separator className="mx-3 my-1" />
                  <Collapsible triggerLabel={`${past.length} past`} className="px-1 pb-2">
                    <ul className="space-y-0.5">
                      {past.map((m) => (
                        <MeetingRow key={m.id} meeting={m} isNew={false} />
                      ))}
                    </ul>
                  </Collapsible>
                </>
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </section>
  );
}
