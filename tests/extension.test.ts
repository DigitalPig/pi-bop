import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import bop from "../index.ts";
import { PetStore, SLEEP_MS } from "../store.ts";

test("interactive events feed, hidden Bop eats, commands and shutdown work", async () => {
  const oldHome = process.env.HOME;
  const home = mkdtempSync(join(tmpdir(), "pi-bop-ui-")); process.env.HOME = home;
  const events = new Map<string, Function>(), commands = new Map<string, any>();
  let input: Function = () => {}; let widget: any; let renders = 0; let unsubscribed = false;
  const notices: string[] = [];
  const ctx: any = { mode: "tui", hasUI: true, ui: {
    notify: (text: string) => notices.push(text),
    onTerminalInput: (fn: Function) => { input = fn; return () => { unsubscribed = true; }; },
    setWidget: (_key: string, factory: any) => {
      widget?.dispose?.();
      widget = factory?.({ requestRender: () => { renders++; } }, { fg: (_color: string, value: string) => value });
    },
  } };
  const pi: any = { on: (name: string, fn: Function) => events.set(name, fn), registerCommand: (name: string, command: any) => commands.set(name, command) };
  const emit = (name: string, event: any = {}) => events.get(name)?.(event, ctx);
  try {
    bop(pi); emit("session_start");
    assert.equal(widget.render(50).length, 4);
    assert.equal(widget.render(50)[3][14], "@", "yarn ball appears on the ground in the live widget");
    assert.equal(input("a"), undefined);
    emit("input", { source: "extension", text: "ignored" });
    emit("input", { source: "interactive", text: "/skill:foo" });
    const dbPath = join(home, ".pi", "agent", "pi-bop", "state.sqlite");
    const check = new PetStore(dbPath);
    try {
      assert.equal(check.read().food.length, 0);
      emit("input", { source: "interactive", text: "Hello" });
      assert.equal(check.read().food.length, 1);
      await commands.get("bop").handler("hide", ctx);
      assert.equal(widget, undefined);
      await new Promise(resolve => setTimeout(resolve, 1700));
      assert.equal(check.read().eaten, 1);
      await commands.get("bop").handler("show", ctx);
      assert.equal(widget.render(50).length, 4);
      await commands.get("bop").handler("motion off", ctx);
      assert.ok(!widget.render(50)[0].includes("o"), "static mode hides the ball");
      await new Promise(resolve => setTimeout(resolve, 300));
      const staticRenders = renders;
      await new Promise(resolve => setTimeout(resolve, 350));
      assert.equal(renders, staticRenders, "static mode must not redraw continuously");
      await commands.get("bop").handler("", ctx);
      assert.ok(notices.some(n => n.includes("1 meals")));
      await commands.get("bop").handler("breed", ctx);
      assert.ok(notices.some(n => n.includes("15 meals")));
      check.update(p => { p.eaten = 15; });
      await commands.get("bop").handler("species axolotl", ctx);
      await commands.get("bop").handler("breed", ctx);
      assert.equal(check.read().minis[0].species, "axolotl");
      await commands.get("bop").handler("species panda", ctx);
      await commands.get("bop").handler("inventory", ctx);
      assert.ok(notices.some(n => n.includes("Selected: panda")));
      await commands.get("bop").handler("motion on", ctx);
      check.update(p => { p.lastActivity = Date.now() - SLEEP_MS - 1000; p.sessions = {}; });
      await new Promise(resolve => setTimeout(resolve, 300));
      assert.ok(widget.render(50).some((line: string) => line.includes("-.-")));
      const sleepingRenders = renders;
      await new Promise(resolve => setTimeout(resolve, 350));
      assert.equal(renders, sleepingRenders, "sleeping must stop animation redraws");
      input("x");
      assert.ok(!widget.render(50).some((line: string) => line.includes("-.-")), "typing wakes Bop");
      emit("session_shutdown");
      assert.equal(unsubscribed, true);
      assert.equal(Object.keys(check.read().sessions).length, 0);
      const after = renders;
      await new Promise(resolve => setTimeout(resolve, 200));
      assert.equal(renders, after);
    } finally { check.close(); }
  } finally { process.env.HOME = oldHome; rmSync(home, { recursive: true, force: true }); }
});
