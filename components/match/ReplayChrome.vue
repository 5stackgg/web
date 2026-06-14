<script setup lang="ts">
// Shared replay chrome — copied verbatim from Replay3D.vue's bp-* UI so the
// ONE player looks identical in 2D and 3D. Purely presentational: it renders
// HUD / kill feed / play-by-play / scoreboard / transport over whatever map
// the host (ReplayViewer) shows underneath. All data + actions come via props.
import { weaponIconPath } from "~/utilities/weaponIcon";
import Kbd from "~/components/ui/kbd/Kbd.vue";
import KbdGroup from "~/components/ui/kbd/KbdGroup.vue";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "~/components/ui/tooltip";

type Row = {
  sid: string;
  idx: number;
  name: string;
  side: number; // 0 = CT, 1 = T
  alive: boolean;
  hp: number;
  armor: number;
  helmet: boolean;
  k: number;
  d: number;
  a: number;
  dmg: number;
  weapon: string | null;
  nades: string[];
  bomb: boolean;
  kit: boolean;
  avatarUrl: string | null;
};
type PbpEvent = {
  time: string;
  killer?: string;
  victim?: string;
  weapon?: string;
  hs?: boolean;
  kc?: string;
  vc?: string;
  bomb?: string;
  util?: string | null;
  gi?: number;
  thrower?: string;
  tc?: string;
};

const props = defineProps<{
  hud: { ct: number; t: number; round: number; clock: string; bomb: string; bombClass: string };
  teamA: Row[];
  teamB: Row[];
  sideA: number;
  aliveA: number;
  aliveB: number;
  feed: Array<{ k: string; v: string; weapon: string; hs: boolean; kc: string; vc: string }>;
  pbp: PbpEvent[];
  roundSummary?: string;
  rounds: Array<{ i: number; n: number; win: number }>;
  activeRoundUI: number;
  utilMarkers: Array<{ frac: number; icon: string; gi?: number }>;
  tickMarkers: Array<{ frac: number; cls: string }>;
  typeFilter: Record<string, boolean>;
  selectedGi: number[];
  playing: boolean;
  speed: number;
  seekFrac: number;
  timeLabel?: string;
  // 2D/3D map toggle (the only difference between the two views)
  view?: "2d" | "3d";
  onView?: (v: "2d" | "3d") => void;
  // buy-round overlay active — hides round-relative seek markers (they don't
  // map onto the shared window clock).
  overlay?: boolean;
  // 3D-only controls (camera dock); hidden in 2D
  show3d?: boolean;
  camMode?: string;
  showPbp?: boolean;
  heatOn?: boolean;
  followName?: string | null;
  ctHex?: string;
  tHex?: string;
  // buy-round overlay: round tabs double as the multi-select; selected = full
  // opacity, others dimmed.
  overlayRounds?: number[];
  overlayWindow?: number;
  onOverlayWindow?: (n: number) => void;
  // scoreboard-side toggles
  showAvatars?: boolean;
  traceOn?: boolean;
  showDeaths?: boolean;
  // callbacks
  onPlay: () => void;
  onSeek: (frac: number) => void;
  onSpeed: (s: number) => void;
  onSelectRound: (i: number) => void;
  onFollowRow: (sid: string) => void;
  onToggleType: (ty: string) => void;
  onTogglePbp?: () => void;
  onToggleHeat?: () => void;
  onMode?: (m: string) => void;
  onPbpUtil?: (gi: number) => void;
  onClearSel?: () => void;
  onToggleOverlay?: () => void;
  onToggleOverlayRound?: (rn: number) => void;
  onToggleAvatars?: () => void;
  onToggleTrace?: () => void;
  onToggleDeaths?: () => void;
}>();

const UTIL_TYPES = ["Smoke", "Molotov", "HE", "Flash", "Decoy"] as const;
const UTIL_ICON: Record<string, string> = {
  flash: "/img/equipment/flashbang.svg",
  smoke: "/img/equipment/smokegrenade.svg",
  he: "/img/equipment/hegrenade.svg",
  molotov: "/img/equipment/molotov.svg",
  decoy: "/img/equipment/decoy.svg",
};
const UTIL_LEGEND: Record<string, string> = {
  Smoke: "#32d6e0",
  Molotov: "#ff6a1a",
  HE: "#ff3b3b",
  Flash: "#ffd21a",
  Decoy: "#66dd55",
};
const sideHex = (s: number) => (s === 0 ? props.ctHex || "#57cdff" : props.tHex || "#ffb049");
const utilIcon = (ty: string) => UTIL_ICON[ty.toLowerCase()] || "";
const legendCol = (ty: string) => UTIL_LEGEND[ty] || "#9fb0c0";
const selIncludes = (gi: number | undefined) => gi != null && props.selectedGi.includes(gi);
const SPEEDS = [0.5, 1, 2, 4, 8];

