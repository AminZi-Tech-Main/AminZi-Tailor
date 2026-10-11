import { FA_GLOSSARY, FA_UI } from './i18n-fa';
import { PS_GLOSSARY, PS_UI } from './i18n-ps';
import { parseIso, toJalaali } from './format';
import { tk } from './tk';
import type { Calendar, Lang, Role, Stage } from './types';

/*
  Translation engine.

  - Every visible string is written in English in the code and passed through the t function:
      t('New order')                      → "فرمایش نو"
      t('{n} m left', { n: 6.5 })          → "6.5 متر مانده"
  - Data the app itself ships (stages, roles, garments, colours, the demo shop's names)
    goes through tv(), which looks it up in a glossary and otherwise returns it unchanged,
    so whatever a shop types in its own language is shown as typed.
  - Dates use Afghan month names (Hamal … Hut) or Gregorian, in the chosen language.
  - Digits stay 0-9 in every language (shop decision); the layout stays left-to-right and
    Dari/Pashto text runs right-to-left inside it (see <Tx>).

  Dari is Afghan Dari (فرمایش، تکه، تیلفون، پیشکی), not Iranian Persian.
  `npm run i18n:check` lists any UI string that is missing from Dari or Pashto.
*/

type Vars = Record<string, string | number>;
/**
 * Fills {placeholders}. In Dari/Pashto each value is wrapped in Unicode "first strong isolate" marks
 * (U+2068 … U+2069) so a phone number, order code or Latin name keeps its own order inside the
 * right-to-left sentence ("زنگ به +93 70 000 1100", not "1100 000 70 93+").
 */
const fill = (s: string, vars: Vars | undefined, isolate: boolean) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? (isolate ? `\u2068${vars[k]}\u2069` : String(vars[k])) : m)) : s;

const UI: Record<Lang, Record<string, string> | null> = { English: null, Dari: FA_UI, Pashto: PS_UI };
const GLOSSARY: Record<Lang, Record<string, string> | null> = { English: null, Dari: FA_GLOSSARY, Pashto: PS_GLOSSARY };

