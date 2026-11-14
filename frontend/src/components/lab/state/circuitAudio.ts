import { propertyValue } from "../engine/properties.ts";
import type { SimSnapshot } from "../engine/solver.ts";
import type { Board } from "../engine/types.ts";

/** Independent of narration; one quiet oscillator per electrically active buzzer. */
export class CircuitAudio {
  private context: AudioContext | null = null;
  private tones = new Map<string, { oscillator: OscillatorNode; gain: GainNode }>();

  unlock() {
    if (typeof window === "undefined") return;
    try {
      if (!this.context) {
        const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Constructor) return;
        this.context = new Constructor();
      }
      void this.context.resume().catch(() => {});
    } catch { /* Visual simulation works when audio is unavailable. */ }
  }

  update(board: Board, snapshot: SimSnapshot | null, enabled: boolean) {
    const context = this.context;
    const active = enabled && snapshot ? board.parts.filter((p) => p.type === "buzzer" && snapshot.parts[p.id]?.on && !snapshot.parts[p.id]?.burnt && !snapshot.parts[p.id]?.reversed) : [];
    const ids = new Set(active.map((p) => p.id));
    for (const [id, tone] of this.tones) {
      if (ids.has(id)) continue;
      tone.oscillator.stop();
      tone.oscillator.disconnect();
      tone.gain.disconnect();
      this.tones.delete(id);
    }
    if (!context || context.state !== "running") return;
    for (const part of active) {
      let tone = this.tones.get(part.id);
      if (!tone) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        gain.gain.value = 0.035;
        oscillator.type = "square";
        oscillator.connect(gain);
        gain.connect(context.destination);
        tone = { oscillator, gain };
        this.tones.set(part.id, tone);
        oscillator.frequency.value = propertyValue(part, "frequency");
        oscillator.start();
      }
      tone.oscillator.frequency.setTargetAtTime(propertyValue(part, "frequency"), context.currentTime, 0.01);
      tone.gain.gain.setTargetAtTime(0.035 / Math.max(1, active.length), context.currentTime, 0.01);
    }
  }

  dispose() {
    for (const tone of this.tones.values()) {
      tone.oscillator.stop();
      tone.oscillator.disconnect();
      tone.gain.disconnect();
    }
    this.tones.clear();
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
  }
}
