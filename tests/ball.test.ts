import { test } from "node:test";
import assert from "node:assert/strict";
import { draw, foodColumn } from "../sprites.ts";
import type { Pet } from "../store.ts";

const pet: Pet = { version: 2, id: "bop", created: 0, fullness: 75, eaten: 0,
  lastActivity: 0, updated: 0, food: [], sessions: {}, species: "cat", minis: [] };

test("yarn ball stays on the ground and leaves a growing string", () => {
  for (const width of [20, 21, 40, 80]) {
    for (let x = 0; x <= width - 9; x++) {
      const column = (x + 14) % width;
      assert.ok(column < x || column > x + 8, "ball must not overlap the cat");
      for (const frame of [0, 2, 4, 6]) {
        const lines = draw(width, x, frame, false, false, false, pet, true);
        assert.equal(lines[3][column], "@");
        assert.ok(lines.slice(0, 3).every(line => !line.includes("@")), "ball must not bounce");
        assert.ok(lines.every(line => line.length <= width));
      }
    }
  }
  const start = draw(60, 0, 0, false, false, false, pet, true)[3];
  const later = draw(60, 20, 0, false, false, false, pet, true)[3];
  assert.ok((later.match(/~/g) ?? []).length > (start.match(/~/g) ?? []).length);
  assert.equal(later[34], "@");
  const wrapped = draw(40, 30, 0, false, false, false, pet, true)[3];
  assert.equal(wrapped[4], "@");
  assert.equal(wrapped[39], "~", "string continues across the right edge");
});

test("yarn preserves food and mini Bops and is absent when sleeping or static", () => {
  const width = 40;
  const id = Array.from({ length: 1000 }, (_, n) => String(n)).find(id => foodColumn(id, width) === 14);
  assert.ok(id);
  const withFood = { ...pet, food: [id], minis: [{ id: "mini", species: "cat" as const, created: 0 }] };
  const lines = draw(width, 10, 4, false, false, false, withFood, true);
  assert.equal(lines[2][14], "*");
  assert.ok(lines[3].includes("=^="), "mini remains visible over the string");
  assert.equal(lines[3][24], "@");
  assert.deepEqual(draw(width, 0, 0, true, false, false, pet, true), draw(width, 0, 0, true, false, false, pet));
  assert.deepEqual(draw(width, 0, 0, false, false, false, pet, false), draw(width, 0, 0, false, false, false, pet));
  assert.deepEqual(draw(19, 0, 0, false, false, false, pet, true), draw(19, 0, 0, false, false, false, pet, false));
});
