import { test } from "node:test";
import assert from "node:assert/strict";
import { draw, foodColumn } from "../sprites.ts";
import type { Pet } from "../store.ts";

const pet: Pet = { version: 2, id: "bop", created: 0, fullness: 75, eaten: 0,
  lastActivity: 0, updated: 0, food: [], sessions: {}, species: "cat", minis: [] };

test("axolotl chases a long squiggly worm on the ground", () => {
  const p = { ...pet, species: "axolotl" as const };
  for (const frame of [0, 2, 4, 6]) {
    const rows = draw(40, 0, frame, false, false, false, p, true);
    assert.equal(rows[3].slice(14, 19), "~~~~~");
    assert.ok(rows.slice(0, 3).every(line => !line.includes("~~~~~")));
  }
  for (const width of [20, 21, 40, 80]) for (let x = 0; x <= width - 9; x++) {
    const row = draw(width, x, 0, false, false, false, p, true)[3];
    for (let i = 0; i < 5; i++) assert.equal(row[((x + 14) + i) % width], "~");
  }
  assert.deepEqual(draw(40, 0, 0, false, false, false, p, false), draw(40, 0, 0, false, false, false, p));
  assert.deepEqual(draw(40, 0, 0, true, false, false, p, true), draw(40, 0, 0, true, false, false, p));
});

test("panda runs toward bamboo without hiding food or overwriting the panda", () => {
  const p = { ...pet, species: "panda" as const };
  const id = Array.from({ length: 1000 }, (_, n) => String(n)).find(id => foodColumn(id, 40) === 24);
  assert.ok(id); p.food = [id];
  const rows = draw(40, 0, 0, false, false, false, p, true);
  for (const column of [24, 27, 30]) {
    assert.equal(rows[0][column], "Y");
    assert.equal(rows[1][column], "|");
  }
  assert.equal(rows[2][24], "Y");
  assert.equal(draw(40, 8, 0, false, false, false, p, true)[0][24], "Y", "bamboo stays in place as Bop approaches");
  for (const width of [20, 21, 40, 80]) for (let x = 0; x <= width - 9; x++) {
    const plain = draw(width, x, 0, false, false, false, p);
    const scene = draw(width, x, 0, false, false, false, p, true);
    assert.ok(scene.every(line => line.length <= width));
    for (let row = 0; row < 4; row++) for (let c = x; c < x + 9; c++) {
      assert.equal(scene[row][c] ?? " ", plain[row][c] ?? " ");
    }
  }
});
