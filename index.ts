import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { watch, type FSWatcher } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { PetStore, type Pet, type Species, SPECIES, growth, breed, touch, addFood, eatFood, isAwake, awakeUntil } from "./store.ts";
import { draw, foodColumn } from "./sprites.ts";

export default function piBop(pi: ExtensionAPI) {
  const session = randomUUID();
  let store: PetStore | undefined, pet: Pet | undefined, ctx: ExtensionContext | undefined;
  let watcher: FSWatcher | undefined, unsubscribe: (() => void) | undefined;
  let frameTimer: ReturnType<typeof setInterval> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let sleepTimer: ReturnType<typeof setTimeout> | undefined;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let collectTimer: ReturnType<typeof setTimeout> | undefined;
  let render: (() => void) | undefined;
  let visible = true, motion = true, busy = false, warned = false, closed = false;
  let x = 0, width = 80, frame = 0, lastFrame = Date.now(), lastTouch = 0, eatingUntil = 0, happyUntil = 0;

  function report(error: unknown) {
    if (!warned && ctx?.hasUI) {
      warned = true;
      ctx.ui.notify(`pi-bop: ${error instanceof Error ? error.message : String(error)}`, "warning");
    }
  }
  function change(fn: (p: Pet, now: number) => void) {
    if (!store || closed) return;
    try {
      const now = Date.now();
      pet = store.update(p => fn(p, now), now);
      updateTimers();
      render?.();
    } catch (error) { report(error); }
  }
  function refresh() {
    if (!store || closed) return;
    try { pet = store.read(); updateTimers(); render?.(); } catch (error) { report(error); }
  }
  function activity(force = false) {
    const now = Date.now();
    if (!force && now - lastTouch < 5000 && pet && isAwake(pet, now)) return;
    lastTouch = now;
    if (pet && !isAwake(pet, now)) happyUntil = now + 1500;
    change((p, time) => touch(p, session, busy, true, time));
  }
  function collect(id: string) {
    let ate = false;
    change(p => { ate = eatFood(p, id); });
    if (ate) { eatingUntil = Date.now() + 650; happyUntil = eatingUntil + 700; }
  }
  function tick() {
    if (!pet || !isAwake(pet)) { updateTimers(); return; }
    const now = Date.now();
    const elapsed = Math.min(500, now - lastFrame);
    lastFrame = now;
    if (now >= eatingUntil) {
      const max = Math.max(1, width - 9);
      const previous = x;
      x += elapsed * 0.010;
      const wrapped = x > max;
      if (wrapped) x = 0;
      const target = pet.food.find(id => {
        const column = foodColumn(id, width);
        const oldFront = previous + 8, newFront = x + 8;
        return wrapped ? column > oldFront || column <= newFront : column > oldFront && column <= newFront;
      });
      if (target) collect(target);
    }
    frame++;
    render?.();
  }
  function updateTimers() {
    if (!pet || closed) return;
    const awake = isAwake(pet);
    const animate = awake && visible && motion && width >= 12;
    if (animate && !frameTimer) { lastFrame = Date.now(); frameTimer = setInterval(tick, 125); frameTimer.unref?.(); }
    if (!animate && frameTimer) { clearInterval(frameTimer); frameTimer = undefined; }
    if (awake && !heartbeat) {
      heartbeat = setInterval(() => change((p, now) => touch(p, session, busy, false, now)), 20_000);
      heartbeat.unref?.();
    }
    if (!awake && heartbeat) { clearInterval(heartbeat); heartbeat = undefined; }
    if (sleepTimer) clearTimeout(sleepTimer);
    sleepTimer = undefined;
    if (awake) {
      sleepTimer = setTimeout(() => { updateTimers(); render?.(); }, Math.max(1, awakeUntil(pet) - Date.now() + 5));
      sleepTimer.unref?.();
    }
    // A hidden or static cat still eats, without running an animation loop.
    if (awake && pet.food.length && !animate && !collectTimer) {
      collectTimer = setTimeout(() => { collectTimer = undefined; if (pet && isAwake(pet) && pet.food.length) collect(pet.food[0]); updateTimers(); }, 1500);
      collectTimer.unref?.();
    } else if ((!awake || !pet.food.length || animate) && collectTimer) { clearTimeout(collectTimer); collectTimer = undefined; }
  }
  function setWidget() {
    if (!ctx || ctx.mode !== "tui") return;
    if (!visible) { ctx.ui.setWidget("pi-bop", undefined); render = undefined; updateTimers(); return; }
    ctx.ui.setWidget("pi-bop", (tui, theme) => {
      render = () => tui.requestRender();
      return {
        render(w: number) {
          if (w !== width) { width = w; x = Math.min(x, Math.max(0, w - 9)); queueMicrotask(updateTimers); }
          if (!pet) return [];
          const now = Date.now();
          return draw(w, x, frame, !isAwake(pet, now), now < eatingUntil, now < happyUntil, pet, motion).map(line => theme.fg("muted", line));
        },
        invalidate() {},
        dispose() { render = undefined; },
      };
    });
    updateTimers();
  }
  pi.on("session_start", (_event, context) => {
    if (context.mode !== "tui") return;
    ctx = context; closed = false;
    try {
      const path = join(homedir(), ".pi", "agent", "pi-bop", "state.sqlite");
      store = new PetStore(path);
      pet = store.read();
      watcher = watch(dirname(path), (_event, name) => {
        if (name && !String(name).startsWith("state.sqlite")) return;
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refresh, 100);
        refreshTimer.unref?.();
      });
      watcher.on("error", report);
      unsubscribe = context.ui.onTerminalInput(() => { activity(); return undefined; });
      activity(true);
      setWidget();
    } catch (error) { report(error); }
  });
  pi.on("input", (event) => {
    if (event.source !== "interactive" || !event.text.trim() || event.text.trimStart().startsWith("/")) return;
    activity(true);
    change(p => addFood(p));
  });
  pi.on("agent_start", () => { if (!store) return; busy = true; activity(true); });
  pi.on("agent_settled", () => { if (!store) return; busy = false; activity(true); });
  pi.registerCommand("bop", {
    description: "Bop status, inventory, species, breeding and display controls",
    handler: async (args, context) => {
      if (context.mode !== "tui" || !store || !pet) { context.ui.notify("pi-bop is available in the interactive terminal", "warning"); return; }
      const arg = args.trim().toLowerCase();
      if (arg === "hide") { visible = false; setWidget(); }
      else if (arg === "show") { visible = true; setWidget(); }
      else if (arg === "motion off") { motion = false; updateTimers(); render?.(); }
      else if (arg === "motion on") { motion = true; updateTimers(); render?.(); }
      else if (arg === "inventory") {
        refresh();
        const family = pet.minis.map(m => m.species).join(", ") || "none yet";
        context.ui.notify(`Species: ${SPECIES.join(", ")} · Selected: ${pet.species} · Mini Bops: ${family}`, "info");
      } else if (arg.startsWith("species ")) {
        const selected = arg.slice(8).trim() as Species;
        if (!SPECIES.includes(selected)) { context.ui.notify(`Choose: ${SPECIES.join(", ")}`, "warning"); return; }
        change(p => { p.species = selected; });
      } else if (arg === "breed") {
        let result: ReturnType<typeof breed> | undefined;
        change((p, now) => { result = breed(p, now); });
        if (result === "ok") context.ui.notify("A mini Bop hatched!", "info");
        else if (result === "not-adult") context.ui.notify("Bop needs 15 meals to become an adult before hatching a mini.", "info");
        else if (result === "full") context.ui.notify("Bop already has three mini Bops.", "info");
      } else if (!arg) {
        refresh();
        const days = Math.floor((Date.now() - pet.created) / 86_400_000);
        context.ui.notify(`Bop: ${pet.species} · ${growth(pet)} · ${isAwake(pet) ? "awake" : "sleeping"} · fullness ${Math.round(pet.fullness)}% · ${pet.eaten} meals · age ${days}d · minis ${pet.minis.length}/3`, "info");
      } else context.ui.notify("Use /bop [inventory|species cat|axolotl|panda|breed|show|hide|motion on|motion off]", "info");
    },
  });
  pi.on("session_shutdown", () => {
    if (store && !closed) change(p => { delete p.sessions[session]; });
    closed = true;
    if (frameTimer) clearInterval(frameTimer);
    if (heartbeat) clearInterval(heartbeat);
    if (sleepTimer) clearTimeout(sleepTimer);
    if (refreshTimer) clearTimeout(refreshTimer);
    if (collectTimer) clearTimeout(collectTimer);
    unsubscribe?.(); watcher?.close(); store?.close();
    render = undefined; store = undefined;
  });
}
