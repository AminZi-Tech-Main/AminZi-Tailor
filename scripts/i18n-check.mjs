// Lists every UI string the app shows and checks that Dari and Pashto have it.
//   node scripts/i18n-check.mjs          → report, exit 1 if anything is missing
//   node scripts/i18n-check.mjs --keys   → print all English keys (one per line)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src/', import.meta.url).pathname;
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|mjs)$/.test(f) && !/i18n-(fa|ps)\.ts$/.test(f)) files.push(p);
  }
})(root);

const keys = new Map(); // key -> first file
const add = (k, f) => { if (k && !keys.has(k)) keys.set(k, f.replace(root, 'src/')); };
const unq = (s) => s.replace(/\\(['"`\\])/g, '$1');
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\b(?:t|tk)\(\s*(['"])((?:\\.|(?!\1).)*?)\1/g)) add(unq(m[2]), f);
  for (const m of src.matchAll(/\bt\(((?:[^()'"?]|'[^']*'|"[^"]*")*?)\?\s*(['"])((?:\\.|(?!\2).)*?)\2\s*:\s*(['"])((?:\\.|(?!\4).)*?)\4/g)) { add(unq(m[3]), f); add(unq(m[5]), f); }
}

if (process.argv.includes('--keys')) { console.log([...keys.keys()].join('\n')); process.exit(0); }

// Load the dictionaries (plain object literals) without a TS toolchain.
const load = (name) => {
  const src = readFileSync(join(root, 'lib', name), 'utf8');
  const grab = (exp) => {
    const m = src.match(new RegExp(`export const ${exp}[^=]*=\\s*(\\{[\\s\\S]*?\\n\\});`));
    if (!m) throw new Error(`${exp} not found in ${name}`);
    return Function(`return (${m[1]})`)();
  };
  return grab;
};
const fa = load('i18n-fa.ts'), ps = load('i18n-ps.ts');
const dicts = { Dari: [fa('FA_UI'), fa('FA_GLOSSARY')], Pashto: [ps('PS_UI'), ps('PS_GLOSSARY')] };

let bad = 0;
const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
for (const [lang, [ui, gl]] of Object.entries(dicts)) {
  const missing = [...keys.keys()].filter((k) => !(k in ui));
  const extra = Object.keys(ui).filter((k) => !keys.has(k));
  const varBad = [...keys.keys()].filter((k) => k in ui && vars(k) !== vars(ui[k]));
  const latin = Object.entries(ui).filter(([k, v]) => /[a-z]{4,}/i.test(v.replace(/\{\w+\}|AminZi|Supabase|USB|PIN|ESC|SQL Editor|npm run dev|\.env|package\.json|VITE_\w+|https?:\/\/\S+|localhost|https?|publishable|README|supabase\/migrations\/\S+|service_role|SECRET|07X|XXX|XXXX|Zebra|ZD220|XP-80/g, '')));
  const eastern = Object.entries({ ...ui, ...gl }).filter(([, v]) => /[۰-۹٠-٩]/.test(v)); // shop decision: digits stay 0-9
  console.log(`${lang}: ${keys.size} strings used, ${missing.length} missing, ${varBad.length} with wrong {placeholders}, ${extra.length} unused, ${latin.length} still in Latin letters, ${eastern.length} with ۰-۹ digits`);
  for (const [k, v] of eastern) console.log(`  eastern digits: ${JSON.stringify(k)} → ${JSON.stringify(v)}`);
  bad += eastern.length;
  for (const k of missing) console.log(`  missing: ${JSON.stringify(k)}  (${keys.get(k)})`);
  for (const k of varBad) console.log(`  placeholders differ: ${JSON.stringify(k)} → ${JSON.stringify(ui[k])}`);
  for (const [k, v] of latin) console.log(`  latin?: ${JSON.stringify(k)} → ${JSON.stringify(v)}`);
  if (process.argv.includes('--unused')) for (const k of extra) console.log(`  unused: ${JSON.stringify(k)}`);
  bad += missing.length + varBad.length;
}
const [faG, psG] = [dicts.Dari[1], dicts.Pashto[1]];
const gDiff = [...Object.keys(faG).filter((k) => !(k in psG)), ...Object.keys(psG).filter((k) => !(k in faG))];
console.log(`Glossary: ${Object.keys(faG).length} Dari / ${Object.keys(psG).length} Pashto entries, ${gDiff.length} in only one`);
for (const k of gDiff) console.log(`  only in one glossary: ${k}`);
bad += gDiff.length;
process.exit(bad ? 1 : 0);
