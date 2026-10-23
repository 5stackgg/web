import { readUtilityMissPattern } from "~/types/utility";
import type {
  UtilityLineup,
  UtilityTechnique,
  UtilityType,
} from "~/types/utility";
import type { UtilityMapTile } from "~/composables/useUtilityMaps";
import type { UtilityRunUp } from "~/utilities/utilityThrowGuide";
import mapLabel from "~/utilities/mapLabel";

export const DEMO_UTILITY_MAP = "de_mirage";

// rawr wrote them, and the page is drawn the way rawr sees it.
const RAWR = "demo-rawr";

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString();

// Real lineups from 5stack.gg's Mirage library. The Window smoke's render
// (preview clip and stills) is kept in the repo so any instance can play it.
const MEDIA = "/landing/utility/window-smoke";

type Throw = Pick<
  UtilityLineup,
  | "id"
  | "name"
  | "utility_type"
  | "technique"
  | "jump_throw_bind"
  | "origin_x"
  | "origin_y"
  | "origin_z"
  | "eye_z"
  | "view_yaw"
  | "view_pitch"
  | "land_x"
  | "land_y"
  | "land_z"
  | "flight_time_ms"
  | "trajectory_preview"
> &
  Partial<UtilityLineup>;

function lineup(fields: Throw): UtilityLineup {
  return {
    map_name: DEMO_UTILITY_MAP,
    side: "TERRORIST",
    throw_strength: "Full",
    difficulty: "unmeasured",
    upvotes: 0,
    downvotes: 0,
    favorites: 0,
    description: null,
    tags: [],
    visibility: "Public",
    team_id: null,
    author_steam_id: RAWR,
    origin_source: "plugin",
    confidence: "exact",
    verified_at: null,
    can_view: true,
    can_edit: false,
    my_vote: null,
    is_favorited: false,
    progress: null,
    author: { steam_id: RAWR, name: "rawr", avatar_url: null },
    ...fields,
  };
}

// The rest of the Mirage library, as the board draws it: where each one is
// thrown from and where it lands.
type Point = [number, number, number];

const LIBRARY: Array<
  [string, string, UtilityType, UtilityTechnique, Point, Point]
> = [
  [
    "eaf9d0f1-8280-4d4e-af83-3ce20f7e5946",
    "Clear Smoke in Snipers Nest",
    "HighExplosive",
    "CrouchJump",
    [-1248, -924, -168],
    [-1069, -643, -169],
  ],
  [
    "a4f368aa-1df7-4184-822a-de9efa0ebc02",
    "Middle Smoke from Top of Mid",
    "Smoke",
    "Jump",
    [343, -622, -162],
    [-613, -802, -42],
  ],
  [
    "ded32197-7cec-4fb3-8dbb-ebce31137662",
    "CT A Smoke from T Spawn",
    "Smoke",
    "Jump",
    [1097, -1007, -257],
    [-888, -2426, -109],
  ],
  [
    "3bd34420-8f0c-43c1-afdc-f9d979d2e9a7",
    "Jungle Smoke from Palace Alley",
    "Smoke",
    "Jump",
    [909, -1036, -252],
    [-637, -1678, -174],
  ],
  [
    "2747df74-24a7-42ea-8326-a8c96ed1bd96",
    "Market Window Smoke",
    "Smoke",
    "Jump",
    [-160, 888, -135],
    [-1923, -280, -126],
  ],
  [
    "b30eefc7-52eb-4c77-b42e-064df0d31bb0",
    "A Site Flash from Palace Alley",
    "Flash",
    "Stationary",
    [871, -1036, -252],
    [114, -1408, 109],
  ],
  [
    "ab2980f6-4b52-408b-9b31-9a06b683ba21",
    "Stairs Smoke from Palace Alley",
    "Smoke",
    "Jump",
    [909, -1036, -252],
    [-503, -1537, -38],
  ],
  [
    "a0e203a9-d750-4303-afdd-0f0f7a391b24",
    "T Ramp Molotov from A Site",
    "Molotov",
    "Running",
    [-850, -2381, -169],
    [253, -1535, -106],
  ],
  [
    "dce9a6cf-217d-4d28-a39d-6866e315090a",
    "B Site Cat Smoke from Back Alley",
    "Smoke",
    "Stationary",
    [-160, 888, -135],
    [-1214, 230, -167],
  ],
  [
    "cc374642-8417-43d0-bf42-20d87bcec4bb",
    "Market Smoke from Back Alley",
    "Smoke",
    "Jump",
    [-160, 888, -135],
    [-2331, -274, -166],
  ],
];

