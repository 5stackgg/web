/**
 * How each map is painted. Colours are sRGB hex as they should land on screen
 * for a sunlit surface; the shader derives shade and shadow from them, so the
 * value hierarchy (tops > floors > wall faces) is set here.
 */
export type MapPalette = {
  /** Roofs, wall tops and anything flat that is not walkable. */
  top: string;
  /** Walkable floors. */
  floor: string;
  /** Walkable floors open to the sky (yards, streets); `floor` when unset. */
  floorOutdoor?: string;
  /** Vertical faces. */
  wall: string;
  foliage: string;
  /** Three tones props (crates, carts, clutter) are painted in. */
  props: [string, string, string];
  seeThrough: string;
  /**
   * The ground the map sits on (and its own out-of-bounds ground), lit and
   * in shade: the dark table every map stands on, from the app's zinc.
   */
  sand: string;
  sandShade: string;
  skyTop: string;
  skyHorizon: string;
  /** Multiplies colours out of the sun. */
  shadow: string;
  /** Multiplies colours in tight corners. */
  occlusion: string;
  outline: string;
  site: string;
  siteLetter: string;
  /** What the screen corners are multiplied toward. */
  vignette: string;
  /**
   * Bomb-site decals as source-unit rects [x0, y0, x1, y1], over the plant
   * zones (read off the old radars' red areas); without them the callout
   * boxes (inset) are used, which on most maps are far bigger than the zone.
   */
  sites?: Partial<Record<"A" | "B", [number, number, number, number]>>;
  /**
   * Hatch the flat tops nobody can walk on: on an industrial map a roof is
   * as flat and grey as a floor, so this says where players cannot go.
   */
  noAccess?: boolean;
};

/** The table and sky every map shares, whatever its theme. */
const TABLE = {
  sand: "#2e2e33",
  sandShade: "#232327",
  skyTop: "#0f0f11",
  skyHorizon: "#1c1c20",
  siteLetter: "#fff8ee",
};

/*
 * Map themes. Each is a family of maps that share a mood; a map takes its
 * family and may nudge a colour or two. Floors stay well off both team
 * colours (CT blue, T amber) and the site red.
 */

/** Warm sandstone under a high sun: mirage, dust2, anubis. */
const SUN_BAKED: MapPalette = {
  ...TABLE,
  top: "#ffe7ab",
  floor: "#a47b55",
  wall: "#a87d56",
  foliage: "#6d8f37",
  props: ["#a5603a", "#5f8a8c", "#c39252"],
  seeThrough: "#efdcb4",
  shadow: "#ada3a8",
  occlusion: "#5a3c3c",
  outline: "#3b2416",
  site: "#a8231a",
  vignette: "#b9b9c0",
};

/** Mediterranean villages: cream plaster, terracotta, warm cobbles. */
const TERRACOTTA: MapPalette = {
  ...SUN_BAKED,
  top: "#f6dcbc",
  floor: "#8f735c",
  wall: "#bd8767",
  foliage: "#5f8536",
  props: ["#a8553a", "#5d8577", "#c79a5c"],
  seeThrough: "#f0dcc6",
  shadow: "#a99ea6",
  occlusion: "#58363a",
  outline: "#36201a",
};

/** Jungle temples and old stone: lichen, moss, dark earth. */
const OVERGROWN: MapPalette = {
  ...TABLE,
  top: "#c9cba3",
  floor: "#6c6646",
  wall: "#7f8062",
  foliage: "#3f7a2e",
  props: ["#8a5a36", "#4d7c6a", "#b39a52"],
  seeThrough: "#dcdcc0",
  shadow: "#929f94",
  occlusion: "#34432a",
  outline: "#1d2314",
  site: "#a8231a",
  vignette: "#adb5a9",
};

