import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PetStore, breed, growth, type Species } from "../store.ts";
import { draw } from "../sprites.ts";

test("v1 pet migrates without losing identity, food, history or active sessions", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-bop-migration-"));
  const path = join(dir, "pet.sqlite");
  const old = { version: 1, id: "original", created: 10, fullness: 55, eaten: 20,
    lastActivity: 100, updated: 100, food: ["pellet"], sessions: { existing: { expires: 1000, busy: true } } };
  const db = new DatabaseSync(path);
  db.exec("CREATE TABLE pet (id INTEGER PRIMARY KEY, data TEXT NOT NULL)");
  db.prepare("INSERT INTO pet VALUES (1, ?)").run(JSON.stringify(old)); db.close();
  const a = new PetStore(path, 100), b = new PetStore(path, 100);
  try {
    const loaded = a.read();
    assert.deepEqual(loaded, { ...old, version: 2, species: "cat", minis: [] });
    a.update(p => { p.species = "axolotl"; }, 100);
    b.update(p => { assert.equal(breed(p, 100), "ok"); }, 100);
    assert.equal(a.read().id, old.id);
    assert.equal(a.read().eaten, 20);
    assert.deepEqual(a.read().food, old.food);
    assert.equal(a.read().minis[0].species, "axolotl");
    a.update(p => { p.species = "panda"; }, 100);
    assert.equal(b.read().minis[0].species, "axolotl", "minis keep their inherited species");
  } finally { a.close(); b.close(); rmSync(dir, { recursive: true, force: true }); }
});

test("growth thresholds and breeding cap persist", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-bop-growth-"));
  const store = new PetStore(join(dir, "pet.sqlite"));
  try {
    assert.equal(growth(store.read()), "baby");
    store.update(p => { assert.equal(breed(p, 1), "not-adult"); p.eaten = 5; });
    assert.equal(growth(store.read()), "young");
    store.update(p => { p.eaten = 15; });
    assert.equal(growth(store.read()), "adult");
    store.update(p => { for (let i = 0; i < 3; i++) assert.equal(breed(p, i), "ok"); assert.equal(breed(p, 4), "full"); });
    assert.equal(new Set(store.read().minis.map(m => m.id)).size, 3);
    const second = new PetStore(join(dir, "pet.sqlite"));
    try { assert.equal(second.read().minis.length, 3); } finally { second.close(); }
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test("species, growth and mini family render within the existing four rows", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-bop-sprites-"));
  const store = new PetStore(join(dir, "pet.sqlite"));
  try {
    const pet = store.read(); pet.eaten = 15;
    const heads = new Set<string>();
    for (const species of ["cat", "axolotl", "panda"] as Species[]) {
      const stages = [0, 5, 15].map(eaten => draw(50, 5, 0, false, false, false, { ...pet, species, eaten }).join("\n"));
      assert.equal(new Set(stages).size, 3, `${species} growth stages should look distinct`);
      pet.species = species; assert.equal(breed(pet, 1), "ok");
      const rows = draw(50, 5, 0, false, false, false, pet, true);
      heads.add(rows[0]);
      assert.equal(rows.length, 4);
      assert.ok(rows.every(row => row.length <= 50));
    }
    assert.equal(heads.size, 3);
    const rows = draw(50, 20, 0, false, false, false, pet, true);
    assert.match(rows[3], /=\^=/); assert.match(rows[3], /-o-/); assert.match(rows[3], /\(o\)/);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});