export const DEMO_UTILITY_LINEUPS: UtilityLineup[] = [
  lineup({
    id: "aacb3dc4-1db6-4a92-a2e6-9e38b6311473",
    name: "Window Smoke from T Spawn",
    utility_type: "Smoke",
    technique: "WalkJump",
    jump_throw_bind: true,
    origin_x: 1421.99,
    origin_y: 36.44,
    origin_z: -167.97,
    eye_z: -96.23,
    view_yaw: -164.8,
    view_pitch: -32.99,
    land_x: -1170.13,
    land_y: -618.51,
    land_z: -165.97,
    flight_time_ms: 7203,
    trajectory_preview: [
      [1390, 29, -46],
      [1232, -8, 136],
      [1074, -45, 292],
      [916, -83, 423],
      [758, -120, 529],
      [600, -157, 610],
      [442, -195, 665],
      [284, -232, 695],
      [127, -269, 699],
      [-31, -306, 679],
      [-189, -344, 633],
      [-347, -381, 561],
      [-505, -418, 465],
      [-663, -455, 343],
      [-803, -489, 213],
      [-944, -522, 63],
      [-1132, -566, -163],
      [-1165, -574, -125],
      [-1199, -582, -97],
      [-1232, -590, -81],
      [-1261, -597, -76],
      [-1248, -600, -81],
      [-1232, -604, -97],
      [-1201, -611, -166],
      [-1189, -614, -148],
      [-1176, -617, -165],
      [-1171, -618, -166],
      [-1170, -619, -166],
    ],
    preview_url: `${MEDIA}.mp4`,
    preview_thumbnail_url: `${MEDIA}.webp`,
    preview_duration_ms: 17950,
    preview_stills_url: {
      aim: `${MEDIA}-aim.webp`,
      stance: `${MEDIA}-stance.webp`,
      aim_pin: `${MEDIA}-aim_pin.webp`,
      landing: `${MEDIA}-landing.webp`,
      aim_close: `${MEDIA}-aim_close.webp`,
      stance_eyes: `${MEDIA}-stance_eyes.webp`,
    },
    can_edit: true,
    progress: [
      {
        utility_lineup_id: "aacb3dc4-1db6-4a92-a2e6-9e38b6311473",
        steam_id: RAWR,
        attempts: 66,
        successes: 50,
        current_streak: 4,
        best_streak: 34,
        last_practiced_at: daysAgo(7),
        mastered_at: daysAgo(12),
      },
    ],
  }),
  lineup({
    id: "83b3eed6-b84f-4b9f-a347-6b260e5a61a4",
    name: "Connector Smoke from T Spawn",
    utility_type: "Smoke",
    technique: "Jump",
    jump_throw_bind: true,
    origin_x: 1422.81,
    origin_y: 36.44,
    origin_z: -167.97,
    eye_z: -95.48,
    view_yaw: -158.06,
    view_pitch: -19.91,
    land_x: -622.59,
    land_y: -893.49,
    land_z: -245.97,
    flight_time_ms: 5672,
    trajectory_preview: [
      [1392, 24, -52],
      [1254, -32, 82],
      [1132, -80, 183],
      [994, -136, 280],
      [855, -192, 357],
      [734, -241, 408],
      [595, -297, 447],
      [474, -346, 465],
      [336, -401, 467],
      [214, -450, 452],
      [76, -506, 416],
      [-63, -562, 361],
      [-202, -618, 285],
      [-323, -667, 202],
      [-461, -722, 89],
      [-600, -778, -44],
      [-724, -830, -184],
      [-664, -854, -260],
      [-630, -867, -225],
      [-613, -874, -218],
      [-594, -882, -220],
      [-612, -889, -246],
      [-617, -891, -240],
      [-621, -893, -246],
      [-623, -893, -246],
    ],
  }),
  lineup({
    id: "1ded981b-c046-4310-9fed-3ff0c162ebae",
    name: "A Site Under Palace Molotov",
    utility_type: "Molotov",
    technique: "Running",
    jump_throw_bind: false,
    origin_x: 140.52,
    origin_y: -1461.07,
    origin_z: -175.97,
    eye_z: -112,
    view_yaw: -122.33,
    view_pitch: -4.39,
    land_x: 48.73,
    land_y: -1945.46,
    land_z: -165.97,
    flight_time_ms: 1656,
    trajectory_preview: [
      [105, -1517, -103],
      [26, -1642, -83],
      [-69, -1792, -70],
      [-149, -1918, -67],
      [-228, -2046, -72],
      [-121, -1978, -80],
      [-10, -1909, -118],
      [46, -1944, -163],
    ],
  }),
  lineup({
    id: "df454304-d497-4a39-915f-06b9d893d255",
    name: "B Flash from Back Alley",
    utility_type: "Flash",
    technique: "Jump",
    jump_throw_bind: true,
    origin_x: -475.43,
    origin_y: 620.14,
    origin_z: -80.64,
    eye_z: -7.5,
    view_yaw: -168.86,
    view_pitch: -13.55,
    land_x: -1487.47,
    land_y: 420.78,
    land_z: 449.26,
    flight_time_ms: 1625,
    trajectory_preview: [
      [-500, 615, 23],
      [-615, 593, 116],
      [-749, 566, 209],
      [-864, 544, 277],
      [-979, 521, 334],
      [-1113, 494, 386],
      [-1229, 472, 418],
      [-1344, 449, 439],
      [-1478, 423, 449],
    ],
  }),
  ...LIBRARY.map(([id, name, utility_type, technique, from, to]) =>
    lineup({
      id,
      name,
      utility_type,
      technique,
      jump_throw_bind: null,
      origin_x: from[0],
      origin_y: from[1],
      origin_z: from[2],
      eye_z: null,
      view_yaw: null,
      view_pitch: null,
      land_x: to[0],
      land_y: to[1],
      land_z: to[2],
      flight_time_ms: null,
      trajectory_preview: null,
    }),
  ),
];

