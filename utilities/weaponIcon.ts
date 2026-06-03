// Weapon-name → equipment icon resolution.
//
// Stat weapon strings reach us in several spellings for the SAME gun:
//   - 5Stack demos store CS2 internal names with underscores: "m4a1"
//     (= M4A4), "m4a1_silencer" (= M4A1-S), "usp_silencer", "deagle", "galil".
//   - Imported (Valve/external) demos normalise display names differently:
//     "m4a4", "m4a1-s", "usp-s", "deserteagle", "galilar".
// Both must collapse to one canonical icon (and one row in the weapons list),
// otherwise the same gun shows twice and underscore names 404.
//
// We key everything off a "compact" form (lowercase, weapon_ prefix dropped,
// all non-alphanumerics removed) and map that to the equipment SVG basename
// under /public/img/equipment.

const CANON: Record<string, string> = {
  // rifles
  ak47: "ak47",
  m4a1: "m4a1", // M4A4 (CS2 internal weapon_m4a1)
  m4a4: "m4a1",
  m4a1silencer: "m4a1_silencer", // M4A1-S
  m4a1s: "m4a1_silencer",
  famas: "famas",
  galil: "galilar",
  galilar: "galilar",
  aug: "aug",
  sg556: "sg556",
  sg553: "sg556",
  // snipers
  awp: "awp",
  ssg08: "ssg08",
  scar20: "scar20",
  g3sg1: "g3sg1",
  // pistols
  glock: "glock",
  glock18: "glock",
  usp: "usp_silencer",
  usps: "usp_silencer",
  uspsilencer: "usp_silencer",
  p2000: "p2000",
  hkp2000: "p2000",
  p250: "p250",
  deagle: "deagle",
  deserteagle: "deagle",
  elite: "elite",
  dualberettas: "elite",
  fiveseven: "fiveseven",
  cz75a: "cz75a",
  cz75auto: "cz75a",
  tec9: "tec9",
  revolver: "revolver",
  r8revolver: "revolver",
  // smgs
  mac10: "mac10",
  mp9: "mp9",
  mp7: "mp7",
  mp5sd: "mp5sd",
  ump45: "ump45",
  ump: "ump45",
  p90: "p90",
  bizon: "bizon",
  ppbizon: "bizon",
  // heavy
  nova: "nova",
  xm1014: "xm1014",
  sawedoff: "sawedoff",
  mag7: "mag7",
  m249: "m249",
  negev: "negev",
  // equipment
  taser: "taser",
  zeus: "taser",
  zeusx27: "taser",
  c4: "c4",
  bomb: "c4",
  // grenades
  hegrenade: "hegrenade",
  molotov: "molotov",
  inferno: "molotov",
  incgrenade: "incgrenade",
  incendiarygrenade: "incgrenade",
  smokegrenade: "smokegrenade",
  flashbang: "flashbang",
  decoy: "decoy",
  decoygrenade: "decoy",
};

// Pretty labels per canonical basename (for tooltips / fallbacks).
const LABELS: Record<string, string> = {
  m4a1: "M4A4",
  m4a1_silencer: "M4A1-S",
  usp_silencer: "USP-S",
  p2000: "P2000",
  deagle: "Desert Eagle",
  ak47: "AK-47",
  galilar: "Galil AR",
  sg556: "SG 553",
  ssg08: "SSG 08",
  scar20: "SCAR-20",
  cz75a: "CZ75-Auto",
  fiveseven: "Five-SeveN",
  mac10: "MAC-10",
  mp5sd: "MP5-SD",
  ump45: "UMP-45",
  bizon: "PP-Bizon",
  sawedoff: "Sawed-Off",
  mag7: "MAG-7",
  hegrenade: "HE Grenade",
  smokegrenade: "Smoke Grenade",
  incgrenade: "Incendiary",
  taser: "Zeus x27",
  elite: "Dual Berettas",
  revolver: "R8 Revolver",
};

function compact(w: string): string {
  return w
    .toLowerCase()
    .trim()
    .replace(/^weapon_/, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Canonical equipment SVG basename for a weapon, or "" if there's no sensible
 * icon (unknown / world / empty). Every knife/bayonet skin → "knife".
 */
export function weaponBasename(w: string | undefined | null): string {
  if (!w) return "";
  const lower = w.toLowerCase().trim();
  if (lower === "unknown" || lower === "world") return "";
  if (lower.includes("knife") || lower === "bayonet") return "knife";
  const key = compact(w);
  if (!key) return "";
  if (CANON[key]) return CANON[key];
  // Last resort: assume the stored value already IS a valid basename, keeping
  // underscores (e.g. some future "usp_silencer_off"). 404s are hidden by the
  // <img @error> handler so this never shows a broken image.
  return lower.replace(/^weapon_/, "").replace(/[^a-z0-9_]/g, "");
}

/** Full icon path, or "" when there is no icon. */
export function weaponIconPath(w: string | undefined | null): string {
  const base = weaponBasename(w);
  return base ? `/img/equipment/${base}.svg` : "";
}

/**
 * Old-way resolution: the pre-canonical slug (lowercase, weapon_ prefix
 * dropped, ALL non-alphanumerics removed). Used as a fallback for the 2D
 * replay of already-parsed demos — their weapon strings won't be re-parsed, so
 * if the canonical icon 404s we retry the legacy path before hiding the image.
 */
export function weaponIconFallback(w: string | undefined | null): string {
  if (!w) return "";
  const lower = w.toLowerCase().trim();
  if (lower === "unknown" || lower === "world") return "";
  if (lower.includes("knife") || lower === "bayonet") {
    return "/img/equipment/knife.svg";
  }
  const slug = lower.replace(/^weapon_/, "").replace(/[^a-z0-9]/g, "");
  return slug ? `/img/equipment/${slug}.svg` : "";
}

/**
 * Resolve a weapon to a stable de-dupe key + icon + display label. Different
 * spellings of the same gun share a `key`, so callers can merge their counts.
 */
export function resolveWeapon(w: string | undefined | null): {
  key: string;
  icon: string;
  label: string;
} {
  const base = weaponBasename(w);
  const key = base || (w ?? "").toLowerCase().trim() || "unknown";
  return {
    key,
    icon: base ? `/img/equipment/${base}.svg` : "",
    label: (base && LABELS[base]) || w || "—",
  };
}
