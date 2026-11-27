import { PetStore } from "../store.ts";
const s = new PetStore(process.argv[2]);
for (let i = 0; i < 40; i++) s.update(p => { p.eaten++; });
s.close();
