import { test } from "node:test";
import assert from "node:assert/strict";
import { draw } from "../sprites.ts";
import type { Pet } from "../store.ts";

const pet: Pet = { version: 2, id: "bop", created: 0, fullness: 75, eaten: 0,
  lastActivity: 0, updated: 0, food: [], sessions: {}, species: "panda", minis: [] };

test("panda has round ears and the original circular eyes at every growth stage", () => {
  for (const eaten of [0, 5, 15]) {
    const p = { ...pet, eaten };
    assert.match(draw(40, 0, 0, false, false, false, p)[0], eaten >= 15 ? /\(O\)_\(O\)/ : /\(o\)_\(o\)/);
    assert.match(draw(40, 0, 0, false, false, false, p)[1], /\( o\.o \)/);
    assert.match(draw(40, 0, 0, true, false, false, p)[1], /\( -\.- \)/);
  }
});

test("axolotl has fluffy gills and expressive face without affecting widths", () => {
  for (const eaten of [0, 5, 15]) for (const width of [12, 20, 40]) {
    const p = { ...pet, species: "axolotl" as const, eaten };
    const awake = draw(width, width - 9, 0, false, false, false, p);
    const sleeping = draw(width, width - 9, 0, true, false, false, p);
    assert.ok(awake[1].includes("~{o.o}~"));
    assert.ok(sleeping[1].includes("~{-.-}~"));
    assert.ok([...awake, ...sleeping].every(line => line.length <= width));
  }
});