/** Rail yards and concrete blocks: soot, rust, ballast, brick. */
const RAIL_YARD: MapPalette = {
  ...TABLE,
  top: "#d4cec0",
  floor: "#5d5852",
  wall: "#8a6c5c",
  foliage: "#5a7034",
  props: ["#9a5232", "#4f6e5c", "#b89a4a"],
  seeThrough: "#d8d2c6",
  shadow: "#9f999e",
  occlusion: "#3c302b",
  outline: "#1b1613",
  site: "#ad251b",
  vignette: "#b2b0b3",
};

/** Plants and towers: cool steel, concrete, warning paint. */
const STEEL: MapPalette = {
  ...TABLE,
  top: "#c9d0d6",
  floor: "#676c72",
  wall: "#8c949b",
  foliage: "#4e7a4c",
  props: ["#cfa92e", "#3c8a8a", "#b4553c"],
  seeThrough: "#dfe6ea",
  shadow: "#a0abbd",
  occlusion: "#28303d",
  outline: "#121820",
  site: "#b3261c",
  vignette: "#a9b1bf",
  noAccess: true,
};

/** City parks and canals: pale concrete, lawns, ivy. */
const PARK: MapPalette = {
  ...TABLE,
  top: "#dfe0d3",
  floor: "#71786a",
  wall: "#9a9786",
  foliage: "#4a8a36",
  props: ["#9a5a3a", "#4f8a86", "#c4a24c"],
  seeThrough: "#e0e2d6",
  shadow: "#98a39d",
  occlusion: "#2f392b",
  outline: "#1a2017",
  site: "#a8231a",
  vignette: "#b1b8b0",
};

/** Whitewashed coast: bright plaster, sun-warm stone, sea teal. */
const COASTAL: MapPalette = {
  ...TABLE,
  top: "#f3f0e6",
  floor: "#8d8476",
  wall: "#b1a997",
  foliage: "#5d8a3a",
  props: ["#34548a", "#479797", "#c08a50"],
  seeThrough: "#eef0ea",
  shadow: "#a3a7b4",
  occlusion: "#3a404e",
  outline: "#232933",
  site: "#a8231a",
  vignette: "#b7bbc4",
};

/** Snow: white roofs and yards, grey-brown inside, blue shade. */
const WINTER: MapPalette = {
  ...TABLE,
  top: "#f2f5f9",
  floor: "#8a847c",
  wall: "#a39e98",
  foliage: "#2f5a40",
  props: ["#8e5a3c", "#4d7a86", "#b59a64"],
  seeThrough: "#e8eef4",
  shadow: "#8e9cb6",
  occlusion: "#28304a",
  outline: "#141a28",
  site: "#b3261c",
  vignette: "#a9b1c2",
};

