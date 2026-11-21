import {
  LayoutDashboard,
  ClipboardList,
  AlertOctagon,
  CheckSquare,
  CalendarPlus,
  BookOpen,
  MessageSquare,
  ShieldAlert,
  Mic,
  type LucideIcon,
} from "lucide-react";
import { Separator } from "./ui/separator";

interface Scenario {
  Icon:  LucideIcon;
  label: string;
  cmd:   string;
}

const SCENARIOS: Scenario[] = [
  { Icon: LayoutDashboard, label: "Daily briefing",       cmd: "Give me my daily briefing"                      },
  { Icon: ClipboardList,   label: "List tasks",           cmd: "What tasks do I have today?"                    },
  { Icon: AlertOctagon,    label: "Create critical task", cmd: "Create a P0 task: fix payment gateway timeout"  },
  { Icon: CheckSquare,     label: "Update status",        cmd: "Mark TASK-001 as completed"                     },
  { Icon: CalendarPlus,    label: "Schedule meeting",     cmd: "Schedule sprint planning tomorrow at 10 am and invite alex@example.com" },
  { Icon: BookOpen,        label: "Look up policy",       cmd: "What is the work from home policy?"             },
  { Icon: MessageSquare,   label: "Notify colleague",     cmd: "Notify Priya I will be late to standup"         },
  { Icon: ShieldAlert,     label: "Incident process",     cmd: "What is the incident response process?"         },
];

export function DemoScenarios() {
  return (
    <section aria-label="Sample Voice Commands" className="card rounded-xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-3/50">
        <div className="flex items-center gap-2">
          <Mic className="w-3.5 h-3.5 text-fg-muted" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-fg">Voice Commands</h2>
        </div>
        <span className="text-[10px] text-fg-subtle uppercase tracking-wide font-medium">
          Try saying…
        </span>
      </div>

      {/* Command rows */}
      <ul aria-label="Example voice commands">
        {SCENARIOS.map((s, i) => (
          <li key={s.cmd}>
            <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-surface-2/50 transition-[background-color] duration-100">
              {/* Icon */}
              <span
                className="shrink-0 mt-[1px] w-5 h-5 rounded bg-surface-2 border border-surface-3/50 flex items-center justify-center"
                aria-hidden="true"
              >
                <s.Icon className="w-3 h-3 text-fg-muted" aria-hidden="true" />
              </span>

              {/* Label + command */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-fg-subtle uppercase tracking-wide font-medium leading-none mb-0.5">
                  {s.label}
                </p>
                <p className="text-xs text-fg-muted leading-snug">
                  &ldquo;{s.cmd}&rdquo;
                </p>
              </div>
            </div>
            {i < SCENARIOS.length - 1 && (
              <Separator className="mx-4" />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
