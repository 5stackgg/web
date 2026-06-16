export const LEGEND_VARS = [
  "K",
  "D",
  "A",
  "R",
  "H",
  "S",
  "DMG",
  "E",
  "t",
  "θ",
  "SV",
  "TR",
];

const COMPOSITE_TOKENS = ["KPR", "DPR", "APR", "ADR", "KAST", "I", "KDA", "N"];

const QUALIFIER_TOKENS = [
  "spotted",
  "rifle",
  "pistol",
  "sniper",
  "head",
  "first sight",
  "first shot",
  "spray",
  "stopped",
  "eligible",
  "on target",
  "engaged",
  "damaged",
  "traded",
  "trade chance",
  "util",
  "HE",
  "awp",
];

const ALL_TOKENS = [...LEGEND_VARS, ...COMPOSITE_TOKENS, ...QUALIFIER_TOKENS];
const TOKEN_SET = new Set(ALL_TOKENS);

export function tokenKey(token: string): string {
  return token.toLowerCase().replace(/ /g, "_").replace("θ", "theta");
}

if (import.meta.dev) {
  const byLower = new Map<string, string>();
  for (const token of ALL_TOKENS) {
    const lower = token.toLowerCase();
    const existing = byLower.get(lower);
    if (existing && existing !== token) {
      console.warn(
        `[statFormula] ambiguous symbols differ only by case: "${existing}" vs "${token}"`,
      );
    }
    byLower.set(lower, token);
  }
}

export const MESH_TOKENS = new Set([
  "spotted",
  "first sight",
  "on target",
  "engaged",
  "eligible",
]);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const VAR_RE = new RegExp(
  [...ALL_TOKENS]
    .sort((a, b) => b.length - a.length)
    .map((token) =>
      /^[\w ]+$/.test(token) ? `\\b${escapeRe(token)}\\b` : escapeRe(token),
    )
    .join("|"),
  "g",
);

export function tokenizeFormula(
  text: string,
): Array<{ t: string; v?: string }> {
  const out: Array<{ t: string; v?: string }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  VAR_RE.lastIndex = 0;
  while ((m = VAR_RE.exec(text)) !== null) {
    if (m.index > last) {
      out.push({ t: text.slice(last, m.index) });
    }
    out.push({ t: m[0], v: TOKEN_SET.has(m[0]) ? m[0] : undefined });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    out.push({ t: text.slice(last) });
  }
  return out;
}
