import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const SLEEP_MS = 5 * 60_000;
export const LEASE_MS = 45_000;
const HUNGER_PER_MS = 10 / (60 * 60_000);

export const SPECIES = ["cat", "axolotl", "panda"] as const;
export type Species = typeof SPECIES[number];
export type Pet = {
  version: number; id: string; created: number; fullness: number; eaten: number;
  lastActivity: number; updated: number; food: string[];
  sessions: Record<string, { expires: number; busy: boolean }>;
  species: Species; minis: { id: string; species: Species; created: number }[];
};

export function growth(pet: Pick<Pet, "eaten">): "baby" | "young" | "adult" {
  return pet.eaten >= 15 ? "adult" : pet.eaten >= 5 ? "young" : "baby";
}

export function breed(pet: Pet, now: number): "ok" | "not-adult" | "full" {
  if (growth(pet) !== "adult") return "not-adult";
  if (pet.minis.length >= 3) return "full";
  pet.minis.push({ id: randomUUID(), species: pet.species, created: now });
  return "ok";
}

export function awakeUntil(pet: Pet): number {
  let until = pet.lastActivity + SLEEP_MS;
  for (const session of Object.values(pet.sessions)) {
    if (session.busy) until = Math.max(until, session.expires);
  }
  return until;
}

export function isAwake(pet: Pet, now = Date.now()): boolean {
  return now < awakeUntil(pet);
}

function validate(value: unknown): Pet {
  const original = value as Pet;
  if (!original || (original.version !== 1 && original.version !== 2))
    throw new Error("Invalid or unsupported pi-bop save; the original database was preserved");
  const p: Pet = original.version === 1 ? { ...original, version: 2, species: "cat", minis: [] } : original;
  if (typeof p.id !== "string" || !Number.isFinite(p.created) ||
      !Number.isFinite(p.fullness) || !Number.isFinite(p.eaten) || !Number.isFinite(p.lastActivity) ||
      !Number.isFinite(p.updated) || !Array.isArray(p.food) || p.food.length > 5 ||
      !p.food.every(x => typeof x === "string") || !p.sessions || typeof p.sessions !== "object" ||
      Array.isArray(p.sessions) || !Object.values(p.sessions).every(s => s && Number.isFinite(s.expires) && typeof s.busy === "boolean") ||
      !SPECIES.includes(p.species) || !Array.isArray(p.minis) || p.minis.length > 3 ||
      !p.minis.every(m => m && typeof m.id === "string" && SPECIES.includes(m.species) && Number.isFinite(m.created))) {
    throw new Error("Invalid or unsupported pi-bop save; the original database was preserved");
  }
  return p;
}

export class PetStore {
  private db: DatabaseSync;
  constructor(path: string, now = Date.now()) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    try {
      this.db.exec("PRAGMA busy_timeout=100; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS pet (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)");
      const initial: Pet = { version: 2, id: randomUUID(), created: now, fullness: 75, eaten: 0,
        lastActivity: now, updated: now, food: [], sessions: {}, species: "cat", minis: [] };
      this.db.prepare("INSERT OR IGNORE INTO pet(id,data) VALUES (1,?)").run(JSON.stringify(initial));
      this.read();
    } catch (error) { this.db.close(); throw error; }
  }
  read(): Pet {
    const row = this.db.prepare("SELECT data FROM pet WHERE id=1").get() as { data: string } | undefined;
    if (!row) throw new Error("Missing pi-bop save; database was preserved");
    return validate(JSON.parse(row.data));
  }
  update(fn: (pet: Pet) => void, now = Date.now()): Pet {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const pet = this.read();
      // Hunger accrues only while a recent Pi presence confirms the pet was awake.
      const presenceEnd = Math.max(pet.updated, ...Object.values(pet.sessions).map(s => s.expires));
      const end = Math.min(now, awakeUntil(pet), presenceEnd);
      pet.fullness = Math.max(0, pet.fullness - Math.max(0, end - pet.updated) * HUNGER_PER_MS);
      pet.updated = now;
      for (const [id, session] of Object.entries(pet.sessions)) if (session.expires <= now) delete pet.sessions[id];
      fn(pet);
      if (pet.version !== 2) throw new Error("Invalid or unsupported pi-bop save; the original database was preserved");
      validate(pet);
      this.db.prepare("UPDATE pet SET data=? WHERE id=1").run(JSON.stringify(pet));
      this.db.exec("COMMIT");
      return pet;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  close() { this.db.close(); }
}

export function touch(pet: Pet, session: string, busy: boolean, activity: boolean, now: number) {
  pet.sessions[session] = { expires: now + LEASE_MS, busy };
  if (activity) pet.lastActivity = now;
}
export function addFood(pet: Pet) {
  if (pet.food.length < 5) pet.food.push(randomUUID());
}
export function eatFood(pet: Pet, id: string): boolean {
  const index = pet.food.indexOf(id);
  if (index < 0) return false;
  pet.food.splice(index, 1);
  pet.eaten++;
  pet.fullness = Math.min(100, pet.fullness + 10);
  return true;
}
