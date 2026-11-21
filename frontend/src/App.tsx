import { useState, useCallback, useEffect, useId } from "react";
import { Header, type AppTab } from "./components/Header";
import { VoiceButton }         from "./components/VoiceButton";
import { TaskPanel }           from "./components/TaskPanel";
import { MeetingPanel }        from "./components/MeetingPanel";
import { ActivityFeed }        from "./components/ActivityFeed";
import { DemoScenarios }       from "./components/DemoScenarios";
import { OverviewDashboard }   from "./components/OverviewDashboard";
import { useAgora }            from "./hooks/useAgora";
import { useRealtime }         from "./hooks/useRealtime";
import { useTheme }            from "./hooks/useTheme";
import { fetchDashboard }      from "./services/api";
import { TooltipProvider }     from "./components/ui/tooltip";
import { ToastProvider, useToast } from "./components/ui/toast";
import { Tabs, TabsContent }   from "./components/ui/tabs";
import type {
  VoiceSessionStatus, DashboardData, ActivityEvent, Task, Meeting, GoogleCalendarStatus,
} from "./types";

function AppInner() {
  const { addToast } = useToast();
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<AppTab>("workspace");
  const [voiceStatus, setVoiceStatus] = useState<VoiceSessionStatus>("idle");
  const [dashboard,   setDashboard]   = useState<DashboardData | null>(null);
  const [tasks,       setTasks]       = useState<Task[]>([]);
  const [meetings,    setMeetings]    = useState<Meeting[]>([]);
  const [activity,    setActivity]    = useState<ActivityEvent[]>([]);
  const [googleCal,   setGoogleCal]   = useState<GoogleCalendarStatus | null>(null);
  const statusRegionId = useId();

  const loadDashboard = useCallback(() => {
    fetchDashboard()
      .then((d) => {
        setDashboard(d);
        setTasks(d.tasks);
        setMeetings(d.meetings);
        setActivity(d.activity);
        setGoogleCal(d.google_calendar ?? null);
      })
      .catch(console.error);
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const syncCalendar = useCallback(async () => {
    try {
      const res = await fetch("/api/google/sync", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { meetings?: Meeting[] };
      if (data.meetings) setMeetings(data.meetings);
      addToast({ title: "Calendar synced", description: "Pulled latest Google Calendar events", variant: "calendar" });
    } catch (err) {
      console.error(err);
      addToast({ title: "Sync failed", description: "Could not refresh Google Calendar", variant: "error" });
    }
  }, [addToast]);

  const handleEvent = useCallback((event: ActivityEvent) => {
    setActivity((prev) => [event, ...prev].slice(0, 50));

    if (event.type === "task_created") {
      const t = event.payload as unknown as Task;
      setTasks((prev) => prev.find((x) => x.id === t.id) ? prev : [t, ...prev]);
      addToast({ title: "Task Created", description: `${String(t.id)} — ${String(t.title)}`, variant: "success" });
    }
    if (event.type === "task_updated") {
      const t = event.payload as unknown as Task;
      setTasks((prev) => prev.map((x) => x.id === t.id ? t : x));
      addToast({ title: "Task Updated", description: `${String(t.id)} → ${String(t.status)}`, variant: "default" });
    }
    if (event.type === "meeting_scheduled") {
      const m = event.payload as unknown as Meeting;
      setMeetings((prev) => {
        const without = prev.filter((x) => x.id !== m.id);
        return [m, ...without];
      });
      addToast({ title: "Meeting Scheduled", description: String(m.title), variant: "calendar" });
    }
    if (event.type === "meeting_updated") {
      const m = event.payload as unknown as Meeting;
      setMeetings((prev) => {
        const exists = prev.some((x) => x.id === m.id);
        return exists ? prev.map((x) => (x.id === m.id ? m : x)) : [m, ...prev];
      });
      addToast({ title: "Meeting Updated", description: String(m.title), variant: "calendar" });
    }
    if (event.type === "meeting_deleted") {
      const id = String(event.payload.id ?? "");
      setMeetings((prev) => prev.filter((x) => x.id !== id));
      addToast({
        title: "Meeting Deleted",
        description: String(event.payload.title ?? id),
        variant: "warning",
      });
    }
    if (event.type === "calendar_synced") {
      const list = event.payload.meetings as Meeting[] | undefined;
      if (Array.isArray(list)) setMeetings(list);
      addToast({
        title: "Calendar synced",
        description: `${String(event.payload.count ?? list?.length ?? 0)} events`,
        variant: "calendar",
      });
    }
    if (event.type === "briefing_generated") {
      addToast({ title: "Daily Briefing Ready", description: String(event.payload.summary ?? ""), variant: "default" });
    }
    if (event.type === "notification_sent") {
      addToast({ title: "Notification Sent", description: `To ${String(event.payload.destination ?? "")}`, variant: "default" });
    }
  }, [addToast]);

  const { connected: wsConnected } = useRealtime(handleEvent);
  const handleStatusChange = useCallback((s: VoiceSessionStatus) => setVoiceStatus(s), []);
  const {
    startSession, stopSession, toggleMute, interrupt, isMuted,
    audioLevel, isUserSpeaking,
  } = useAgora(handleStatusChange);

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as AppTab)}
      className="app-shell h-dvh flex flex-col overflow-hidden"
    >
      <Header
        employee={dashboard?.employee ?? null}
        wsConnected={wsConnected}
        voiceStatus={voiceStatus}
        statusRegionId={statusRegionId}
        theme={theme}
        onThemeChange={setTheme}
      />

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {voiceStatus === "idle"       && "Voice assistant ready."}
        {voiceStatus === "connecting" && "Connecting to voice session…"}
        {voiceStatus === "connected"  && "Voice session started. Listening."}
        {voiceStatus === "speaking"   && "Assistant is responding."}
        {voiceStatus === "listening"  && "Listening for your command."}
        {voiceStatus === "processing" && "Processing your request…"}
        {voiceStatus === "error"      && "Voice session error. Please retry."}
      </div>

      <main
        id="main-content"
        className="flex-1 min-h-0 p-4 md:p-5 max-w-7xl mx-auto w-full overflow-hidden"
        tabIndex={-1}
      >
        <TabsContent value="workspace" className="h-full data-[state=inactive]:hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_1fr] gap-4 panel-shell">
            <div className="flex flex-col gap-4 min-h-0 overflow-auto lg:overflow-hidden">
              <div className="card rounded-xl overflow-hidden shrink-0">
                <div className="px-4 py-3 border-b border-surface-3/50">
                  <h2 className="text-sm font-semibold text-fg">Voice Session</h2>
                </div>
                <div className="p-4">
                  <VoiceButton
                    status={voiceStatus}
                    isMuted={isMuted}
                    audioLevel={audioLevel}
                    isUserSpeaking={isUserSpeaking}
                    onStart={startSession}
                    onStop={stopSession}
                    onToggleMute={toggleMute}
                    onInterrupt={interrupt}
                  />
                </div>
              </div>
              <div className="shrink-0 lg:flex-1 lg:min-h-0 lg:overflow-auto">
                <DemoScenarios />
              </div>
            </div>

            <div className="min-h-0 h-full flex flex-col">
              <TaskPanel tasks={tasks} />
            </div>

            <div className="min-h-0 h-full flex flex-col">
              <MeetingPanel meetings={meetings} google={googleCal} onSync={syncCalendar} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="h-full data-[state=inactive]:hidden">
          <div className="panel-shell max-w-2xl h-full">
            <ActivityFeed events={activity} fillHeight />
          </div>
        </TabsContent>

        <TabsContent value="overview" className="h-full data-[state=inactive]:hidden overflow-auto">
          <OverviewDashboard
            tasks={tasks}
            meetings={meetings}
            activity={activity}
            google={googleCal}
            employeeName={dashboard?.employee?.name}
          />
        </TabsContent>
      </main>

      <footer className="shrink-0 text-center py-2.5 text-[11px] text-fg-subtle border-t border-surface-3/60 bg-transparent">
        WorkplaceAI
      </footer>
    </Tabs>
  );
}

export default function App() {
  return (
    <TooltipProvider delayDuration={400}>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </TooltipProvider>
  );
}
