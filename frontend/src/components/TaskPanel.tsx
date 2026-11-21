import { CheckCircle2, Circle, Clock, AlertCircle, Tag, MessageCircle } from "lucide-react";
import type { Task, TaskPriority, TaskStatus } from "../types";
import { ScrollArea }  from "./ui/scroll-area";
import { Collapsible } from "./ui/collapsible";
import { Tooltip }     from "./ui/tooltip";
import { Separator }   from "./ui/separator";

interface Props { tasks: Task[] }

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(iso));
  } catch { return iso; }
}

function isOverdue(iso: string | null): boolean {
  return !!iso && new Date(iso) < new Date();
}

// ── Config ─────────────────────────────────────────────────────────────────

const PRIORITY_DOT: Record<TaskPriority, string> = {
  critical: "bg-red-500", high: "bg-orange-400", medium: "bg-yellow-400", low: "bg-fg-subtle",
};
const PRIORITY_LABEL: Record<TaskPriority, string> = {
  critical: "P0", high: "P1", medium: "P2", low: "P3",
};
const PRIORITY_TOOLTIP: Record<TaskPriority, string> = {
  critical: "P0 · Critical", high: "P1 · High", medium: "P2 · Medium", low: "P3 · Low",
};
const PRIORITY_TEXT: Record<TaskPriority, string> = {
  critical: "text-red-400", high: "text-orange-400", medium: "text-yellow-500", low: "text-fg-subtle",
};
const STATUS_ICON: Record<TaskStatus, { el: React.ReactElement; tip: string }> = {
  pending:     { el: <Circle      className="w-3.5 h-3.5 text-fg-subtle"    aria-hidden="true" />, tip: "Pending"     },
  in_progress: { el: <Clock       className="w-3.5 h-3.5 text-accent"       aria-hidden="true" />, tip: "In Progress" },
  completed:   { el: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />, tip: "Completed"   },
  blocked:     { el: <AlertCircle  className="w-3.5 h-3.5 text-red-500"     aria-hidden="true" />, tip: "Blocked"     },
};

// ── Task Row ───────────────────────────────────────────────────────────────

function TaskRow({ task, isNew }: { task: Task; isNew: boolean }) {
  const over = isOverdue(task.due_date) && task.status !== "completed";
  const dim  = task.status === "completed";
  const st   = STATUS_ICON[task.status];

  return (
    <li
      className={[
        "flex items-start gap-3 px-3 py-2.5 rounded-lg",
        "transition-[background-color] duration-100 hover:bg-surface-2/70",
        isNew ? "ring-1 ring-accent/40 bg-accent-subtle" : "",
        dim   ? "opacity-40" : "",
      ].join(" ")}
      aria-label={`${task.id}: ${task.title}, ${st.tip}, Priority ${PRIORITY_LABEL[task.priority]}`}
    >
      {/* Status icon with tooltip */}
      <Tooltip content={st.tip} side="right">
        <span className="mt-[1px] shrink-0 cursor-default" aria-label={st.tip}>
          {st.el}
        </span>
      </Tooltip>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 justify-between">
          <p className="text-sm text-fg leading-snug truncate [text-wrap:pretty]">
            {task.title}
          </p>

          {/* Priority badge with tooltip */}
          <Tooltip content={PRIORITY_TOOLTIP[task.priority]} side="left">
            <span
              className={`flex items-center gap-1 shrink-0 text-[11px] font-semibold tabular cursor-default ${PRIORITY_TEXT[task.priority]}`}
              aria-label={PRIORITY_TOOLTIP[task.priority]}
            >
              <span className={`dot ${PRIORITY_DOT[task.priority]}`} aria-hidden="true" />
              {PRIORITY_LABEL[task.priority]}
            </span>
          </Tooltip>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2.5 mt-1 flex-wrap">
          <span className="text-[11px] text-fg-subtle font-mono tabular" translate="no">{task.id}</span>
          {task.due_date && (
            <span className={`text-[11px] tabular ${over ? "text-red-400" : "text-fg-muted"}`}>
              {over ? "Overdue · " : ""}
              <time dateTime={task.due_date}>{fmtDate(task.due_date)}</time>
            </span>
          )}
          {task.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="flex items-center gap-0.5 text-[10px] text-fg-subtle">
              <Tag className="w-2.5 h-2.5" aria-hidden="true" />
              {tag}
            </span>
          ))}
        </div>
      </div>
    </li>
  );
}

// ── Task Panel ─────────────────────────────────────────────────────────────

export function TaskPanel({ tasks }: Props) {
  const active   = tasks.filter((t) => t.status !== "completed");
  const done     = tasks.filter((t) => t.status === "completed");
  const critical = active.filter((t) => t.priority === "critical");

  return (
    <section aria-label="My Tasks" className="card rounded-xl flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-3/50 shrink-0">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-semibold text-fg">Tasks</h2>
          <span className="text-[11px] tabular text-fg-muted font-medium">{active.length} open</span>
        </div>
        {critical.length > 0 && (
          <Tooltip content={`${critical.length} critical task${critical.length > 1 ? "s" : ""} require attention`}>
            <span
              className="flex items-center gap-1 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded font-medium cursor-default"
              aria-label={`${critical.length} critical`}
            >
              <AlertCircle className="w-3 h-3" aria-hidden="true" />
              {critical.length} critical
            </span>
          </Tooltip>
        )}
      </div>

      {/* Column labels */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-surface-3/30 bg-surface-2/30 shrink-0">
        <span className="text-[10px] text-fg-subtle uppercase tracking-wide font-medium w-3.5 shrink-0" aria-hidden="true">St</span>
        <span className="text-[10px] text-fg-subtle uppercase tracking-wide font-medium flex-1">Title</span>
        <span className="text-[10px] text-fg-subtle uppercase tracking-wide font-medium shrink-0">Pri</span>
      </div>

      {/* Voice hint */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-surface-3/20 shrink-0">
        <MessageCircle className="w-3 h-3 text-fg-subtle shrink-0" aria-hidden="true" />
        <p className="text-[11px] text-fg-subtle italic">
          "Create a P0 task to fix the payment gateway timeout"
        </p>
      </div>

      {/* Task list — Radix ScrollArea for consistent cross-browser scrollbar */}
      <ScrollArea className="flex-1 min-h-0">
        {active.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <CheckCircle2 className="w-7 h-7 text-fg-subtle" aria-hidden="true" />
            <p className="text-sm text-fg-muted">No open tasks</p>
            <p className="text-xs text-fg-subtle">Ask the assistant to create one</p>
          </div>
        ) : (
          <ul className="px-1 py-1 space-y-0.5" aria-label="Open tasks">
            {active.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                isNew={Date.now() - new Date(t.created_at).getTime() < 12_000}
              />
            ))}
          </ul>
        )}

        {done.length > 0 && (
          <>
            <Separator className="mx-3" />
            {/* Radix Collapsible for completed tasks — animated + proper aria */}
            <Collapsible triggerLabel={`${done.length} completed`} className="px-1 pb-2">
              <ul className="space-y-0.5" aria-label="Completed tasks">
                {done.map((t) => (
                  <TaskRow key={t.id} task={t} isNew={false} />
                ))}
              </ul>
            </Collapsible>
          </>
        )}
      </ScrollArea>
    </section>
  );
}