// Cluster utility throws that land at (nearly) the same point on the timeline
// so several thrown on the same second can each be fanned out + clicked.
import { computed } from "vue";
const utilClusters = computed(() => {
  const sorted = [...(props.utilMarkers || [])].sort((a, b) => a.frac - b.frac);
  const groups: Array<{ frac: number; items: typeof sorted }> = [];
  const TH = 0.012; // ~1.2% of the track width counts as "same time"
  for (const m of sorted) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(m.frac - last.frac) <= TH) last.items.push(m);
    else groups.push({ frac: m.frac, items: [m] });
  }
  return groups;
});
</script>

<template>
  <TooltipProvider :delay-duration="250">
  <div class="bp-chrome">
    <!-- HUD -->
    <div class="bp-hud">
      <span class="bp-score"><span class="ct">{{ hud.ct }}</span><span class="sep">:</span><span class="t">{{ hud.t }}</span></span>
      <span class="bp-mid"><b>RD {{ hud.round }}</b><span class="bp-dot">·</span><span v-if="hud.bomb" class="bp-clock" :class="hud.bombClass">{{ hud.bomb }}</span><span v-else class="bp-clock">{{ hud.clock }}</span></span>
    </div>

    <!-- left column: controls row (2D/3D | cam dock) + play-by-play -->
    <div class="bp-left">
      <div class="bp-controls">
        <div class="bp-viewtoggle">
          <Tooltip><TooltipTrigger as-child><button :class="{ on: view === '2d' }" @click="onView && onView('2d')">2D</button></TooltipTrigger><TooltipContent>2D top-down radar view</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger as-child><button :class="{ on: view === '3d' }" @click="onView && onView('3d')">3D</button></TooltipTrigger><TooltipContent>3D map view</TooltipContent></Tooltip>
        </div>
        <span class="bp-pipe">|</span>
        <div class="bp-cam">
          <template v-if="show3d">
            <Tooltip><TooltipTrigger as-child><button :class="{ on: camMode === 'orbit' }" @click="onMode && onMode('orbit')">ORBIT</button></TooltipTrigger><TooltipContent>Orbit camera — left-drag look, right-drag orbit, scroll zoom, WASD fly</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger as-child><button :class="{ on: camMode === 'top' }" @click="onMode && onMode('top')">TOP</button></TooltipTrigger><TooltipContent>Top-down camera</TooltipContent></Tooltip>
            <Tooltip v-if="followName"><TooltipTrigger as-child><button :class="{ on: camMode === 'follow' }" @click="onMode && onMode('follow')">CHASE</button></TooltipTrigger><TooltipContent>Chase the followed player</TooltipContent></Tooltip>
          </template>
          <!-- PLAYS + HEAT work in both 2D and 3D -->
          <Tooltip><TooltipTrigger as-child><button :class="{ on: showPbp }" @click="onTogglePbp && onTogglePbp()">PLAY BY PLAY</button></TooltipTrigger><TooltipContent>Show the round's play-by-play event log</TooltipContent></Tooltip>
          <Tooltip v-if="!overlay"><TooltipTrigger as-child><button :class="{ on: heatOn }" @click="onToggleHeat && onToggleHeat()">UTILITY HEATMAP</button></TooltipTrigger><TooltipContent>Utility landing heatmap for the round</TooltipContent></Tooltip>
        </div>
      </div>
      <div v-if="showPbp !== false" class="bp-pbp">
        <div class="bp-pbp-h">
          <span>PLAY BY PLAY · RD {{ hud.round }}</span>
          <button v-if="selectedGi.length" class="pbp-clear" @click="onClearSel && onClearSel()">clear {{ selectedGi.length }}</button>
        </div>
        <div v-if="roundSummary" class="bp-pbp-sum">{{ roundSummary }}</div>
        <div v-if="!pbp.length" class="bp-pbp-empty">no events yet</div>
        <div v-for="(e, i) in pbp" :key="i" class="bp-pbp-row" :class="{ util: e.util != null, hl: selIncludes(e.gi) }" @click="e.util != null && onPbpUtil && e.gi != null && onPbpUtil(e.gi)">
          <span class="tt">{{ e.time }}</span>
          <template v-if="e.bomb"><span class="bomb">💣 {{ e.bomb }}</span></template>
          <template v-else-if="e.util != null">
            <img :src="utilIcon(e.util)" class="wi util-i" />
            <span class="nm" :style="{ color: e.tc }">{{ e.thrower }}</span>
            <span class="utl">{{ e.util }}</span>
            <span class="pin" v-if="selIncludes(e.gi)">●</span>
          </template>
          <template v-else>
            <span class="nm" :style="{ color: e.kc }">{{ e.killer }}</span>
            <img v-if="weaponIconPath(e.weapon)" :src="weaponIconPath(e.weapon)!" class="wi" />
            <span v-if="e.hs" class="hs">⊕</span>
            <span class="nm" :style="{ color: e.vc }">{{ e.victim }}</span>
          </template>
        </div>
      </div>
    </div>

    <!-- scoreboard -->
    <div class="bp-score-panel">
      <div class="bp-team" v-for="(team, ti) in [{ rows: teamA, side: sideA, score: hud.ct, alive: aliveA }, { rows: teamB, side: 1 - sideA, score: hud.t, alive: aliveB }]" :key="ti">
        <div class="bp-team-h">
          <span class="th-side" :style="{ color: sideHex(team.side) }">{{ team.side === 0 ? 'CT' : 'T' }}</span>
          <span class="th-alive">{{ team.alive }} alive</span>
          <span class="th-score" :style="{ color: sideHex(team.side) }">{{ team.score }}</span>
        </div>
        <div v-for="r in team.rows" :key="r.idx" class="bp-prow" :class="{ dead: !r.alive, foll: followName === r.name }" @click="onFollowRow(r.sid)">
          <span class="accent-bar" :style="{ background: sideHex(r.side) }"></span>
          <div class="prow-top">
            <img v-if="showAvatars !== false && r.avatarUrl" :src="r.avatarUrl" class="av" />
            <svg v-if="followName === r.name" class="eye" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" title="Following on the map"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
            <span class="nm" :class="{ alive: r.alive }">{{ r.name }}</span>
            <span class="kda">{{ r.k }}/{{ r.d }}/{{ r.a }}</span>
            <span class="dmg">{{ r.dmg }}</span>
          </div>
          <div class="prow-bars">
            <div class="hpw"><div class="hpb" :style="{ width: Math.max(0, r.hp) + '%', background: r.hp > 50 ? '#46d36a' : r.hp > 20 ? '#e6c344' : '#e0503e' }"></div></div>
            <div class="armw"><div class="armb" :style="{ width: Math.max(0, Math.min(100, r.armor)) + '%', background: r.helmet ? '#7cd4ff' : '#4a90d6' }"></div></div>
          </div>
          <div class="prow-gear">
            <img :src="r.armor > 0 && r.helmet ? '/img/equipment/armor_helmet.svg' : '/img/equipment/kevlar.svg'" class="eq shield" :class="{ off: r.armor <= 0 }" />
            <img v-if="weaponIconPath(r.weapon)" :src="weaponIconPath(r.weapon)!" class="eq gun" />
            <span v-else-if="r.weapon" class="gun-x">{{ r.weapon }}</span>
            <span class="util">
              <img v-for="(u, ui) in r.nades" :key="ui" :src="UTIL_ICON[u.toLowerCase()]" class="eq nade" :title="u" />
            </span>
            <span class="badges">
              <img v-if="r.kit" src="/img/equipment/defuser.svg" class="eq kit" title="Defuse kit" />
              <img v-if="r.bomb" src="/img/equipment/c4.svg" class="eq c4" title="Bomb carrier" />
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- scoreboard-side toggles (left of the CT scoreboard) -->
    <div class="bp-sb-tools">
      <Tooltip>
        <TooltipTrigger as-child>
          <button class="sbt sbt-icon" :class="{ on: showAvatars }" @click="onToggleAvatars && onToggleAvatars()">
            <svg v-if="showAvatars" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
            <span v-else style="font-weight:700">#</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{{ showAvatars ? "Showing avatars — click for numbers" : "Showing numbers — click for avatars" }}</TooltipContent>
      </Tooltip>
      <Tooltip v-if="view === '2d'">
        <TooltipTrigger as-child>
          <button class="sbt" :class="{ on: traceOn }" @click="onToggleTrace && onToggleTrace()">TRACE</button>
        </TooltipTrigger>
        <TooltipContent>Player movement trace (dotted path)</TooltipContent>
      </Tooltip>
      <Tooltip v-if="view === '2d'">
        <TooltipTrigger as-child>
          <button class="sbt" :class="{ on: showDeaths }" @click="onToggleDeaths && onToggleDeaths()">☠</button>
        </TooltipTrigger>
        <TooltipContent>Death (kill-location) markers</TooltipContent>
      </Tooltip>
    </div>

    <!-- transport -->
    <div class="bp-bar">
      <div class="bp-toprow">
        <div class="bp-rounds">
          <!-- buy-round overlay toggle sits in front of round 1 -->
          <Tooltip>
            <TooltipTrigger as-child>
              <button class="rt buyt" :class="{ on: overlay }" @click="onToggleOverlay && onToggleOverlay()">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
                <span>UTIL SUMMARY</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Utility Summary — stack multiple buy rounds on one shared clock to compare each team's utility setups, timings and positions</TooltipContent>
          </Tooltip>
          <Tooltip v-for="r in rounds" :key="r.i">
            <TooltipTrigger as-child>
              <button
                class="rt"
                :class="[
                  overlay
                    ? { selsel: (overlayRounds || []).includes(r.n), seldim: !(overlayRounds || []).includes(r.n) }
                    : { on: activeRoundUI === r.i },
                  r.win === 0 ? 'win-ct' : r.win === 1 ? 'win-t' : '',
                ]"
                @click="overlay ? (onToggleOverlayRound && onToggleOverlayRound(r.n)) : onSelectRound(r.i)"
              >{{ r.n }}</button>
            </TooltipTrigger>
            <TooltipContent>{{ overlay ? `Round ${r.n} — click to ${(overlayRounds || []).includes(r.n) ? "remove from" : "add to"} the summary` : `Jump to round ${r.n}` }}</TooltipContent>
          </Tooltip>
        </div>
        <div class="bp-filters">
          <span class="flbl">UTIL</span>
          <Tooltip v-for="ty in UTIL_TYPES" :key="ty">
            <TooltipTrigger as-child>
              <button class="fbtn" :class="{ off: !typeFilter[ty] }" :style="typeFilter[ty] ? { borderColor: legendCol(ty), background: legendCol(ty) + '22' } : {}" @click="onToggleType(ty)"><span class="fdot" :style="{ background: legendCol(ty) }"></span><img :src="utilIcon(ty)" /></button>
            </TooltipTrigger>
            <TooltipContent>{{ typeFilter[ty] ? "Hide" : "Show" }} {{ ty }} utility</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div class="bp-transport">
        <Tooltip>
          <TooltipTrigger as-child>
            <button class="play" @click="onPlay">
              <svg v-if="playing" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
              <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 5v14l12-7z" /></svg>
            </button>
          </TooltipTrigger>
          <TooltipContent>{{ playing ? "Pause" : "Play" }} (Space)</TooltipContent>
        </Tooltip>
        <Tooltip v-if="selectedGi.length">
          <TooltipTrigger as-child>
            <button class="hl-clear" @click="onClearSel && onClearSel()">✕ {{ selectedGi.length }}</button>
          </TooltipTrigger>
          <TooltipContent>Clear highlighted utility</TooltipContent>
        </Tooltip>
        <!-- buy-overlay window length, next to the play button -->
        <div v-if="overlay" class="bp-buywin">
          <span class="lbl">WIN</span>
          <input type="range" min="10" max="115" step="5" :value="overlayWindow" @input="(e:any)=>onOverlayWindow && onOverlayWindow(+e.target.value)" />
          <span class="val">{{ overlayWindow }}s</span>
        </div>
        <div class="seek-wrap">
          <!-- utility lane: same-second throws STACK vertically up the tall bar
               so each is individually clickable. -->
          <div v-if="!overlay" class="util-lane">
            <div v-for="(g, gi2) in utilClusters" :key="'g' + gi2" class="util-cluster" :style="{ left: g.frac * 100 + '%' }">
              <Tooltip v-for="(m, mi) in g.items" :key="'u' + mi">
                <TooltipTrigger as-child>
                  <button
                    type="button"
                    class="mk-util-icon"
                    :class="{ hl: selIncludes(m.gi) }"
                    :style="{ bottom: mi * 21 + 'px' }"
                    @click.stop="m.gi != null && onPbpUtil && onPbpUtil(m.gi)"
                  >
                    <img :src="m.icon" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{{ (m as any).name || "Utility" }} — {{ (m as any).type || "util" }}{{ selIncludes(m.gi) ? " (selected — click to clear)" : " (click to highlight)" }}</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div class="seek-rail"><div class="seek-fill" :style="{ width: seekFrac * 100 + '%' }"></div></div>
          <input class="seek" type="range" min="0" max="1000" :value="Math.round(seekFrac * 1000)" @input="(e:any)=>onSeek(+e.target.value / 1000)" />
          <span v-for="(m, i) in tickMarkers" v-show="!overlay" :key="'k' + i" class="mk" :class="m.cls" :style="{ left: (m.frac * 100) + '%' }"></span>
        </div>
        <span v-if="timeLabel" class="tl">{{ timeLabel }}</span>
        <select class="spd" @change="(e:any)=>onSpeed(+e.target.value)"><option v-for="s in SPEEDS" :key="s" :value="s" :selected="s === speed">{{ s }}×</option></select>
        <!-- keyboard shortcuts help -->
        <div class="bp-help" tabindex="0">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6" /></svg>
          <div class="bp-help-pop">
            <div class="hk"><KbdGroup><Kbd>Space</Kbd></KbdGroup><span>play / pause</span></div>
            <div class="hk"><KbdGroup><Kbd>←</Kbd><Kbd>→</Kbd></KbdGroup><span>step frame</span></div>
            <div class="hk"><KbdGroup><Kbd>[</Kbd><Kbd>]</Kbd></KbdGroup><span>prev / next round</span></div>
            <div class="hk"><KbdGroup><Kbd>1</Kbd><Kbd>–</Kbd><Kbd>5</Kbd></KbdGroup><span>speed</span></div>
            <template v-if="show3d">
              <div class="hk hk-sep">3D camera</div>
              <div class="hk"><KbdGroup><Kbd>L-drag</Kbd></KbdGroup><span>look / follow-orbit</span></div>
              <div class="hk"><KbdGroup><Kbd>R-drag</Kbd></KbdGroup><span>orbit</span></div>
              <div class="hk"><KbdGroup><Kbd>Scroll</Kbd></KbdGroup><span>zoom</span></div>
              <div class="hk"><KbdGroup><Kbd>W</Kbd><Kbd>A</Kbd><Kbd>S</Kbd><Kbd>D</Kbd></KbdGroup><span>fly</span></div>
              <div class="hk"><KbdGroup><Kbd>Shift</Kbd><Kbd>Ctrl</Kbd></KbdGroup><span>up / down</span></div>
              <div class="hk"><KbdGroup><Kbd>Q</Kbd><Kbd>E</Kbd></KbdGroup><span>up / down</span></div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
  </TooltipProvider>
