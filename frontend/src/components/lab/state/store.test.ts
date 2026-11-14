import { test } from "node:test";
import assert from "node:assert/strict";
import { PALETTE, pinPositions } from "../engine/parts.ts";
import { buildNetlist, connected } from "../engine/netlist.ts";
import { defaultProperties } from "../engine/properties.ts";
import type { Board, Part, PartType } from "../engine/types.ts";
import { canUndo, canRedo, initialState, reducer, type LabState } from "./store.ts";

function state(board?: Board): LabState {
  return { ...initialState(), mode: { kind: "sandbox" }, board: board ?? { w: 100, h: 80, parts: [], traces: [], vias: [] } };
}
const part = (type: PartType, id = "X1"): Part => ({ id, type, x: 10, y: 10, rot: 90, props: defaultProperties(type) });

for (const type of PALETTE) {
  test(`copy/paste ${type} preserves settings and rotation with an independent identity`, () => {
    let s = state();
    s.board.parts.push(part(type));
    s = reducer(s, { type: "select", selection: { kind: "part", id: "X1" } });
    s = reducer(s, { type: "copy" });
    s = reducer(s, { type: "paste-start" });
    s = reducer(s, { type: "paste-place", at: { x: 30, y: 30 } });
    assert.equal(s.board.parts.length, 2);
    const copy = s.board.parts[1];
    assert.notEqual(copy.id, "X1");
    assert.equal(copy.rot, 90);
    assert.deepEqual(copy.props, s.board.parts[0].props);
    assert.notEqual(copy.props, s.board.parts[0].props);
    const first = pinPositions(s.board.parts[0]);
    const second = pinPositions(copy);
    assert.equal(second.length, first.length);
    for (let i = 0; i < first.length; i++) {
      assert.equal(second[i].x - second[0].x, first[i].x - first[0].x);
      assert.equal(second[i].y - second[0].y, first[i].y - first[0].y);
    }
    const board = s.board;
    s = reducer(s, { type: "undo" });
    assert.equal(s.board.parts.length, 1);
    s = reducer(s, { type: "redo" });
    assert.deepEqual(s.board, board);
  });
}

test("copy all retains trace layers, vias, net connectivity, and unique identifiers on repeated paste", () => {
  let s = state({ w: 100, h: 80, parts: [
    { ...part("resistor", "R1"), rot: 0 }, { ...part("led", "D1"), x: 20, rot: 0 },
  ], traces: [
    { id: "t1", layer: "top", width: 0.4, points: [{ x: 14, y: 10 }, { x: 17, y: 10 }] },
    { id: "t2", layer: "bottom", width: 0.4, points: [{ x: 17, y: 10 }, { x: 20, y: 10 }] },
  ], vias: [{ id: "v1", x: 17, y: 10 }] });
  s = reducer(s, { type: "select", selection: { kind: "all", id: "all" } });
  s = reducer(s, { type: "copy" });
  for (const x of [30, 55]) {
    s = reducer(s, { type: "paste-start" });
    s = reducer(s, { type: "paste-place", at: { x, y: 30 } });
  }
  assert.equal(s.board.parts.length, 6);
  assert.equal(s.board.traces.length, 6);
  assert.equal(s.board.vias.length, 3);
  const ids = [...s.board.parts, ...s.board.traces, ...s.board.vias].map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  const nl = buildNetlist(s.board);
  for (let i = 0; i < 6; i += 2) assert.ok(connected(nl, [`${s.board.parts[i].id}.2`, `${s.board.parts[i + 1].id}.A`]));
  assert.ok(!connected(nl, ["R1.2", "R2.2"]));
  assert.equal(s.past.length, 2);
});

test("paste cancellation, bounds, overlaps, and mission restrictions preserve the board", () => {
  let s = state();
  s.board.parts.push(part("resistor", "R1"));
  s = reducer(s, { type: "copy", all: true });
  const board = s.board;
  s = reducer(s, { type: "paste-start" });
  s = reducer(s, { type: "paste-place", at: { x: -4, y: -4 } });
  assert.equal(s.board, board);
  assert.match(s.clipboardMessage, /inside/);
  s = reducer(s, { type: "paste-place", at: { x: 9, y: 9 } });
  assert.equal(s.board, board);
  assert.match(s.clipboardMessage, /away/);
  s = reducer(s, { type: "route-cancel" });
  assert.equal(s.pasting, false);
  s = reducer(s, { type: "mode", mode: { kind: "mission", index: 1 } });
  assert.ok(s.clipboard);
  s = reducer(s, { type: "paste-start" });
  assert.equal(s.pasting, false);
  assert.match(s.clipboardMessage, /does not allow/);
});

test("custom values are one undoable edit and invalid numeric properties are rejected", () => {
  let s = state();
  s.board.parts.push(part("resistor", "R1"));
  const before = s.board;
  for (const value of [NaN, Infinity, -1, 0]) assert.equal(reducer(s, { type: "props", id: "R1", props: { value } }).board, before);
  s = reducer(s, { type: "props", id: "R1", props: { value: 1234 } });
  assert.equal(s.past.length, 1);
  assert.equal(s.board.parts[0].props.value, 1234);
  assert.deepEqual(reducer(s, { type: "undo" }).board, before);
});

