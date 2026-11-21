import { Mic, MicOff, PhoneOff, Loader2, Square } from "lucide-react";
import * as Toggle from "@radix-ui/react-toggle";
import type { VoiceSessionStatus } from "../types";
import { Tooltip } from "./ui/tooltip";

interface Props {
  status: VoiceSessionStatus;
  isMuted: boolean;
  audioLevel?: number;
  isUserSpeaking?: boolean;
  onStart: () => void;
  onStop: () => void;
  onToggleMute: () => void;
  onInterrupt?: () => void;
}

export function VoiceButton({
  status,
  isMuted,
  audioLevel = 0,
  isUserSpeaking = false,
  onStart,
  onStop,
  onToggleMute,
  onInterrupt,
}: Props) {
  const isActive     = ["connected", "listening", "speaking", "processing", "connecting"].includes(status);
  const isConnecting = status === "connecting";
  const isSpeaking   = status === "speaking";
  const isListening  = status === "listening" || status === "connected";
  const isError      = status === "error";
  const waveActive   = isSpeaking || isUserSpeaking;
  const waveColor    = isSpeaking
    ? "bg-accent"
    : isUserSpeaking
      ? "bg-emerald-400"
      : "bg-fg-subtle";

  const statusLabel =
    isConnecting ? "Connecting…" :
    isSpeaking   ? "Assistant responding" :
    isUserSpeaking ? "Hearing you…" :
    isListening  ? "Listening — speak now" :
    status === "processing" ? "Processing…" :
    "";

  return (
    <div className="w-full flex flex-col gap-3">
      {isActive ? (
        <div className="card rounded-xl overflow-hidden">
          <div
            className={[
              "h-[2px] transition-colors duration-200",
              isSpeaking ? "bg-accent" : isUserSpeaking ? "bg-emerald-400" : "bg-accent/40",
            ].join(" ")}
            aria-hidden="true"
          />

          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {isConnecting ? (
                  <Loader2 className="w-3.5 h-3.5 text-accent animate-spin shrink-0" aria-hidden="true" />
                ) : (
                  <span
                    className={[
                      "dot shrink-0",
                      isSpeaking
                        ? "bg-accent motion-safe:animate-pulse"
                        : isUserSpeaking
                          ? "bg-emerald-400 motion-safe:animate-pulse"
                          : "bg-accent motion-safe:animate-pulse",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                )}
                <span className="text-sm font-medium text-fg leading-none">
                  {statusLabel}
                </span>
              </div>

              {!isConnecting && (
                <div
                  className="flex items-end gap-[2px] h-5 shrink-0"
                  role="img"
                  aria-label={
                    isSpeaking ? "AI speaking" : isUserSpeaking ? "You speaking" : "Listening"
                  }
                >
                  {[...Array(8)].map((_, i) => {
                    // Live height from mic/agent volume; fall back to idle stubs
                    const phase = (i / 8) * Math.PI;
                    const live =
                      waveActive
                        ? Math.max(0.18, Math.min(1, audioLevel * (0.55 + 0.7 * Math.abs(Math.sin(phase + audioLevel * 8)))))
                        : 0.2 + (i % 3) * 0.05;
                    return (
                      <span
                        key={i}
                        className={[
                          "w-[3px] rounded-full origin-bottom transition-[height,background-color] duration-75",
                          waveColor,
                          waveActive && isSpeaking ? "motion-safe:animate-wave-bar" : "",
                        ].join(" ")}
                        style={{
                          height: `${Math.round(live * 100)}%`,
                          animationDelay: `${i * 0.09}s`,
                        }}
                        aria-hidden="true"
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {!isConnecting && (
                <Tooltip content={isMuted ? "Unmute microphone" : "Mute microphone"} side="top">
                  <Toggle.Root
                    pressed={isMuted}
                    onPressedChange={() => onToggleMute()}
                    aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
                    className={[
                      "touch-manip flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium",
                      "transition-[background-color,color,border-color] duration-150 border",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                      isMuted
                        ? "bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/15 data-[state=on]:bg-red-500/15"
                        : "bg-surface-2 border-surface-3/50 text-fg-muted hover:text-fg",
                    ].join(" ")}
                  >
                    {isMuted
                      ? <MicOff className="w-3.5 h-3.5" aria-hidden="true" />
                      : <Mic    className="w-3.5 h-3.5" aria-hidden="true" />}
                    {isMuted ? "Unmute" : "Mute"}
                  </Toggle.Root>
                </Tooltip>
              )}

              {!isConnecting && onInterrupt && (
                <Tooltip content="Stop the assistant mid-answer so you can ask again" side="top">
                  <button
                    type="button"
                    onClick={onInterrupt}
                    disabled={!isSpeaking && status !== "processing"}
                    aria-label="Stop assistant response"
                    className={[
                      "touch-manip flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border",
                      "transition-[background-color,opacity] duration-150",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                      isSpeaking || status === "processing"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                        : "bg-surface-2 border-surface-3/50 text-fg-subtle cursor-not-allowed",
                    ].join(" ")}
                  >
                    <Square className="w-3 h-3 fill-current" aria-hidden="true" />
                    Stop Answer
                  </button>
                </Tooltip>
              )}

              <Tooltip content={isConnecting ? "Cancel connection" : "End voice session"} side="top">
                <button
                  type="button"
                  onClick={onStop}
                  aria-label={isConnecting ? "Cancel connection" : "End voice session"}
                  className={[
                    "touch-manip ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium",
                    "bg-red-500/10 border border-red-500/25 text-red-400",
                    "hover:bg-red-500/20 transition-[background-color] duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40",
                  ].join(" ")}
                >
                  <PhoneOff className="w-3.5 h-3.5" aria-hidden="true" />
                  {isConnecting ? "Cancel" : "End Session"}
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onStart}
          aria-label="Start voice session"
          className={[
            "touch-manip w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl",
            "text-sm font-medium transition-[background-color,opacity] duration-150 border",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
            isError
              ? "bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/15"
              : "bg-accent border-accent hover:bg-accent-dark text-white",
          ].join(" ")}
        >
          <Mic className="w-4 h-4" aria-hidden="true" />
          {isError ? "Retry Voice Session" : "Start Voice Session"}
        </button>
      )}

      {status === "idle" && (
        <p className="text-xs text-fg-subtle text-center leading-relaxed">
          Click start, allow mic access, then speak your question and pause
        </p>
      )}
      {isListening && !isUserSpeaking && (
        <p className="text-xs text-fg-muted text-center leading-relaxed">
          Green bars = you speaking. Accent bars = assistant answering. Pause briefly after your question.
        </p>
      )}
      {isUserSpeaking && (
        <p className="text-xs text-emerald-500/80 text-center leading-relaxed">
          Hearing you — pause when finished so the assistant can reply.
        </p>
      )}
      {isSpeaking && (
        <p className="text-xs text-fg-muted text-center leading-relaxed">
          Talk over the assistant or tap Stop Answer to interrupt and ask something new.
        </p>
      )}
      {isError && (
        <p className="text-xs text-red-400/80 text-center">
          Agent failed — end the session and retry. Check backend logs if it keeps failing.
        </p>
      )}
    </div>
  );
}
