import { test } from "node:test";
import assert from "node:assert/strict";
import { draw, foodColumn } from "../sprites.ts";
import { eatFood, type Pet } from "../store.ts";

const pet: Pet = { version: 2, id: "bop", created: 0, fullness: 75, eaten: 0,
  lastActivity: 0, updated: 0, food: [], sessions: {}, species: "cat", minis: [] };
const idAt = (column: number) => {
  const id = Array.from({ length: 10000 }, (_, n) => String(n)).find(value => foodColumn(value, 40) === column);
  assert.ok(id); return id;
};

test("food looks different for each species but is still one meal", () => {
  const id = idAt(24);
  for (const [species, food] of [["cat", "*"], ["panda", "Y"], ["axolotl", "~~"]] as const) {
    const p: Pet = { ...pet, species, food: [id] };
    const rows = draw(40, 0, 0, false, false, false, p, true);
    assert.equal(rows[2].slice(24, 24 + food.length), food);
    if (species === "axolotl") assert.equal(rows[3].slice(14, 19), "~~~~~");
    assert.equal(eatFood(p, id), true);
    assert.equal(p.eaten, 1); assert.equal(p.food.length, 0);
    assert.equal(eatFood(p, id), false);
  }
});

test("short worm food clips safely at the right edge and during resize", () => {
  const p: Pet = { ...pet, species: "axolotl", food: [idAt(39)] };
  const rows = draw(40, 0, 0, false, false, false, p, true);
  assert.equal(rows[2][39], "~");
  for (const width of [12, 20, 21, 40, 80]) {
    for (const x of [0, width - 9]) {
      const result = draw(width, x, 0, false, false, false, p, true);
      assert.ok(result.every(line => line.length <= width));
    }
  }
});
