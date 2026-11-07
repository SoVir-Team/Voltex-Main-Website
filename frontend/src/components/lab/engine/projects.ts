import { blinkHz, glows, part, routingChecks, type Mission, type MissionContext } from "./missions.ts";
import { Simulator, solveSteady } from "./solver.ts";
import type { Board, PartProps } from "./types.ts";

/**
 * The project library: things to build once the missions are done. Each one is a real circuit with a schematic
 * guide and a live check, and each teaches one more idea.
 */

const set = (b: Board, id: string, props: PartProps): Board => ({ ...b, parts: b.parts.map((p) => (p.id === id ? { ...p, props: { ...p.props, ...props } } : p)) });
const steadyOn = (ctx: MissionContext, b: Board, inputs = {}) => solveSteady(b, inputs, 2, ctx.netlist);
const glow = (ctx: MissionContext, b: Board, id: string, inputs = {}) => steadyOn(ctx, b, inputs)?.parts[id]?.glow ?? 0;
const toggles = (xs: number[]) => xs.reduce((n, x, i) => (i && x !== xs[i - 1] ? n + 1 : n), 0);
const project = (m: Omit<Mission, "intro" | "success" | "palette"> & { palette?: Mission["palette"] }): Mission => ({ palette: [], intro: "project-intro", success: "project-success", ...m });

