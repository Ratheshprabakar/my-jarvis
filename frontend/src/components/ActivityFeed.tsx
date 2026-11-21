import {
  Wrench, PlusCircle, RefreshCcw, CalendarPlus, CalendarClock, CalendarX2, RefreshCw,
  BookOpen, Zap, Bell, FileText,
} from "lucide-react";
import type { ActivityEvent, WSEventType } from "../types";
import { ScrollArea } from "./ui/scroll-area";

interface Props {
  events: ActivityEvent[];
  /** Fill parent height (Activity tab) instead of a short sidebar list */
  fillHeight?: boolean;
}

type Cfg = {
  Icon:  React.ComponentType<{ className?: string }>;
  badge: string;
  label: (p: Record<string, unknown>) => string;
};

const CFG: Record<WSEventType, Cfg> = {
  tool_called:        { Icon: Wrench,         badge: "bg-surface-2 text-fg-muted",          label: (p) => `Tool: ${p.tool}`                   },
  task_created:       { Icon: PlusCircle,     badge: "bg-blue-500/10 text-blue-500",        label: (p) => `Created ${p.id} — ${p.title ?? ""}` },
  task_updated:       { Icon: RefreshCcw,     badge: "bg-amber-500/10 text-amber-500",      label: (p) => `Updated ${p.id} → ${p.status}`     },
  meeting_scheduled:  { Icon: CalendarPlus,   badge: "bg-emerald-500/10 text-emerald-500",  label: (p) => `Scheduled: ${p.title}`             },
  meeting_updated:    { Icon: CalendarClock,  badge: "bg-emerald-500/10 text-emerald-500",  label: (p) => `Updated: ${p.title}`               },
  meeting_deleted:    { Icon: CalendarX2,     badge: "bg-red-500/10 text-red-500",          label: (p) => `Deleted: ${p.title ?? p.id}`       },
  calendar_synced:    { Icon: RefreshCw,      badge: "bg-emerald-500/10 text-emerald-500",  label: (p) => `Calendar synced (${p.count ?? 0})` },
  knowledge_queried:  { Icon: BookOpen,       badge: "bg-violet-500/10 text-violet-500",    label: (p) => `Search: "${p.query}"`              },
  agent_joined:       { Icon: Zap,            badge: "bg-blue-500/10 text-blue-500",        label: () =>  "Agent joined session"               },
  agent_left:         { Icon: Zap,            badge: "bg-surface-2 text-fg-subtle",         label: () =>  "Agent left session"                 },
  briefing_generated: { Icon: FileText,       badge: "bg-cyan-500/10 text-cyan-500",        label: () =>  "Daily briefing generated"           },
  notification_sent:  { Icon: Bell,           badge: "bg-orange-500/10 text-orange-500",    label: (p) => `Notified ${p.destination}`         },
};

function fmtTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).format(new Date(iso));
  } catch { return iso; }
}

function EventRow({ event }: { event: ActivityEvent }) {
  const cfg = CFG[event.type] ?? CFG.tool_called;
  const { Icon } = cfg;

  return (
    <li className="flex items-start gap-2.5 px-3 py-2 hover:bg-surface-2/50 transition-[background-color] duration-100 rounded-lg">
      <span
        className={`shrink-0 w-5 h-5 rounded flex items-center justify-center mt-px ${cfg.badge}`}
        aria-hidden="true"
      >
        <Icon className="w-2.5 h-2.5" aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-fg leading-snug line-clamp-2">
          {cfg.label(event.payload)}
        </p>
        <time
          dateTime={event.timestamp}
          className="text-[10px] text-fg-subtle tabular mt-0.5 block"
        >
          {fmtTime(event.timestamp)}
        </time>
      </div>
    </li>
  );
}

export function ActivityFeed({ events, fillHeight = false }: Props) {
  return (
    <section
      aria-label="Activity Log"
      className={[
        "card rounded-xl flex flex-col overflow-hidden",
        fillHeight ? "h-full" : "",
      ].join(" ")}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-3/50 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-fg">Activity</h2>
          {fillHeight && (
            <p className="text-[11px] text-fg-muted mt-0.5">Live stream of assistant and tool events</p>
          )}
        </div>
        {events.length > 0 && (
          <span
            className="dot bg-emerald-500 motion-safe:animate-pulse-slow"
            aria-hidden="true"
          />
        )}
      </div>

      <ScrollArea className={fillHeight ? "flex-1 min-h-0" : "max-h-52"}>
        <ul
          className="py-1"
          aria-live="polite"
          aria-atomic="false"
          aria-relevant="additions"
          aria-label="Activity events"
        >
          {events.length === 0 ? (
            <li className="text-xs text-fg-subtle text-center py-10 list-none">
              Actions appear here in real time…
            </li>
          ) : (
            events.map((e, i) => <EventRow key={`${e.timestamp}-${i}`} event={e} />)
          )}
        </ul>
      </ScrollArea>
    </section>
  );
}
