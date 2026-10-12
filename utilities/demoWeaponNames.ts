// The parser writes round_inventory with demoinfocs display names ("M4A1" is
// the M4A1-S, "USP-S", "Galil AR"), while kills, shots and positions carry the
// internal names ("m4a1" is the M4A4, "m4a1_silencer", "usp_silencer").
// weaponIcon keys "m4a1" to the M4A4, so the display names have to be turned
// into the internal ones before anything reads them.

// demoinfocs v5 EquipmentType.String() -> the parser's weaponName(), plus
// CS2's own item names for the gear it has no name for.
const DISPLAY_TO_INTERNAL: Record<string, string> = {
  P2000: "hkp2000",
  "Glock-18": "glock",
  P250: "p250",
  "Desert Eagle": "deagle",
  "Five-SeveN": "fiveseven",
  "Dual Berettas": "elite",
  "Tec-9": "tec9",
  "CZ75 Auto": "cz75a",
  "USP-S": "usp_silencer",
  "R8 Revolver": "revolver",
  MP7: "mp7",
  MP9: "mp9",
  "PP-Bizon": "bizon",
  "MAC-10": "mac10",
  "UMP-45": "ump45",
  P90: "p90",
  "MP5-SD": "mp5sd",
  "Sawed-Off": "sawedoff",
  Nova: "nova",
  "MAG-7": "mag7",
  XM1014: "xm1014",
  M249: "m249",
  Negev: "negev",
  "Galil AR": "galilar",
  FAMAS: "famas",
  "AK-47": "ak47",
  M4A4: "m4a1",
  M4A1: "m4a1_silencer",
  "SSG 08": "ssg08",
  "SG 553": "sg556",
  AUG: "aug",
  AWP: "awp",
  "SCAR-20": "scar20",
  G3SG1: "g3sg1",
  "Zeus x27": "taser",
  C4: "c4",
  Knife: "knife",
  "Decoy Grenade": "decoy",
  Molotov: "molotov",
  "Incendiary Grenade": "inferno",
  Flashbang: "flashbang",
  "Smoke Grenade": "smokegrenade",
  "HE Grenade": "hegrenade",
  "Kevlar Vest": "kevlar",
  "Kevlar + Helmet": "assaultsuit",
  "Defuse Kit": "defuser",
  World: "world",
};

/** A demoinfocs display name as its internal name; anything else as is. */
export function internalWeaponName<T extends string | null | undefined>(
  name: T,
): T | string {
  return name && Object.prototype.hasOwnProperty.call(DISPLAY_TO_INTERNAL, name)
    ? DISPLAY_TO_INTERNAL[name]
    : name;
}

/** round_inventory with its weapons under their internal names. */
export function normalizeRoundInventory<
  T extends { primary?: string | null; secondary?: string | null },
>(rows: T[]): T[] {
  return rows.map((r) => ({
    ...r,
    primary: internalWeaponName(r.primary) ?? null,
    secondary: internalWeaponName(r.secondary) ?? null,
  }));
}
