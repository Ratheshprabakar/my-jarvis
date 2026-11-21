import { Mic2, Radio, Sun, Moon, LayoutDashboard, Briefcase, Activity } from "lucide-react";
import type { Employee, VoiceSessionStatus } from "../types";
import type { ThemeMode } from "../hooks/useTheme";
import { Avatar }  from "./ui/avatar";
import { Tooltip } from "./ui/tooltip";
import { TabsList, TabsTrigger } from "./ui/tabs";
import { Switch } from "./ui/switch";

export type AppTab = "workspace" | "activity" | "overview";

interface Props {
  employee: Employee | null;
  wsConnected: boolean;
  voiceStatus: VoiceSessionStatus;
  statusRegionId: string;
  theme: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
}

const TABS: { id: AppTab; label: string; Icon: typeof Briefcase }[] = [
  { id: "workspace", label: "Workspace", Icon: Briefcase },
  { id: "activity",  label: "Activity",  Icon: Activity },
  { id: "overview",  label: "Overview",  Icon: LayoutDashboard },
];

export function Header({
  employee, wsConnected, voiceStatus, statusRegionId,
  theme, onThemeChange,
}: Props) {
  const sessionActive = ["connected", "listening", "speaking", "processing"].includes(voiceStatus);

  const sessionLabel =
    voiceStatus === "idle"       ? "No active session"             :
    voiceStatus === "connecting" ? "Connecting…"                   :
    voiceStatus === "connected"  ? "Session active — listening"    :
    voiceStatus === "listening"  ? "Session active — listening"    :
    voiceStatus === "speaking"   ? "Session active — responding"   :
    voiceStatus === "processing" ? "Processing…"                   :
                                   "Connection error";

  return (
    <header className="app-header backdrop-blur sticky top-0 z-30 shrink-0">
      <div className="px-4 md:px-5 h-12 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-6 h-6 rounded bg-accent flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <Mic2 className="w-3.5 h-3.5 text-white" aria-hidden="true" />
          </div>
          <span className="text-sm font-semibold text-fg tracking-tight" translate="no">
            WorkplaceAI
          </span>
          <span className="hidden sm:inline text-[10px] text-fg-subtle font-medium px-1.5 py-0.5 rounded border border-surface-3/70 bg-surface-1">
            beta
          </span>
        </div>

        <div
          id={statusRegionId}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={[
            "hidden lg:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium",
            "transition-[background-color,color,border-color] duration-300 border",
            sessionActive
              ? "bg-accent-subtle border-accent-border text-accent"
              : "bg-surface-1 border-surface-3/60 text-fg-muted",
          ].join(" ")}
        >
          <span
            className={[
              "dot",
              sessionActive ? "bg-accent motion-safe:animate-pulse" : "bg-fg-subtle",
            ].join(" ")}
            aria-hidden="true"
          />
          {sessionLabel}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Tooltip content={theme === "dark" ? "Dark theme on" : "Light theme on"} side="bottom">
            <div className="flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-fg-subtle" aria-hidden="true" />
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(dark) => onThemeChange(dark ? "dark" : "light")}
                aria-label="Toggle dark theme"
              />
              <Moon className="w-3.5 h-3.5 text-fg-subtle" aria-hidden="true" />
            </div>
          </Tooltip>

          <Tooltip
            content={wsConnected ? "Real-time connected" : "Real-time disconnected — backend may be offline"}
            side="bottom"
          >
            <div
              className="flex items-center gap-1.5 cursor-default"
              aria-label={wsConnected ? "Real-time connected" : "Real-time offline"}
            >
              <Radio
                className={`w-3.5 h-3.5 ${wsConnected ? "text-emerald-500" : "text-fg-subtle"}`}
                aria-hidden="true"
              />
              <span className={`text-xs hidden sm:inline ${wsConnected ? "text-emerald-500" : "text-fg-subtle"}`}>
                {wsConnected ? "Live" : "Offline"}
              </span>
            </div>
          </Tooltip>

          {employee && (
            <div className="flex items-center gap-2 pl-3 border-l border-surface-3/50">
              <Avatar name={employee.name} size="sm" />
              <div className="hidden sm:block min-w-0">
                <p className="text-xs font-medium text-fg truncate leading-none">{employee.name}</p>
                <p className="text-[10px] text-fg-muted mt-0.5 truncate leading-none" translate="no">
                  {employee.team}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 md:px-5 pb-2.5">
        <TabsList aria-label="Primary">
          {TABS.map(({ id, label, Icon }) => (
            <TabsTrigger key={id} value={id}>
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </header>
  );
}