export const DEMO_UTILITY_FEATURED = DEMO_UTILITY_LINEUPS[0];

// What the open lineup's panel would ask the api for: the run-up off the
// Window smoke's recorded approach, and its miss pattern, still short of the
// sample floor.
export const DEMO_UTILITY_SNAPSHOT = {
  viewer: RAWR,
  runUp: {
    keys: ["D"],
    walk: false,
    crouch: false,
    jump: true,
    ms: 31,
    capped: false,
  } satisfies UtilityRunUp,
  missPattern: readUtilityMissPattern({
    analysed: false,
    message: null,
    samples: 66,
    players: 1,
    mean_along: null,
    mean_lateral: null,
    mean_vertical: null,
    bias: null,
  }),
};

// The maps rail: every map with a radar, and 5stack.gg's public counts.
export const DEMO_UTILITY_MAPS: {
  tiles: UtilityMapTile[];
  counts: Record<string, number>;
} = {
  tiles: [
    "de_ancient",
    "de_anubis",
    "de_cache",
    "de_dust2",
    "de_inferno",
    "de_mirage",
    "de_nuke",
    "de_overpass",
    "de_train",
    "de_vertigo",
  ].map((name) => ({
    name,
    label: mapLabel({ name }),
    patch: `/img/maps/icons/${name}.svg`,
    poster: `/img/maps/screenshots/${name}.webp`,
  })),
  counts: { de_ancient: 4, de_dust2: 16, de_mirage: 14 },
};