/** A day colour under moonlight: drained, cooler and `k` as bright. */
function moon(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const rgb = [n >> 16, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const grey = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const tint = [0.88, 0.95, 1.07];
  return `#${rgb
    .map((v, i) => {
      const c = (grey + (v - grey) * 0.5) * tint[i] * k;
      return Math.round(Math.min(1, c) * 255)
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`;
}

/** `*_night` maps: their day palette, moonlit, still bright enough to read. */
function moonlit(day: MapPalette): MapPalette {
  return {
    ...day,
    top: moon(day.top, 0.76),
    floor: moon(day.floor, 0.7),
    floorOutdoor: day.floorOutdoor && moon(day.floorOutdoor, 0.7),
    wall: moon(day.wall, 0.66),
    foliage: moon(day.foliage, 0.7),
    props: day.props.map((hex) => moon(hex, 0.78)) as MapPalette["props"],
    seeThrough: moon(day.seeThrough, 0.8),
    shadow: "#66728f",
    occlusion: "#1a2033",
    outline: "#0b0e16",
    site: "#b8281f",
    vignette: "#8f97ad",
  };
}

const CBBLE: MapPalette = {
  ...OVERGROWN,
  top: "#dcdccc",
  floor: "#6c6a5c",
  wall: "#8b897c",
  foliage: "#5a8a34",
  props: ["#8a5a36", "#5a6e7a", "#b0965a"],
  shadow: "#98a09a",
  occlusion: "#353c2e",
};

// Every map gets its own tune of its family, from how it looks in game.
const PALETTES: Record<string, MapPalette> = {
  // Moroccan sandstone, teal accents.
  de_mirage: {
    ...SUN_BAKED,
    sites: {
      A: [-630, -2346, -263, -2014],
      B: [-2236, 64, -1865, 465],
    },
  },
  // Bleached desert sand, blue doors.
  de_dust2: {
    ...SUN_BAKED,
    top: "#fcefcf",
    floor: "#a08468",
    wall: "#b39273",
    props: ["#a86a42", "#4e7396", "#c9a874"],
    seeThrough: "#f2e6cc",
    shadow: "#aaa7af",
    outline: "#3d2a1c",
    sites: {
      A: [966, 2441, 1261, 2643],
      B: [-1709, 2485, -1344, 2885],
    },
  },
  // Egyptian limestone, gold, turquoise water.
  de_anubis: {
    ...SUN_BAKED,
    top: "#f7e8c4",
    floor: "#a67c58",
    wall: "#b89c74",
    foliage: "#6a9440",
    props: ["#c9a03c", "#3d9a94", "#9a5a3a"],
    seeThrough: "#f2e4c4",
    outline: "#3a2a18",
  },
  // Sandy hill fort, dry scrub.
  de_stronghold: {
    ...SUN_BAKED,
    top: "#f4e4bc",
    floor: "#9c8462",
    wall: "#ad9070",
    foliage: "#7a8f3e",
    props: ["#a8603a", "#7a8a5a", "#c8a060"],
  },
  // Italian terracotta and ochre, green shutters.
  de_inferno: {
    ...TERRACOTTA,
    sites: {
      A: [1818, 141, 2192, 706],
      B: [154, 2533, 625, 3038],
    },
  },
  // Greek hill town: pale stone, red roofs, blue shutters.
  de_boulder: {
    ...TERRACOTTA,
    top: "#f1e3cc",
    floor: "#9a8068",
    wall: "#b09a82",
    props: ["#b04a36", "#4e7a8a", "#c4a46a"],
  },
  // A boardwalk pier: white panels over weathered planks.
  de_dogtown: {
    ...TERRACOTTA,
    top: "#ece4d6",
    floor: "#8a6e56",
    wall: "#a49480",
    props: ["#a8503a", "#4f7a8a", "#c8a060"],
  },
  // Mossy jungle stone, deep green.
  de_ancient: {
    ...OVERGROWN,
    sites: {
      A: [-1572, 747, -1278, 952],
      B: [635, -49, 899, 198],
    },
  },
  // A darker, greyer temple under bamboo.
  de_sanctum: {
    ...OVERGROWN,
    top: "#c8cbb8",
    floor: "#5c5e4e",
    wall: "#76786a",
    foliage: "#4a7a34",
    props: ["#7a5a3e", "#5a7a62", "#a89a6a"],
    shadow: "#8a978f",
    occlusion: "#2c3a2a",
  },
  // Jungle ruins with red-painted stone.
  de_eldorado: {
    ...OVERGROWN,
    top: "#d9d2ae",
    floor: "#6e6046",
    wall: "#8e6450",
    props: ["#a8402e", "#4d7c5a", "#b39a52"],
  },
  // Grey castle stone on grass.
  de_cbble: CBBLE,
  de_cbble16: CBBLE,
  // Rail-yard browns, oxide-red brick and green cars.
  de_train: {
    ...RAIL_YARD,
    wall: "#86665a",
    props: ["#8e3f2e", "#3f6e52", "#b89a4a"],
  },
  // Chernobyl concrete greys, faded industrial yellow.
  de_cache: {
    ...RAIL_YARD,
    top: "#d6d4c6",
    floor: "#5f5f55",
    wall: "#88877a",
    foliage: "#647a3a",
    props: ["#c2a548", "#5f7a6a", "#8e5a3e"],
    seeThrough: "#dadad2",
    shadow: "#9c9ea2",
    occlusion: "#33362f",
    outline: "#181a17",
    sites: {
      A: [-452, 1494, -59, 2070],
      B: [-330, -1459, 218, -1022],
    },
  },
  // Prison block: brown walls, olive crates.
  de_warden: {
    ...RAIL_YARD,
    top: "#d8ccb6",
    floor: "#665848",
    wall: "#8a7058",
    props: ["#6e7a4a", "#9a5a3a", "#b8964a"],
  },
  // Dusty works yard.
  rush_001: {
    ...RAIL_YARD,
    top: "#dad0bc",
    floor: "#6c6050",
    wall: "#8e7c66",
    foliage: "#6a7a3a",
    props: ["#9a5a3a", "#5f7462", "#b8a05a"],
  },
  // White and blue steel plant, hazard yellow.
  de_nuke: {
    ...STEEL,
    top: "#d0d7de",
    wall: "#93a0ac",
    props: ["#c9a53a", "#3c8a8a", "#b4553c"],
    sites: {
      A: [493, -964, 905, -497],
      B: [347, -1348, 884, -685],
    },
  },
  // Construction-site concrete, scaffold yellow, sky blue.
  de_vertigo: {
    ...STEEL,
    top: "#cfcec9",
    floor: "#6d6e6c",
    wall: "#999a98",
    props: ["#dbb12a", "#5d8aa8", "#c8603a"],
    seeThrough: "#e6e8e8",
    shadow: "#a3adbe",
    occlusion: "#2c323c",
    outline: "#151a20",
  },
  // Aircraft hangar: white bays, blue and yellow rigs.
  de_assembly: {
    ...STEEL,
    top: "#cdd3d9",
    floor: "#707478",
    wall: "#8e98a4",
    props: ["#d6ae2a", "#3f6f96", "#c0392b"],
  },
  // German park concrete, lush green, blue canal.
  de_overpass: {
    ...PARK,
    sites: {
      A: [-2623, 345, -1753, 982],
      B: [-1266, -157, -961, 226],
    },
  },
  // Half-timbered old town on grey cobbles.
  de_fachwerk: {
    ...PARK,
    top: "#e4dccc",
    floor: "#6e6c66",
    wall: "#9c8470",
    foliage: "#5a8a3a",
    props: ["#8a4a34", "#5a7a6a", "#c0a060"],
    shadow: "#9ea0a6",
    occlusion: "#3a3430",
    outline: "#221c18",
  },
  // Lakeside villa gardens.
  de_memento: {
    ...PARK,
    top: "#ece6d6",
    floor: "#7a7a66",
    foliage: "#3f8a3a",
  },
  // English town in autumn: brick, turning trees.
  de_whistle: {
    ...PARK,
    wall: "#9a6a54",
    foliage: "#9e6a34",
    props: ["#8a3a2e", "#3f6e52", "#c0a060"],
  },
  // City rooftops: concrete and timber decks.
  de_rooftop: {
    ...PARK,
    top: "#e0ddd6",
    floor: "#6f6c68",
    wall: "#8f8378",
    foliage: "#5a8a3a",
  },
  // White marble, navy tiles, pool blue.
  de_poseidon: COASTAL,
  // Harbour timber, sage paint, a green water tower.
  de_debris: {
    ...COASTAL,
    top: "#e6e2d4",
    floor: "#7f7462",
    wall: "#8e9a84",
    foliage: "#5a8a3a",
    props: ["#5d8a7a", "#a8603a", "#c0a070"],
  },
  // Snow outside, grey offices inside.
  // Snow in the yards, carpet and tile indoors.
  cs_office: { ...WINTER, floorOutdoor: "#dde4ec" },
};

/**
 * The palette for a map as played. `*_night` variants are their base map
 * moonlit; anything unknown gets the sun-baked look.
 */
export function paletteFor(map: string): MapPalette {
  const night = map.endsWith("_night");
  const day = PALETTES[night ? map.slice(0, -6) : map] ?? SUN_BAKED;
  return night ? moonlit(day) : day;
}
