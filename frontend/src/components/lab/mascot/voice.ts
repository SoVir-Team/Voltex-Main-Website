"use client";

import LINES from "./lines.json";

export type Mood = "idle" | "talking" | "happy" | "celebrate" | "worried" | "thinking" | "sleeping";
export interface Line {
  id: string;
  mood: Mood;
  text: string;
}

export const LINE_BY_ID = new Map((LINES as Line[]).map((l) => [l.id, l]));

type Manifest = Record<string, { file: string; duration: number }>;

/**
 * Plays Volta's pre-rendered lines and exposes a live loudness level for lip-sync. Audio is only created after a
 * user gesture (browsers block it before that); without audio, or with voice off, lines still run on a timer so
 * the captions and mouth keep their rhythm.
 */
export class VoicePlayer {
  private manifest: Manifest | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private buf = new Uint8Array(256);
  private audio: HTMLAudioElement | null = null;
  private timer = 0;
  private fakeUntil = 0;
  private enabled = true;

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.stop();
  }

  async load() {
    try {
      const res = await fetch("/lab/voice/manifest.json", { cache: "force-cache" });
      if (res.ok) this.manifest = (await res.json()) as Manifest;
    } catch {
      this.manifest = null;
    }
  }

  /** Call from a click or key handler. */
  unlock() {
    if (this.ctx || typeof window === "undefined") return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.connect(this.ctx.destination);
  }

  get unlocked() {
    return this.ctx !== null;
  }

  stop() {
    window.clearTimeout(this.timer);
    this.fakeUntil = 0;
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
  }

  /** Resolves when the line has finished. */
  play(id: string): Promise<void> {
    this.stop();
    const line = LINE_BY_ID.get(id);
    const entry = this.manifest?.[id];
    const fallbackMs = entry ? entry.duration * 1000 : Math.max(1800, (line?.text.length ?? 40) * 62);
    const timed = () =>
      new Promise<void>((resolve) => {
        this.fakeUntil = performance.now() + fallbackMs;
        this.timer = window.setTimeout(() => {
          this.fakeUntil = 0;
          resolve();
        }, fallbackMs);
      });
    if (!this.enabled || !entry || !this.ctx || !this.analyser) return timed();
    return new Promise<void>((resolve) => {
      const audio = new Audio(`/lab/voice/${entry.file}`);
      audio.crossOrigin = "anonymous";
      this.audio = audio;
      try {
        const src = this.ctx!.createMediaElementSource(audio);
        src.connect(this.analyser!);
      } catch {
        // Already connected or unsupported: plays without lip-sync.
      }
      const done = () => {
        if (this.audio === audio) this.audio = null;
        resolve();
      };
      audio.onended = done;
      audio.onerror = () => timed().then(done);
      void this.ctx!.resume();
      audio.play().catch(() => timed().then(done));
    });
  }

  /** 0..1 mouth opening right now. */
  level(): number {
    if (this.audio && this.analyser) {
      this.analyser.getByteTimeDomainData(this.buf);
      let sum = 0;
      for (let i = 0; i < this.buf.length; i++) {
        const v = (this.buf[i] - 128) / 128;
        sum += v * v;
      }
      return Math.min(1, Math.sqrt(sum / this.buf.length) * 5);
    }
    if (this.fakeUntil > performance.now()) return 0.35 + 0.35 * Math.sin(performance.now() / 70) * Math.sin(performance.now() / 190);
    return 0;
  }
}