test("wire undo/redo removes each routing click including automatically generated bends", () => {
  let s = state();
  const board = s.board;
  assert.equal(canUndo(s), false);
  s = reducer(s, { type: "route-start", at: { x: 10, y: 10 } });
  const start = s.routing;
  assert.equal(canUndo(s), true);
  s = reducer(s, { type: "route-add", points: [{ x: 12, y: 12 }, { x: 15, y: 12 }] });
  const firstClick = s.routing;
  s = reducer(s, { type: "route-add", points: [{ x: 18, y: 15 }, { x: 18, y: 18 }] });
  const secondClick = s.routing;
  s = reducer(s, { type: "undo" });
  assert.deepEqual(s.routing, firstClick);
  assert.equal(s.board, board);
  assert.equal(canRedo(s), true);
  s = reducer(s, { type: "route-undo" });
  assert.deepEqual(s.routing, start);
  s = reducer(s, { type: "undo" });
  assert.equal(s.routing, null);
  assert.equal(canUndo(s), false);
  s = reducer(s, { type: "redo" });
  assert.deepEqual(s.routing, start);
  s = reducer(s, { type: "redo" });
  assert.deepEqual(s.routing, firstClick);
  s = reducer(s, { type: "redo" });
  assert.deepEqual(s.routing, secondClick);
  assert.equal(canRedo(s), false);
});

test("completed wire connections undo and redo without removing components or earlier wires", () => {
  let s = state();
  s.board.parts.push(part("resistor", "R1"));
  const initial = s.board;
  for (const y of [10, 20]) {
    s = reducer(s, { type: "route-start", at: { x: 10, y } });
    s = reducer(s, { type: "route-finish", points: [{ x: 20, y }] });
  }
  const finished = s.board;
  s = { ...s, fabSent: true };
  s = reducer(s, { type: "undo" });
  assert.equal(s.board.traces.length, 1);
  assert.deepEqual(s.board.parts, initial.parts);
  assert.equal(s.fabSent, false);
  assert.equal(s.routing, null);
  s = reducer(s, { type: "undo" });
  assert.deepEqual(s.board, initial);
  s = reducer(s, { type: "redo" });
  s = reducer(s, { type: "redo" });
  assert.deepEqual(s.board, finished);
});

test("draft undo preserves committed wires, while redesigning clears the discarded draft redo", () => {
  let s = state();
  s = reducer(s, { type: "route-start", at: { x: 10, y: 10 } });
  s = reducer(s, { type: "route-finish", points: [{ x: 20, y: 10 }] });
  s = reducer(s, { type: "route-start", at: { x: 20, y: 10 } });
  s = reducer(s, { type: "route-add", points: [{ x: 25, y: 15 }] });
  s = reducer(s, { type: "undo" });
  assert.equal(s.board.traces.length, 1);
  s = reducer(s, { type: "route-add", points: [{ x: 25, y: 5 }] });
  assert.equal(canRedo(s), false);
  s = reducer(s, { type: "route-finish" });
  s = reducer(s, { type: "undo" });
  assert.equal(s.board.traces.length, 1);
  s = reducer(s, { type: "route-start", at: { x: 20, y: 10 } });
  assert.equal(canRedo(s), false);
  const before = s.board;
  s = reducer(s, { type: "redo" });
  assert.equal(s.board, before);
  s = reducer(s, { type: "route-finish", points: [{ x: 30, y: 10 }] });
  assert.equal(s.future.length, 0);
});

test("undo and redo handle a route via, layer changes, and cancellation", () => {
  let s = state();
  s = reducer(s, { type: "route-start", at: { x: 10, y: 10 } });
  s = reducer(s, { type: "route-add", points: [{ x: 15, y: 10 }] });
  s = reducer(s, { type: "route-via" });
  const viaBoard = s.board;
  assert.equal(viaBoard.vias.length, 1);
  s = reducer(s, { type: "undo" });
  assert.equal(s.board.vias.length, 0);
  assert.equal(s.board.traces.length, 0);
  s = reducer(s, { type: "redo" });
  assert.deepEqual(s.board, viaBoard);
  s = reducer(s, { type: "route-start", at: { x: 15, y: 10 } });
  s = reducer(s, { type: "layer", layer: "top" });
  assert.equal(s.routing?.layer, "top");
  s = reducer(s, { type: "undo" });
  assert.equal(s.routing?.layer, "bottom");
  s = reducer(s, { type: "redo" });
  assert.equal(s.routing?.layer, "top");
  s = reducer(s, { type: "undo" });
  s = reducer(s, { type: "route-cancel" });
  assert.equal(s.routeFuture.length, 0);
  assert.equal(s.routing, null);
});
