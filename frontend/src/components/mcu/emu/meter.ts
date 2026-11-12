/**
 * Measures each output pin from its exact edge times (in CPU cycles): the level now, the fraction of time it was
 * high (PWM duty), its frequency and the width of the last high pulse (servo signals). Readings cover the window
 * since the previous report, so a 490 Hz PWM pin reports a steady duty every frame.
 */

export interface PinReading {
  level: 0 | 1;
  /** Fraction of the window spent high. */
  duty: number;
  /** Rising edges per second over the window, 0 when the pin did not toggle. */
  freq: number;
  /** Width of the last complete high pulse in seconds, 0 if none yet. */
  pulse: number;
}

interface Track {
  level: 0 | 1;
  since: number;
  high: number;
  rises: number;
  lastRise: number;
  pulse: number;
}

export class PinMeter {
  private tracks = new Map<string, Track>();
  private windowStart = 0;

  private readonly hz: number;

  constructor(hz: number) {
    this.hz = hz;
  }

  /** Record the level of `pin` at `cycle`. Repeated levels are ignored. */
  set(pin: string, level: 0 | 1, cycle: number) {
    const t = this.tracks.get(pin);
    if (!t) {
      this.tracks.set(pin, { level, since: cycle, high: 0, rises: level, lastRise: level ? cycle : -1, pulse: 0 });
      return;
    }
    if (t.level === level) return;
    if (t.level === 1) {
      t.high += cycle - Math.max(t.since, this.windowStart);
      if (t.lastRise >= 0) t.pulse = cycle - t.lastRise;
    } else {
      t.rises++;
      t.lastRise = cycle;
    }
    t.level = level;
    t.since = cycle;
  }

  level(pin: string): 0 | 1 {
    return this.tracks.get(pin)?.level ?? 0;
  }

  /** Readings for every pin seen so far, over the window ending at `cycle`; starts a new window. */
  report(cycle: number): Record<string, PinReading> {
    const span = Math.max(1, cycle - this.windowStart);
    const out: Record<string, PinReading> = {};
    for (const [pin, t] of this.tracks) {
      const high = t.high + (t.level ? cycle - Math.max(t.since, this.windowStart) : 0);
      out[pin] = {
        level: t.level,
        duty: Math.max(0, Math.min(1, high / span)),
        freq: (t.rises * this.hz) / span,
        pulse: t.pulse / this.hz,
      };
      t.high = 0;
      t.rises = 0;
    }
    this.windowStart = cycle;
    return out;
  }
}
