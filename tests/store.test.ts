import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { PetStore, addFood, eatFood, touch, isAwake, SLEEP_MS, LEASE_MS } from "../store.ts";
import { draw, foodColumn } from "../sprites.ts";

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "pi-bop-test-"));
  return { dir, path: join(dir, "state.sqlite"), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("food is bounded and consumed once across connections", () => {
  const f = fixture(), a = new PetStore(f.path, 1000), b = new PetStore(f.path, 1000);
  try {
    a.update(p => { for (let i = 0; i < 8; i++) addFood(p); }, 1000);
    assert.equal(b.read().food.length, 5);
    const id = b.read().food[0];
    let first = false, second = true;
    a.update(p => { first = eatFood(p, id); }, 1000);
    b.update(p => { second = eatFood(p, id); }, 1000);
    assert.equal(first, true); assert.equal(second, false);
    assert.equal(b.read().eaten, 1);
    assert.equal(b.read().id, a.read().id);
  } finally { a.close(); b.close(); f.cleanup(); }
});

test("sleep, busy leases, no offline hunger, and save restoration", () => {
  const f = fixture(), s = new PetStore(f.path, 1000);
  try {
    s.update(p => touch(p, "one", true, true, 1000), 1000);
    assert.equal(isAwake(s.read(), 1000 + SLEEP_MS + 1), false);
    s.update(p => touch(p, "one", true, false, 1000 + SLEEP_MS), 1000 + SLEEP_MS);
    assert.equal(isAwake(s.read(), 1000 + SLEEP_MS + LEASE_MS - 1), true);
    const before = s.read().fullness;
    s.update(() => {}, 1000 + SLEEP_MS + LEASE_MS * 2);
    const after = s.read().fullness;
    assert.ok(before - after < 0.2);
    s.update(() => {}, 1000 + SLEEP_MS + 86_400_000);
    assert.equal(s.read().fullness, after);
  } finally { s.close(); f.cleanup(); }
});

test("renderer fits narrow widths and shows selected cat", () => {
  const f = fixture(), s = new PetStore(f.path);
  try {
    const p = s.read(); p.food = ["one"];
    for (const w of [0, 1, 6, 11, 12, 40, 80]) {
      const lines = draw(w, 999, 0, false, false, false, p);
      assert.ok(lines.every(line => line.length <= w));
      assert.ok(foodColumn("one", w) < Math.max(w, 1));
    }
    assert.match(draw(40, 0, 0, false, false, false, p)[0], /\/\\_\/\\/);
    assert.match(draw(40, 0, 0, true, false, false, p)[1], /-\.-/);
  } finally { s.close(); f.cleanup(); }
});

test("independent processes do not lose shared updates", async () => {
  const f = fixture(); const s = new PetStore(f.path); s.close();
  try {
    const worker = join(import.meta.dirname, "worker.ts");
    await Promise.all(Array.from({ length: 4 }, () => new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, [worker, f.path], { stdio: ["ignore", "pipe", "pipe"] });
      let error = ""; child.stderr.on("data", b => error += b);
      child.on("error", reject); child.on("exit", code => code === 0 ? resolve() : reject(new Error(error)));
    })));
    const result = new PetStore(f.path);
    try { assert.equal(result.read().eaten, 160); } finally { result.close(); }
  } finally { f.cleanup(); }
});

test("invalid saves are rejected rather than replaced", () => {
  const f = fixture(), s = new PetStore(f.path);
  try {
    const before = s.read();
    assert.throws(() => s.update(p => { p.version = 99; }), /unsupported/);
    assert.deepEqual(s.read(), before);
  } finally { s.close(); f.cleanup(); }
});
