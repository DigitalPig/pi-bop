import { growth, type Pet } from "./store.ts";

export function foodColumn(id: string, width: number): number {
  let hash = 2166136261;
  for (const c of id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return Math.abs(hash >>> 0) % Math.max(1, width);
}

export function draw(width: number, x: number, frame: number, asleep: boolean, eating: boolean, happy: boolean, pet: Pet, ball = false): string[] {
  if (width < 12) return [asleep ? "(-.-) zZ".slice(0, width) : "(o.o)".slice(0, width)];
  const face = asleep ? "-.-" : eating ? "^w^" : happy ? "^.^" : pet.fullness < 20 ? "u.u" : "o.o";
  const paws = asleep ? " U   U" : frame % 2 ? "  /  >" : "  >  \\";
  const adult = growth(pet) === "adult";
  const head = pet.species === "axolotl" ? (adult ? " ~\\___/~" : "  \\___/") :
    pet.species === "panda" ? (adult ? " (O)_(O)" : " (o)_(o)") : adult ? " /\\___/\\" : "  /\\_/\\";
  const expression = pet.species === "axolotl" ? ` ~{${face}}~` : ` ( ${face} )`;
  const body = asleep ? " (_____)~" : eating ? " ( >*< )~" : growth(pet) === "baby" ? " ( > < )~" : " (  .  )~";
  const cat = [head, expression, body, paws];
  const rows = Array.from({ length: 4 }, () => Array(width).fill(" "));
  for (const id of pet.food) {
    const column = foodColumn(id, width);
    rows[2][column] = pet.species === "panda" ? "Y" : pet.species === "axolotl" ? "~" : "*";
    if (pet.species === "axolotl" && column + 1 < width && rows[2][column + 1] === " ") rows[2][column + 1] = "~";
  }
  const pos = Math.max(0, Math.min(width - 9, Math.floor(x)));
  cat.forEach((line, row) => [...line].forEach((ch, i) => { if (pos + i < width && ch !== " ") rows[row][pos + i] = ch; }));
  if (asleep && pos + 12 < width) { rows[0][pos + 10] = "z"; rows[0][pos + 11] = "Z"; }
  if (happy && pos + 10 < width) rows[1][pos + 10] = "♥";
  if (ball && !asleep && width >= 20) {
    const column = (pos + 14) % width;
    if (pet.species === "panda") {
      for (let i = 0; i < 3; i++) {
        const stalk = (Math.floor(width * 0.6) + i * 3) % width;
        if (stalk >= pos && stalk < pos + 9) continue;
        ["Y", "|", ":", "|"].forEach((ch, row) => {
          if (rows[row][stalk] === " ") rows[row][stalk] = ch;
        });
      }
    } else if (pet.species === "cat") {
      for (let c = 0; c < width; c++) {
        const trailing = c < column || (pos + 14 >= width && c > pos + 8);
        if (trailing && (c < pos || c >= pos + 9) && rows[3][c] === " ") rows[3][c] = "~";
      }
      rows[3][column] = "@";
    } else {
      for (let i = 0; i < 5; i++) {
        const c = (column + i) % width;
        if ((c < pos || c >= pos + 9) && rows[3][c] === " ") rows[3][c] = "~";
      }
    }
  }
  for (const [i, mini] of pet.minis.entries()) {
    const column = ((pos - (i + 1) * 5) % width + width) % width;
    const icon = mini.species === "cat" ? "=^=" : mini.species === "axolotl" ? "-o-" : "(o)";
    if (column + icon.length <= width && [...icon].every((_, n) => rows[3][column + n] === " " || (pet.species === "cat" && rows[3][column + n] === "~"))) {
      [...icon].forEach((ch, n) => { rows[3][column + n] = ch; });
    }
  }
  return rows.map(row => row.join("").trimEnd());
}