export const PROJECTS: Mission[] = [
  project({
    id: "keychain",
    title: "Keychain light",
    skill: "Internal resistance",
    brief: "A coin cell and an LED, nothing else. It works because the cell's own 30 Ω internal resistance limits the current.",
    hints: ["Coin cell + goes to the LED's anode (A).", "Swap in the 9 V battery afterwards and see why that needs a resistor."],
    why: "Real batteries are not perfect sources. Their internal resistance sags the voltage under load, and here it saves the LED.",
    board: { w: 18, h: 12, traces: [], vias: [], parts: [part("B1", "coincell", 3, 6), part("D1", "led", 12, 6, { color: "red" })] },
    nets: [
      ["B1.+", "D1.A"],
      ["D1.K", "B1.-"],
    ],
    checks(ctx) {
      return [...routingChecks(ctx, this.nets), { label: "The LED glows from the coin cell", ok: glows(ctx.steady(), "D1") }];
    },
  }),
  project({
    id: "dimmer",
    title: "LED dimmer",
    skill: "Variable resistance",
    brief: "Use the potentiometer as a variable resistor in series with the LED. Turning the knob changes the current, and so the brightness.",
    hints: ["Join the pot's wiper (W) to pin 3 so it works as a two-terminal variable resistor.", "Select the pot and drag the knob slider while powered."],
    why: "Volume knobs, fan speed dials and old dimmer switches all started as a potentiometer controlling current.",
    board: { w: 28, h: 16, traces: [], vias: [], parts: [part("B1", "battery9v", 8, 6), part("RV1", "pot", 12, 8, { value: 10000, pos: 0.5 }), part("R1", "resistor", 17, 8, { value: 330 }), part("D1", "led", 24, 11, { color: "green" })] },
    nets: [
      ["B1.+", "RV1.1"],
      ["RV1.W", "RV1.3", "R1.1"],
      ["R1.2", "D1.A"],
      ["D1.K", "B1.-"],
    ],
    checks(ctx) {
      const bright = glow(ctx, set(ctx.board, "RV1", { pos: 0 }), "D1");
      const dim = glow(ctx, set(ctx.board, "RV1", { pos: 1 }), "D1");
      return [...routingChecks(ctx, this.nets), { label: "Bright with the knob at one end", ok: bright > 0.6 }, { label: "Dim with the knob at the other end", ok: dim < 0.3 && bright > 0.6 }];
    },
  }),
  project({
    id: "rgb",
    title: "RGB colour mixer",
    skill: "Independent channels",
    brief: "Three LEDs, three knobs. Each colour gets its own resistor and pot, so you can mix the brightness of red, green and blue separately.",
    hints: ["All three channels share + and −. Route + to each pot's pin 1.", "Blue needs about 3 V to light, red only 1.9 V."],
    why: "Every pixel on a screen mixes red, green and blue. RGB lighting strips drive each channel separately, just like this.",
    board: {
      w: 34,
      h: 24,
      traces: [],
      vias: [],
      parts: [
        part("B1", "battery9v", 8, 10),
        part("RV1", "pot", 12, 6, { value: 10000, pos: 0.2 }),
        part("RV2", "pot", 12, 13, { value: 10000, pos: 0.2 }),
        part("RV3", "pot", 12, 20, { value: 10000, pos: 0.2 }),
        part("R1", "resistor", 17, 6, { value: 330 }),
        part("R2", "resistor", 17, 13, { value: 330 }),
        part("R3", "resistor", 17, 20, { value: 330 }),
        part("D1", "led", 25, 6, { color: "red" }),
        part("D2", "led", 25, 13, { color: "green" }),
        part("D3", "led", 25, 20, { color: "blue" }),
      ],
    },
    nets: [
      ["B1.+", "RV1.1", "RV2.1", "RV3.1"],
      ["RV1.W", "RV1.3", "R1.1"],
      ["RV2.W", "RV2.3", "R2.1"],
      ["RV3.W", "RV3.3", "R3.1"],
      ["R1.2", "D1.A"],
      ["R2.2", "D2.A"],
      ["R3.2", "D3.A"],
      ["D1.K", "D2.K", "D3.K", "B1.-"],
    ],
    checks(ctx) {
      const s = ctx.steady();
      return [...routingChecks(ctx, this.nets), { label: "Red, green and blue all light", ok: glows(s, "D1") && glows(s, "D2") && glows(s, "D3") }];
    },
  }),
  project({
    id: "doorbell",
    title: "Doorbell",
    skill: "Momentary switches",
    brief: "Press the button, the buzzer sounds. Release it and it stops. Route the button in series with the buzzer.",
    hints: ["The buzzer is polarised: + goes towards the battery's +.", "Hold the button on the board while powered."],
    why: "Doorbells, keyboards and lift buttons are all momentary contacts closing a circuit for as long as you press.",
    board: { w: 26, h: 14, traces: [], vias: [], parts: [part("B1", "battery9v", 8, 5), part("SW1", "button", 12, 4), part("BZ1", "buzzer", 19, 9)] },
    nets: [
      ["B1.+", "SW1.1"],
      ["SW1.2", "BZ1.+"],
      ["BZ1.-", "B1.-"],
    ],
    checks(ctx) {
      const on = ctx.steady({ pressed: new Set(["SW1"]) });
      const off = ctx.steady();
      return [...routingChecks(ctx, this.nets), { label: "Buzzer sounds while pressed", ok: Boolean(on?.parts.BZ1?.on) }, { label: "Silent when released", ok: Boolean(off) && !off?.parts.BZ1?.on }];
    },
  }),
  project({
    id: "dark-alarm",
    title: "Darkness alarm",
    skill: "Sensor-driven outputs",
    brief: "Like the night light, but it beeps. When the light sensor goes dark, the transistor switches the buzzer on.",
    hints: ["R1 and the LDR divide the voltage on the transistor's base.", "The buzzer sits between + and the collector."],
    why: "Drawer alarms, fridge door beepers and dawn simulators react to light the same way.",
    board: { w: 32, h: 18, traces: [], vias: [], parts: [part("B1", "battery9v", 8, 6), part("BZ1", "buzzer", 14, 4), part("R1", "resistor", 12, 12, { value: 47000 }), part("R3", "ldr", 19, 15), part("Q1", "npn", 24, 10, {}, 90)] },
    nets: [
      ["B1.+", "R1.1", "BZ1.+"],
      ["R1.2", "Q1.B", "R3.1"],
      ["BZ1.-", "Q1.C"],
      ["Q1.E", "R3.2", "B1.-"],
    ],
    checks(ctx) {
      const dark = ctx.steady({ ambient: 0.05 });
      const light = ctx.steady({ ambient: 0.95 });
      return [...routingChecks(ctx, this.nets), { label: "Beeps in the dark", ok: Boolean(dark?.parts.BZ1?.on) }, { label: "Quiet in daylight", ok: Boolean(light) && !light?.parts.BZ1?.on }];
    },
  }),
  project({
    id: "polarity",
    title: "Reverse-polarity guard",
    skill: "Protection diodes",
    brief: "A diode in series stops current if the battery is ever connected backwards. Route it, then try rotating the battery's diode to see it block.",
    hints: ["The diode's band (cathode, K) points away from the battery's +.", "It costs about 0.7 V, so the resistor needs a little less."],
    why: "Almost every battery-powered product has protection like this. A backwards battery would otherwise destroy the chips.",
    board: { w: 30, h: 14, traces: [], vias: [], parts: [part("B1", "battery9v", 8, 5), part("D2", "diode", 11, 3), part("R1", "resistor", 18, 3, { value: 330 }), part("D1", "led", 25, 8, { color: "yellow" })] },
    nets: [
      ["B1.+", "D2.A"],
      ["D2.K", "R1.1"],
      ["R1.2", "D1.A"],
      ["D1.K", "B1.-"],
    ],
    checks(ctx) {
      const s = ctx.steady();
      const i = s?.parts.D1?.current ?? 0;
      return [...routingChecks(ctx, this.nets), { label: "The LED lights through the diode", ok: glows(s, "D1") }, { label: "Current stays under 25 mA", ok: i > 0.005 && i < 0.025 }];
    },
  }),
  project({
    id: "delay-off",
    title: "Delay-off light",
    skill: "RC time constants",
    brief: "Tap the button to charge a big capacitor. When you let go, it drains slowly through the transistor's base and the LED fades out over a few seconds.",
    hints: ["Time constant τ = R × C: 10 kΩ × 470 µF ≈ 4.7 s.", "R3 limits the charging current so the battery is not shorted for an instant."],
    why: "Car interior lights that fade after you shut the door use exactly this capacitor-and-transistor delay.",
    board: {
      w: 34,
      h: 20,
      traces: [],
      vias: [],
      parts: [
        part("B1", "battery9v", 8, 6),
        part("R2", "resistor", 12, 3, { value: 470 }),
        part("D1", "led", 19, 3, { color: "white" }),
        part("R1", "resistor", 20, 8, { value: 10000 }),
        part("Q1", "npn", 26, 9, {}, 90),
        part("SW1", "button", 11, 12),
        part("R3", "resistor", 16, 12, { value: 100 }),
        part("C1", "electrolytic", 22, 15, { value: 470e-6 }),
      ],
    },
    nets: [
      ["B1.+", "R2.1", "SW1.1"],
      ["R2.2", "D1.A"],
      ["D1.K", "Q1.C"],
      ["SW1.2", "R3.1"],
      ["R3.2", "C1.+", "R1.1"],
      ["R1.2", "Q1.B"],
      ["Q1.E", "C1.-", "B1.-"],
    ],
    checks(ctx) {
      const sim = new Simulator(ctx.board, undefined, ctx.netlist);
      let before = 0;
      let after = 0;
      if (sim.powered) {
        const idle = { ambient: 0.6, pressed: new Set<string>() };
        for (let t = 0; t < 0.2; t += 0.005) sim.step(0.005, idle);
        before = sim.snapshot(idle).parts.D1?.glow ?? 0;
        const press = { ambient: 0.6, pressed: new Set(["SW1"]) };
        for (let t = 0; t < 0.4; t += 0.005) sim.step(0.005, press);
        for (let t = 0; t < 1.5; t += 0.005) sim.step(0.005, idle);
        after = sim.snapshot(idle).parts.D1?.glow ?? 0;
      }
      return [...routingChecks(ctx, this.nets), { label: "LED is off before you press", ok: sim.powered && before < 0.15 }, { label: "Still glowing 1.5 s after you let go", ok: after > 0.15 }];
    },
  }),
  project({
    id: "police",
    title: "Police flasher",
    skill: "Push-pull outputs",
    brief: "One 555, two LEDs. The red LED lights when the output is high, the blue one when it is low, so they flash in turn.",
    hints: ["Red: OUT → R3 → LED → −. Blue: + → R4 → LED → OUT.", "Tie RESET (pin 4) to VCC."],
    why: "Driving loads both from and to an output pin is called sourcing and sinking. Microcontroller pins do both all day.",
    board: {
      w: 36,
      h: 23,
      traces: [],
      vias: [],
      parts: [
        part("B1", "battery9v", 8, 7),
        part("U1", "timer555", 16, 12),
        part("R1", "resistor", 12, 3, { value: 1000 }),
        part("R2", "resistor", 21, 3, { value: 33000 }),
        part("C1", "electrolytic", 24, 9, { value: 10e-6 }),
        part("R3", "resistor", 20, 16, { value: 330 }),
        part("D1", "led", 28, 16, { color: "red" }),
        part("R4", "resistor", 22, 20, { value: 330 }),
        part("D2", "led", 29, 20, { color: "blue" }),
      ],
    },
    nets: [
      ["B1.+", "U1.8", "U1.4", "R1.1", "R4.1"],
      ["B1.-", "U1.1", "C1.-", "D1.K"],
      ["R1.2", "U1.7", "R2.1"],
      ["R2.2", "U1.6", "U1.2", "C1.+"],
      ["U1.3", "R3.1", "D2.K"],
      ["R3.2", "D1.A"],
      ["R4.2", "D2.A"],
    ],
    checks(ctx) {
      const red = ctx.transient(4, (s) => ((s.parts.D1?.glow ?? 0) > 0.15 ? 1 : 0));
      const blue = ctx.transient(4, (s) => ((s.parts.D2?.glow ?? 0) > 0.15 ? 1 : 0));
      return [...routingChecks(ctx, this.nets), { label: "Red flashes", ok: toggles(red) >= 4 }, { label: "Blue flashes", ok: toggles(blue) >= 4 }];
    },
  }),
  project({
    id: "metronome",
    title: "555 metronome",
    skill: "Audio timing",
    brief: "Swap the blinker's LED for a buzzer and you have a metronome. Change R2 to change the tempo.",
    hints: ["The buzzer goes from OUT (pin 3) to −.", "Bigger R2 or C1 means a slower beat."],
    why: "Timers like this sit in reversing beepers, kitchen timers and the click in your car's indicator.",
    board: {
      w: 34,
      h: 20,
      traces: [],
      vias: [],
      parts: [
        part("B1", "battery9v", 8, 7),
        part("U1", "timer555", 16, 12),
        part("R1", "resistor", 12, 3, { value: 1000 }),
        part("R2", "resistor", 21, 3, { value: 68000 }),
        part("C1", "electrolytic", 24, 9, { value: 10e-6 }),
        part("BZ1", "buzzer", 26, 16),
      ],
    },
    nets: [
      ["B1.+", "U1.8", "U1.4", "R1.1"],
      ["B1.-", "U1.1", "C1.-", "BZ1.-"],
      ["R1.2", "U1.7", "R2.1"],
      ["R2.2", "U1.6", "U1.2", "C1.+"],
      ["U1.3", "BZ1.+"],
    ],
    checks(ctx) {
      const dt = 0.002;
      const beats = blinkHz(ctx.transient(5, (s) => (s.parts.BZ1?.on ? 1 : 0)), dt);
      return [...routingChecks(ctx, this.nets), { label: "It beeps in a steady rhythm", ok: beats >= 0.4 && beats <= 4 }];
    },
  }),
  project({
    id: "parallel",
    title: "Parallel LED bank",
    skill: "Parallel circuits",
    brief: "Three LED branches side by side, each with its own resistor. Every branch sees the full 9 V and works on its own.",
    hints: ["Each branch is resistor → LED, from + to −.", "Give every LED its own resistor; never share one between parallel LEDs."],
    why: "Household wiring is parallel: switching off one lamp does not switch off the rest.",
    board: {
      w: 30,
      h: 22,
      traces: [],
      vias: [],
      parts: [
        part("B1", "battery9v", 8, 10),
        part("R1", "resistor", 12, 4, { value: 470 }),
        part("R2", "resistor", 12, 10, { value: 470 }),
        part("R3", "resistor", 12, 17, { value: 470 }),
        part("D1", "led", 21, 4, { color: "red" }),
        part("D2", "led", 21, 10, { color: "green" }),
        part("D3", "led", 21, 17, { color: "yellow" }),
      ],
    },
    nets: [
      ["B1.+", "R1.1", "R2.1", "R3.1"],
      ["R1.2", "D1.A"],
      ["R2.2", "D2.A"],
      ["R3.2", "D3.A"],
      ["D1.K", "D2.K", "D3.K", "B1.-"],
    ],
    checks(ctx) {
      const s = ctx.steady();
      return [...routingChecks(ctx, this.nets), { label: "All three LEDs light", ok: glows(s, "D1") && glows(s, "D2") && glows(s, "D3") }];
    },
  }),
  project({
    id: "series",
    title: "Series LED string",
    skill: "Series voltage drops",
    brief: "Three red LEDs in a chain share one resistor. Each drops about 1.9 V, so the resistor only has to handle what's left.",
    hints: ["Chain anode to cathode: D1.K → D2.A → D2.K → D3.A.", "R = (9 − 3 × 1.9) ÷ 0.02 ≈ 165 Ω."],
    why: "LED torches and backlights chain LEDs in series so one current flows through all of them, keeping them evenly bright.",
    board: { w: 30, h: 16, traces: [], vias: [], parts: [part("B1", "battery9v", 8, 6), part("R1", "resistor", 12, 3, { value: 150 }), part("D1", "led", 19, 3, { color: "red" }), part("D2", "led", 22, 7, { color: "red" }), part("D3", "led", 25, 11, { color: "red" })] },
    nets: [
      ["B1.+", "R1.1"],
      ["R1.2", "D1.A"],
      ["D1.K", "D2.A"],
      ["D2.K", "D3.A"],
      ["D3.K", "B1.-"],
    ],
    checks(ctx) {
      const s = ctx.steady();
      const i = s?.parts.D1?.current ?? 0;
      return [...routingChecks(ctx, this.nets), { label: "All three light from one current", ok: glows(s, "D1") && glows(s, "D2") && glows(s, "D3") }, { label: "String current 10–25 mA", ok: i > 0.01 && i < 0.025 }];
    },
  }),
  project({
    id: "not-gate",
    title: "Transistor NOT gate",
    skill: "Digital logic",
    brief: "Switch on, LED off. Switch off, LED on. A single transistor inverts its input: the building block of every logic chip.",
    hints: ["The LED hangs off the collector: when the transistor conducts, it steals the LED's current.", "Flip the slide switch while powered."],
    why: "Processors are billions of transistor switches wired into gates like this one. NOT is the simplest of them.",
    board: { w: 30, h: 18, traces: [], vias: [], parts: [part("B1", "battery9v", 8, 6), part("R2", "resistor", 12, 3, { value: 470 }), part("D1", "led", 26, 5, { color: "green" }), part("SW1", "switch", 12, 12, { closed: false }), part("R1", "resistor", 17, 12, { value: 10000 }), part("Q1", "npn", 24, 10, {}, 90)] },
    nets: [
      ["B1.+", "R2.1", "SW1.1"],
      ["SW1.2", "R1.1"],
      ["R1.2", "Q1.B"],
      ["R2.2", "Q1.C", "D1.A"],
      ["D1.K", "Q1.E", "B1.-"],
    ],
    checks(ctx) {
      const offIn = glow(ctx, set(ctx.board, "SW1", { closed: false }), "D1");
      const onIn = glow(ctx, set(ctx.board, "SW1", { closed: true }), "D1");
      return [...routingChecks(ctx, this.nets), { label: "Input off → LED on", ok: offIn > 0.15 }, { label: "Input on → LED off", ok: onIn < 0.15 && offIn > 0.15 }];
    },
  }),
];