</template>

<style scoped>
.bp-chrome { position: absolute; inset: 0; pointer-events: none; color: #d6e0ea; font-family: "Oxanium", system-ui, sans-serif; user-select: none;
  --accent: #57cdff; --ct: #57cdff; --t: #ffb049; --panel: rgba(12,15,20,0.82); --line: rgba(120,140,165,0.18); }
.bp-chrome > * { pointer-events: auto; }
.bp-chrome img { -webkit-user-drag: none; }
/* HUD */
.bp-hud { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); z-index: 10; display: flex; flex-direction: column; align-items: center; gap: 1px; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 5px 18px 6px; backdrop-filter: blur(8px); }
.bp-score { font-size: 23px; font-weight: 700; letter-spacing: 1px; font-variant-numeric: tabular-nums; line-height: 1; }
.bp-score .ct { color: var(--ct); } .bp-score .t { color: var(--t); } .bp-score .sep { color: #56606e; margin: 0 6px; }
.bp-mid { display: flex; align-items: baseline; gap: 6px; line-height: 1; }
.bp-mid b { font-size: 10px; letter-spacing: 2px; color: #8a98a8; } .bp-mid .bp-dot { color: #4a545f; }
.bp-clock { font-size: 13px; font-variant-numeric: tabular-nums; color: #e3edf6; }
.bp-clock.bomb { color: #ff6452; font-weight: 700; } .bp-clock.ct { color: var(--ct); }
/* left column */
.bp-left { position: absolute; top: 14px; left: 14px; z-index: 10; width: 264px; display: flex; flex-direction: column; gap: 8px; }
.bp-feed { display: flex; flex-direction: column; gap: 4px; pointer-events: none; }
.bp-kf { display: flex; align-items: center; gap: 7px; background: var(--panel); border-left: 2px solid var(--accent); padding: 3px 9px; border-radius: 4px; font-size: 12px; }
.bp-kf .nm { font-weight: 600; } .bp-kf .wi { height: 15px; filter: brightness(0) invert(1); opacity: 0.95; } .bp-kf .wn { color: #9fb6cc; font-size: 11px; } .bp-kf .hs { color: #ffd24d; font-weight: 700; }
.bp-pbp { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 7px 8px; max-height: 42vh; overflow-y: auto; }
.bp-pbp-h { font-size: 10px; letter-spacing: 2px; color: #7f8fa0; margin-bottom: 3px; display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.pbp-clear { background: color-mix(in srgb, var(--accent) 16%, transparent); border: 1px solid var(--accent); color: var(--accent); font-family: inherit; font-size: 9px; letter-spacing: 1px; padding: 2px 7px; border-radius: 4px; cursor: pointer; text-transform: uppercase; }
.bp-pbp-sum { font-size: 11px; color: #cfe0f2; margin-bottom: 7px; padding-bottom: 6px; border-bottom: 1px solid var(--line); }
.bp-pbp-empty { font-size: 11px; color: #56606e; font-style: italic; }
.bp-pbp-row { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 2px 0; border-top: 1px solid var(--line); }
.bp-pbp-row:first-of-type { border-top: 0; }
.bp-pbp-row .tt { font-size: 10px; color: #6b7785; min-width: 26px; font-variant-numeric: tabular-nums; }
.bp-pbp-row .nm { font-weight: 600; } .bp-pbp-row .wi { height: 14px; filter: brightness(0) invert(1); opacity: 0.95; } .bp-pbp-row .hs { color: #ffd24d; } .bp-pbp-row .bomb { color: #ff8a5a; font-size: 11px; }
.bp-pbp-row.util { cursor: pointer; }
.bp-pbp-row.util:hover { background: rgba(255,255,255,0.05); border-radius: 4px; }
.bp-pbp-row.util.hl { background: color-mix(in srgb, var(--accent) 18%, transparent); border-radius: 4px; }
.bp-pbp-row .util-i { height: 15px; opacity: 0.95; filter: brightness(0) invert(1); } .bp-pbp-row .utl { font-size: 10px; color: #8a98a8; text-transform: uppercase; letter-spacing: 0.5px; } .bp-pbp-row .pin { color: var(--accent); margin-left: auto; font-size: 9px; }
/* scoreboard */
.bp-score-panel { position: absolute; top: 14px; right: 14px; z-index: 10; width: 256px; display: flex; flex-direction: column; gap: 9px; }
.bp-team { background: var(--panel); border: 1px solid var(--line); border-radius: 7px; padding: 6px; }
.bp-team-h { display: grid; grid-template-columns: auto 1fr auto; align-items: center; font-size: 11px; letter-spacing: 1px; padding: 2px 4px 6px; font-weight: 700; }
.bp-team-h .th-alive { text-align: center; color: #6b7785; font-weight: 400; letter-spacing: 0; font-size: 10px; }
.bp-team-h .th-score { font-size: 15px; }
.bp-prow { position: relative; padding: 4px 6px 5px 9px; border-radius: 5px; cursor: pointer; }
.bp-prow + .bp-prow { margin-top: 2px; }
.bp-prow:hover { background: rgba(255,255,255,0.05); }
.bp-prow.foll { background: color-mix(in srgb, var(--accent) 14%, transparent); }
.bp-prow.dead { opacity: 0.42; }
.bp-prow .accent-bar { position: absolute; left: 0; top: 4px; bottom: 4px; width: 2.5px; border-radius: 2px; }
.prow-top { display: flex; align-items: center; gap: 6px; }
.prow-top .av { width: 16px; height: 16px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.prow-top .eye { color: var(--accent); flex-shrink: 0; }
.bp-sb-tools .sbt-icon { display: inline-flex; align-items: center; justify-content: center; }
.prow-top .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #9fb0c0; font-size: 13px; flex: 1; }
.prow-top .nm.alive { color: #f0f6fc; }
.prow-top .kda { font-size: 11px; color: #7f8fa0; font-variant-numeric: tabular-nums; }
.prow-top .dmg { font-size: 10px; color: #6b7785; font-variant-numeric: tabular-nums; min-width: 22px; text-align: right; }
.prow-bars { display: flex; flex-direction: column; gap: 2px; margin-top: 3px; }
.hpw { height: 5px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; }
.hpb { height: 100%; border-radius: 2px; }
.armw { height: 3px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; }
.armb { height: 100%; border-radius: 2px; }
.prow-gear { display: flex; align-items: center; gap: 5px; margin-top: 5px; min-height: 18px; }
.eq { height: 17px; width: auto; filter: brightness(2.6); opacity: 1; }
.eq.gun { height: 20px; }
.eq.nade { height: 16px; }
.eq.kit { filter: invert(58%) sepia(80%) saturate(700%) hue-rotate(150deg); }
.eq.c4 { filter: invert(40%) sepia(90%) saturate(2000%) hue-rotate(330deg); }
.gun-x { font-size: 10px; color: #8a98a8; }
.eq.shield { height: 16px; }
.eq.shield.off { opacity: 0.25; }
.prow-gear .util { display: flex; gap: 3px; margin-left: auto; }
.prow-gear .badges { display: flex; gap: 3px; }
/* controls row: 2D/3D | cam dock — single line (overflows the 264px column) */
.bp-controls { display: flex; align-items: center; gap: 5px; flex-wrap: nowrap; width: max-content; }
.bp-pipe { color: var(--line); font-size: 15px; }
.bp-controls .bp-cam { width: auto; gap: 4px; }
.bp-controls .bp-cam button { flex: 0 0 auto; padding: 6px 7px; }
/* 2D/3D toggle */
.bp-viewtoggle { display: flex; gap: 4px; }
.bp-viewtoggle button { background: var(--panel); border: 1px solid var(--line); color: #9fb0c0; font-family: inherit; font-size: 11px; font-weight: 700; letter-spacing: 1px; padding: 5px 14px; border-radius: 4px; cursor: pointer; backdrop-filter: blur(6px); }
.bp-viewtoggle button:hover { border-color: var(--accent); color: #f0f6fc; }
.bp-viewtoggle button.on { background: color-mix(in srgb, var(--accent) 18%, transparent); border-color: var(--accent); color: #fff; }
/* camera dock */
.bp-cam { display: flex; gap: 5px; width: 100%; }
.bp-cam button { flex: 1 1 0; min-width: 0; background: var(--panel); border: 1px solid var(--line); color: #9fb0c0; font-family: inherit; font-size: 10px; letter-spacing: 1px; padding: 6px 4px; border-radius: 4px; cursor: pointer; backdrop-filter: blur(6px); }
.bp-cam button:hover { border-color: var(--accent); color: #f0f6fc; }
.bp-cam button.on { background: color-mix(in srgb, var(--accent) 16%, transparent); border-color: var(--accent); color: #fff; }
.bp-foll { font-size: 11px; letter-spacing: 1px; color: var(--t); padding: 2px 8px; background: var(--panel); border: 1px solid color-mix(in srgb, var(--t) 40%, transparent); border-radius: 4px; align-self: flex-start; }
/* transport */
.bp-bar { position: absolute; left: 0; right: 0; bottom: 0; z-index: 10; display: flex; flex-direction: column; gap: 7px; padding: 9px 14px 10px; background: linear-gradient(0deg, rgba(8,10,14,0.96), rgba(8,10,14,0)); }
.bp-toprow { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.bp-rounds { display: flex; gap: 3px; flex-wrap: wrap; }
.bp-filters { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.bp-filters .flbl { font-size: 9px; letter-spacing: 1.5px; color: #6b7785; margin-right: 2px; }
.bp-filters .fbtn { background: rgba(255,255,255,0.05); border: 1px solid var(--line); border-radius: 4px; padding: 3px 5px; cursor: pointer; display: flex; align-items: center; gap: 3px; }
.bp-filters .fbtn .fdot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.bp-filters .fbtn img { width: auto; height: 16px; max-width: 16px; object-fit: contain; }
.bp-filters .fbtn:hover { border-color: var(--accent); }
.bp-filters .fbtn.off { opacity: 0.4; }
.bp-filters .fbtn.off img { filter: grayscale(1); opacity: 0.6; }
.bp-filters .fclear { background: color-mix(in srgb, var(--accent) 14%, transparent); border: 1px solid var(--accent); color: var(--accent); font-family: inherit; font-size: 10px; padding: 4px 8px; border-radius: 4px; cursor: pointer; margin-left: 4px; }
.bp-rounds .rt { background: rgba(255,255,255,0.04); border: 1px solid var(--line); border-bottom-width: 2px; border-bottom-color: var(--line); color: #8a98a8; font-family: inherit; font-size: 11px; font-variant-numeric: tabular-nums; padding: 3px 8px; border-radius: 4px; cursor: pointer; }
.bp-rounds .rt:hover { color: #f0f6fc; }
.bp-rounds .rt.win-ct { border-bottom-color: var(--ct); } .bp-rounds .rt.win-t { border-bottom-color: var(--t); }
.bp-rounds .rt.buyt { display: inline-flex; align-items: center; gap: 4px; color: #c7d2dd; letter-spacing: 0.5px; font-size: 10px; }
.bp-rounds .rt.buyt.on { background: color-mix(in srgb, var(--accent) 26%, transparent); border-color: var(--accent); color: #fff; box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 55%, transparent); }
/* overlay round multi-select: selected = bright, others dimmed */
.bp-rounds .rt.selsel { background: color-mix(in srgb, var(--accent) 20%, transparent); border-color: var(--accent); color: #fff; }
.bp-rounds .rt.seldim { opacity: 0.32; }
.bp-rounds .rt.seldim:hover { opacity: 0.7; }
/* scoreboard-side tools */
.bp-sb-tools { position: absolute; top: 14px; right: 278px; z-index: 10; display: flex; flex-direction: column; gap: 5px; }
.bp-sb-tools .sbt { min-width: 34px; height: 26px; padding: 0 6px; background: var(--panel); border: 1px solid var(--line); color: #9fb0c0; font-family: inherit; font-size: 10px; font-weight: 700; letter-spacing: 1px; border-radius: 4px; cursor: pointer; backdrop-filter: blur(6px); }
.bp-sb-tools .sbt:hover { border-color: var(--accent); color: #f0f6fc; }
.bp-sb-tools .sbt.on { background: color-mix(in srgb, var(--accent) 18%, transparent); border-color: var(--accent); color: #fff; }
.bp-rounds .rt.on { background: color-mix(in srgb, var(--accent) 18%, transparent); color: #fff; border-color: var(--accent); }
.bp-transport { display: flex; align-items: center; gap: 10px; }
.bp-transport > * { flex-shrink: 0; }
.bp-transport .seek-wrap { flex-shrink: 1; }
.bp-transport button, .bp-transport select { background: rgba(255,255,255,0.05); border: 1px solid var(--line); color: #d6e0ea; font-family: inherit; border-radius: 4px; padding: 5px 10px; cursor: pointer; }
.bp-transport button:hover { border-color: var(--accent); }
.bp-transport .play { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; padding: 0; color: var(--accent); border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent); background: color-mix(in srgb, var(--accent) 12%, rgba(255,255,255,0.04)); border-radius: 50%; }
.bp-transport .play:hover { background: color-mix(in srgb, var(--accent) 22%, transparent); border-color: var(--accent); box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 45%, transparent); }
.bp-transport .hl-clear { font-size: 10px; font-weight: 700; color: var(--accent); border: 1px solid var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); border-radius: 4px; padding: 5px 8px; }
.bp-buywin { display: flex; align-items: center; gap: 6px; padding: 4px 8px; border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent); border-radius: 4px; flex-shrink: 0; }
.bp-buywin .lbl { font-size: 9px; letter-spacing: 1px; color: var(--accent); }
.bp-buywin input { width: 80px; accent-color: var(--accent); }
.bp-buywin .val { font-size: 10px; font-variant-numeric: tabular-nums; color: var(--accent); min-width: 26px; }
/* "audio-editor" seek: a tall track that FILLS the wrap (so everything in the
   transport row vertically centers against it), translucent played-tint, util
   icons stacked over the track, kill/bomb dashes, and a vertical playhead. */
.seek-wrap { position: relative; flex: 1; min-width: 200px; height: 60px; }
.seek-wrap .seek-rail { position: absolute; left: 0; right: 0; top: 4px; bottom: 4px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.06); border-radius: 5px; overflow: hidden; }
.seek-wrap .seek-fill { height: 100%; background: var(--accent); opacity: 0.16; }
.seek-wrap .seek { position: absolute; left: 0; right: 0; top: 0; bottom: 0; width: 100%; height: 100%; margin: 0; background: transparent; -webkit-appearance: none; appearance: none; z-index: 6; cursor: pointer; }
.seek-wrap .seek::-webkit-slider-runnable-track { background: transparent; height: 100%; }
.seek-wrap .seek::-moz-range-track { background: transparent; height: 100%; }
.seek-wrap .seek::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 4px; height: 56px; border-radius: 2px; background: #fff; box-shadow: 0 0 0 1px rgba(8,10,14,0.9), 0 0 10px color-mix(in srgb, var(--accent) 80%, transparent); cursor: pointer; }
.seek-wrap .seek::-moz-range-thumb { width: 4px; height: 56px; border-radius: 2px; background: #fff; border: none; cursor: pointer; }
/* utility lane overlays the track; clusters STACK their icons vertically */
.seek-wrap .util-lane { position: absolute; left: 0; right: 0; top: 4px; bottom: 4px; pointer-events: none; z-index: 5; }
.util-cluster { position: absolute; bottom: 3px; }
.mk-util-icon { position: absolute; bottom: 0; left: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; transform: translateX(-50%); border: 1px solid rgba(255,255,255,0.14); background: rgba(14,18,24,0.92); border-radius: 5px; cursor: pointer; pointer-events: auto; transition: border-color 0.1s, box-shadow 0.1s; padding: 0; }
.mk-util-icon img { width: auto; height: 15px; max-width: 16px; object-fit: contain; }
.mk-util-icon:hover { z-index: 7; border-color: rgba(255,255,255,0.45); }
.mk-util-icon.hl { z-index: 8; border-color: var(--accent); background: color-mix(in srgb, var(--accent) 30%, rgba(14,18,24,0.92)); box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 70%, transparent); }
.mk-util-icon.hl img { filter: brightness(3) drop-shadow(0 0 3px var(--accent)); }
/* kill / bomb dashes span the full track height, on top of the fill */
.seek-wrap .mk { position: absolute; top: 6px; bottom: 6px; width: 2.5px; transform: translateX(-50%); border-radius: 1px; pointer-events: none; z-index: 4; opacity: 0.9; }
.seek-wrap .mk.mk-ct { background: var(--ct); } .seek-wrap .mk.mk-t { background: var(--t); }
.seek-wrap .mk.mk-bomb { background: #ff5a4d; width: 3px; box-shadow: 0 0 5px #ff5a4d; }
.bp-transport .tl { font-size: 14px; font-weight: 600; color: #c4d2df; font-variant-numeric: tabular-nums; min-width: 96px; text-align: center; letter-spacing: 0.5px; }
.spd { min-width: 62px; height: 44px; font-weight: 600; }
.bp-buywin { height: 44px; }
/* keyboard help — full-height end button */
.bp-help { position: relative; display: flex; align-items: center; justify-content: center; width: 40px; height: 44px; color: #9fb0c0; border: 1px solid var(--line); border-radius: 4px; cursor: help; background: rgba(255,255,255,0.05); }
.bp-help:hover, .bp-help:focus { border-color: var(--accent); color: #f0f6fc; outline: none; }
.bp-help-pop { position: absolute; bottom: calc(100% + 8px); right: 0; width: max-content; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 9px 11px; backdrop-filter: blur(8px); opacity: 0; visibility: hidden; transition: opacity 0.12s; display: flex; flex-direction: column; gap: 5px; z-index: 30; }
.bp-help:hover .bp-help-pop, .bp-help:focus .bp-help-pop { opacity: 1; visibility: visible; }
.bp-help-pop .hk { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #c4d2df; }
.bp-help-pop .hk span { color: #8a98a8; }
.bp-help-pop .hk-sep { display: block; margin-top: 4px; padding-top: 5px; border-top: 1px solid var(--line); color: #6b7785; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; }
</style>
