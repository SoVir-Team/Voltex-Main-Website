import { test } from "node:test";
import assert from "node:assert/strict";
import { CircuitAudio } from "./circuitAudio.ts";
import type { Board } from "../engine/types.ts";
import type { SimSnapshot } from "../engine/solver.ts";

test("circuit audio unlocks on gesture, follows buzzers, retunes, mutes, and cleans up", () => {
  let started = 0, stopped = 0, disconnected = 0, closed = 0, frequency = 0;
  class Context {
    state = "running";
    currentTime = 0;
    destination = {};
    resume() { return Promise.resolve(); }
    close() { closed++; return Promise.resolve(); }
    createOscillator() {
      return { type: "sine", frequency: { value: 0, setTargetAtTime(v: number) { frequency = v; } },
        connect() {}, disconnect() { disconnected++; }, start() { started++; }, stop() { stopped++; } };
    }
    createGain() { return { gain: { value: 0, setTargetAtTime() {} }, connect() {}, disconnect() {} }; }
  }
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { AudioContext: Context } });
  const audio = new CircuitAudio();
  const board: Board = { w: 40, h: 26, traces: [], vias: [], parts: [{ id: "BZ1", type: "buzzer", x: 10, y: 10, rot: 0, props: { frequency: 1200 } }] };
  const snap: SimSnapshot = { time: 0, groundNet: 0, netV: [0, 9], parts: { BZ1: { on: true, burnt: false, reversed: false, current: 0.025, power: 0.225, pinCurrents: { "+": 0.025, "-": -0.025 }, glow: 0, stress: 0.6 } } };
  try {
    audio.update(board, snap, true);
    assert.equal(started, 0);
    audio.unlock();
    audio.update(board, snap, true);
    assert.equal(started, 1);
    assert.equal(frequency, 1200);
    board.parts[0].props.frequency = 3000;
    audio.update(board, snap, true);
    assert.equal(started, 1);
    assert.equal(frequency, 3000);
    audio.update(board, snap, false);
    assert.equal(stopped, 1);
    audio.update(board, snap, true);
    audio.update(board, null, true);
    assert.equal(stopped, 2);
    snap.parts.BZ1.burnt = true;
    audio.update(board, snap, true);
    assert.equal(started, 2);
    snap.parts.BZ1.burnt = false;
    audio.update(board, snap, true);
    audio.update({ ...board, parts: [] }, snap, true);
    assert.equal(stopped, 3);
    audio.update(board, snap, true);
    audio.dispose();
    assert.equal(started, stopped);
    assert.equal(disconnected, stopped);
    assert.equal(closed, 1);
  } finally {
    audio.dispose();
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
