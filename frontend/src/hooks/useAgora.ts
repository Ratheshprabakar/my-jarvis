/**
 * Agora RTC hook.
 *
 * Manages:
 *   • Joining / leaving an RTC channel (user audio)
 *   • Starting / stopping the Conversational AI agent via the backend
 *   • Local + remote volume levels for the UI waveform
 */
import { useCallback, useRef, useState } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  ILocalAudioTrack,
  IRemoteAudioTrack,
  UID,
} from "agora-rtc-sdk-ng";
import { fetchToken, startAgent, stopAgent, interruptAgent } from "../services/api";
import type { VoiceSessionStatus } from "../types";

AgoraRTC.setLogLevel(1);

const CHANNEL = "workplace-assistant";
const AGENT_UID = 10001;

function sameUid(a: UID, b: number | string): boolean {
  return String(a) === String(b);
}

/** Fresh UID each session — avoids UID_CONFLICT from stale tabs / half-closed joins. */
function newUserUid(): number {
  // Keep out of agent UID and avoid 0 (local volume-indicator sentinel)
  let uid = 0;
  while (uid === 0 || uid === AGENT_UID) {
    uid = Math.floor(2 + Math.random() * 2_000_000_000);
  }
  return uid;
}

export function useAgora(onStatusChange: (s: VoiceSessionStatus) => void) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioRef = useRef<ILocalAudioTrack | null>(null);
  const remoteAudioRef = useRef<IRemoteAudioTrack | null>(null);
  const agentIdRef = useRef<string | null>(null);
  const userUidRef = useRef<number>(1);
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);

  const clearStatusPoll = () => {
    if (statusPollRef.current) {
      clearInterval(statusPollRef.current);
      statusPollRef.current = null;
    }
  };

  const clearLevelPoll = () => {
    if (levelPollRef.current) {
      clearInterval(levelPollRef.current);
      levelPollRef.current = null;
    }
  };

  const teardownRtc = async () => {
    clearStatusPoll();
    clearLevelPoll();

    if (localAudioRef.current) {
      try {
        localAudioRef.current.stop();
        localAudioRef.current.close();
      } catch { /* already closed */ }
      localAudioRef.current = null;
    }
    remoteAudioRef.current = null;

    if (clientRef.current) {
      try {
        clientRef.current.removeAllListeners();
        await clientRef.current.leave();
      } catch { /* already left */ }
      clientRef.current = null;
    }
  };

  const startLevelPoll = () => {
    clearLevelPoll();
    levelPollRef.current = setInterval(() => {
      const local = localAudioRef.current?.getVolumeLevel() ?? 0;
      const remote = remoteAudioRef.current?.getVolumeLevel() ?? 0;
      setAudioLevel(Math.max(local, remote * 0.9));
      setIsUserSpeaking(local > 0.05);
      if (remote > 0.04) onStatusChange("speaking");
      else if (remote < 0.01 && local < 0.05) onStatusChange("listening");
    }, 80);
  };

  const watchAgentHealth = useCallback(
    (agentId: string) => {
      clearStatusPoll();
      let ticks = 0;
      statusPollRef.current = setInterval(async () => {
        ticks += 1;
        if (ticks > 40) {
          clearStatusPoll();
          return;
        }
        try {
          const res = await fetch(`/api/agora/agent/${agentId}/status`);
          if (!res.ok) return;
          const data = (await res.json()) as { status?: string; message?: string };
          if (data.status === "FAILED" || data.status === "STOPPED") {
            console.error("[useAgora] Agent died →", data.status, data.message);
            clearStatusPoll();
            onStatusChange("error");
          }
        } catch {
          /* ignore transient poll errors */
        }
      }, 3000);
    },
    [onStatusChange],
  );

  const startSession = useCallback(async () => {
    try {
      onStatusChange("connecting");
      setAudioLevel(0);
      setIsUserSpeaking(false);

      // Drop any leftover client from a previous attempt (prevents UID_CONFLICT)
      if (agentIdRef.current) {
        try {
          await stopAgent(agentIdRef.current, CHANNEL);
        } catch { /* ignore */ }
        agentIdRef.current = null;
      }
      await teardownRtc();

      const userUid = newUserUid();
      userUidRef.current = userUid;

      const { token, app_id } = await fetchToken(CHANNEL, userUid);

      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      client.enableAudioVolumeIndicator();
      client.on("volume-indicator", (volumes) => {
        let local = 0;
        let remote = 0;
        for (const v of volumes) {
          const level = (v.level ?? 0) / 100;
          if (v.uid === 0 || sameUid(v.uid, userUidRef.current)) {
            local = Math.max(local, level);
          } else {
            remote = Math.max(remote, level);
          }
        }
        setAudioLevel(Math.max(local, remote * 0.85));
        setIsUserSpeaking(local > 0.08);
        if (remote > 0.06) onStatusChange("speaking");
      });

      client.on("user-published", async (user, mediaType) => {
        if (mediaType !== "audio") return;
        const isAgent = sameUid(user.uid, AGENT_UID);
        if (!isAgent && client.remoteUsers.length > 1) return;

        await client.subscribe(user, "audio");
        const remoteTrack = user.audioTrack as IRemoteAudioTrack;
        remoteAudioRef.current = remoteTrack;
        remoteTrack.play();
        console.info("[useAgora] Subscribed to remote audio uid=", user.uid);
        onStatusChange("speaking");
      });

      client.on("user-unpublished", (user) => {
        if (sameUid(user.uid, AGENT_UID) || remoteAudioRef.current) {
          remoteAudioRef.current = null;
          onStatusChange("listening");
        }
      });

      client.on("user-joined", (user) => {
        console.info("[useAgora] Remote user joined uid=", user.uid);
      });

      client.on("user-left", (user) => {
        console.info("[useAgora] Remote user left uid=", user.uid);
        if (sameUid(user.uid, AGENT_UID)) onStatusChange("listening");
      });

      await client.join(app_id, CHANNEL, token ?? null, userUid);

      const localAudio = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: "speech_standard",
      });
      localAudioRef.current = localAudio;
      await client.publish(localAudio);
      startLevelPoll();

      onStatusChange("listening");

      const { agent_id } = await startAgent(CHANNEL, userUid);
      agentIdRef.current = agent_id;
      console.info("[useAgora] Agent started", agent_id, "userUid", userUid);
      watchAgentHealth(agent_id);
    } catch (err: unknown) {
      const detail =
        err instanceof Error
          ? `${err.name}: ${err.message}`
          : JSON.stringify(err);
      console.error("[useAgora] Session start failed →", detail, err);
      await teardownRtc();
      onStatusChange("error");
    }
  }, [onStatusChange, watchAgentHealth]);

  const stopSession = useCallback(async () => {
    try {
      if (agentIdRef.current) {
        try {
          await stopAgent(agentIdRef.current, CHANNEL);
        } catch (err) {
          console.warn("[useAgora] Agent stop warning:", err);
        }
        agentIdRef.current = null;
      }
      await teardownRtc();
      setAudioLevel(0);
      setIsUserSpeaking(false);
      setIsMuted(false);
      onStatusChange("idle");
    } catch (err) {
      console.error("Session stop error:", err);
      onStatusChange("idle");
    }
  }, [onStatusChange]);

  const toggleMute = useCallback(async () => {
    if (!localAudioRef.current) return;
    const muted = !isMuted;
    await localAudioRef.current.setMuted(muted);
    setIsMuted(muted);
  }, [isMuted]);

  const interrupt = useCallback(async () => {
    if (!agentIdRef.current) return;
    try {
      await interruptAgent(agentIdRef.current, CHANNEL);
      onStatusChange("listening");
    } catch (err) {
      console.error("[useAgora] Interrupt failed →", err);
    }
  }, [onStatusChange]);

  return {
    startSession,
    stopSession,
    toggleMute,
    interrupt,
    isMuted,
    audioLevel,
    isUserSpeaking,
  };
}
