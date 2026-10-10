"use client";

/**
 * Tiny WebAudio "ding" for live admin alerts (new support ticket / customer
 * chat message). No audio assets, no dependencies — a two-tone sine beep.
 * Best-effort: silently does nothing when the browser blocks audio.
 */

let context: AudioContext | null = null;

export function playAdminAlertSound(): void {
  try {
    if (typeof window === "undefined") return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    if (!context) context = new Ctor();
    if (context.state === "suspended") void context.resume();

    const now = context.currentTime;
    const beep = (frequency: number, start: number, duration: number) => {
      const osc = context!.createOscillator();
      const gain = context!.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(context!.destination);
      osc.start(start);
      osc.stop(start + duration);
    };
    beep(880, now, 0.12);
    beep(1320, now + 0.14, 0.2);
  } catch {
    // Audio unavailable — the visual toast still fires.
  }
}