const MONTHS: Record<Lang, { greg: string[]; sh: string[]; days: string[] }> = {
  English: {
    greg: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    sh: ['Hamal', 'Sawr', 'Jawza', 'Saratan', 'Asad', 'Sunbula', 'Mizan', 'Aqrab', 'Qaws', 'Jadi', 'Dalw', 'Hut'],
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
  Dari: {
    greg: ['جنوری', 'فبروری', 'مارچ', 'اپریل', 'می', 'جون', 'جولای', 'اگست', 'سپتمبر', 'اکتوبر', 'نومبر', 'دسمبر'],
    sh: ['حمل', 'ثور', 'جوزا', 'سرطان', 'اسد', 'سنبله', 'میزان', 'عقرب', 'قوس', 'جدی', 'دلو', 'حوت'],
    days: ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'],
  },
  Pashto: {
    greg: ['جنوري', 'فبروري', 'مارچ', 'اپرېل', 'مۍ', 'جون', 'جولای', 'اګست', 'سپتمبر', 'اکتوبر', 'نومبر', 'ډسمبر'],
    sh: ['وری', 'غویی', 'غبرګولی', 'چنګاښ', 'زمری', 'وږی', 'تله', 'لړم', 'لیندۍ', 'مرغومی', 'سلواغه', 'کب'],
    days: ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'],
  },
};

const pad = (n: number) => String(n).padStart(2, '0');
const asDate = (v: string | Date) => (typeof v === 'string' ? (v.length <= 10 ? parseIso(v) : new Date(v)) : v);

/** English measurement labels as written into measurement history ("Chest 102 → 104"). */
const HIST_LABELS = [tk('T. Length'), tk('T. Waist'), 'Hem width', 'Shoulder', 'Chest', 'Waist', 'Length', 'Sleeve', 'Collar', 'Thigh', 'Cuff'];
const HIST_RE = new RegExp(`\\b(${HIST_LABELS.map((l) => l.replace('.', '\\.')).join('|')})\\b`, 'gi');

export function makeT(lang: Lang = 'English', cal: Calendar = 'Solar Hijri') {
  const ui = UI[lang];
  const gl = GLOSSARY[lang];
  const M = MONTHS[lang] ?? MONTHS.English;

  /** UI text. Missing entries fall back to English. */
  const t = (en: string, vars?: Vars) => fill(ui?.[en] ?? en, vars, !!ui);
  /** Data values (stage, role, garment, colour, demo names). Unknown values pass through. */
  const tv = (v: string | null | undefined) => (v ? gl?.[v] ?? v : '');

  const sh = (d: Date) => toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const short = (v: string | Date, c: Calendar = cal) => {
    const d = asDate(v);
    if (c === 'Gregorian') return `${d.getDate()} ${M.greg[d.getMonth()]}`;
    const j = sh(d);
    return `${j.jd} ${M.sh[j.jm - 1]}`;
  };
  const long = (v: string | Date, c: Calendar = cal) => {
    const d = asDate(v);
    if (c === 'Gregorian') return `${d.getDate()} ${M.greg[d.getMonth()]} ${d.getFullYear()}`;
    const j = sh(d);
    return `${j.jd} ${M.sh[j.jm - 1]} ${j.jy}`;
  };
  const num = (v: string | Date, c: Calendar = cal) => {
    const d = asDate(v);
    if (c === 'Gregorian') return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const j = sh(d);
    return `${pad(j.jd)}/${pad(j.jm)}/${j.jy}`;
  };
  const header = () => {
    const d = new Date();
    const day = M.days[d.getDay()];
    return cal === 'Solar Hijri'
      ? { main: `${day} ${long(d, 'Solar Hijri')}`, sub: num(d, 'Gregorian') }
      : { main: `${day} ${long(d, 'Gregorian')}`, sub: `${num(d, 'Solar Hijri')} ${t('SH')}` };
  };
  const ago = (v: string | null) => {
    if (!v) return t('Never');
    const s = (Date.now() - new Date(v).getTime()) / 1000;
    if (s < 90) return t('Now');
    if (s < 3600) return t('{n} min ago', { n: Math.round(s / 60) });
    if (s < 86400) return t('{n} h ago', { n: Math.round(s / 3600) });
    if (s < 172800) return t('Yesterday');
    return t('{n} days ago', { n: Math.round(s / 86400) });
  };

  return {
    lang,
    cal,
    rtl: lang !== 'English',
    t,
    tv,
    stage: (s: Stage) => tv(s),
    role: (r: Role) => tv(r),
    /** "6.5 m" */
    m: (n: number | string) => t('{n} m', { n }),
    /** "50 ml" → "50 ملی‌لیتر" */
    size: (s: string) => s.replace(/\bml\b/i, t('ml')),
    /** "→" pointing forward in this language's reading direction. */
    fwd: ui ? '←' : '→',
    /** Measurement-history line, stored in English, shown in this language. */
    hist: (text: string) => {
      if (!ui) return text;
      return text
        .replace(/ → /g, ' ← ')
        .replace(/, /g, '، ')
        .replace(/^First measurement$/, t('First measurement'))
        .replace(/^With new order:/, `${t('With new order')}:`)
        .replace(/^From ([A-Z]+-\d+):/, (_m, code: string) => `${t('From {code}', { code })}:`)
        .replace(HIST_RE, (w) => t(HIST_LABELS.find((l) => l.toLowerCase() === w.toLowerCase()) ?? w));
    },
    short,
    long,
    num,
    header,
    ago,
    timeHM: (v: string | Date) => { const d = asDate(v); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; },
  };
}
export type T = ReturnType<typeof makeT>;

export const LANG_LABEL: Record<Lang, string> = { English: 'English', Dari: 'دری', Pashto: 'پښتو' };
export const htmlLang = (l: Lang) => (l === 'Dari' ? 'fa-AF' : l === 'Pashto' ? 'ps' : 'en');
