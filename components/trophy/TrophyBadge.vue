<script setup lang="ts">
import { computed } from "vue";
import {
  fnv1a,
  createSeededRng,
  TIER_PALETTES,
  placementToTier,
  type TrophyTier,
} from "~/utilities/trophySeed";

interface Props {
  tournamentId: string;
  placement: number;
  tournamentName?: string | null;
  tournamentStart?: string | null;
  tournamentType?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  interactive?: boolean;
  silhouetteOverride?: number | null;
  customName?: string | null;
  imageUrl?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  size: "md",
  interactive: true,
  tournamentName: null,
  tournamentStart: null,
  tournamentType: null,
  silhouetteOverride: null,
  customName: null,
  imageUrl: null,
});

const apiDomain = computed(() => useRuntimeConfig().public.apiDomain);
const resolvedImageSrc = computed(() => {
  if (!props.imageUrl) return null;
  if (props.imageUrl.startsWith("http")) return props.imageUrl;
  const filename = props.imageUrl.replace(/^trophies\//, "");
  return `https://${apiDomain.value}/trophies/${filename}`;
});

const SIZES = {
  xs: 32,
  sm: 56,
  md: 112,
  lg: 192,
} as const;

const tier = computed<TrophyTier>(() => placementToTier(props.placement));
const palette = computed(() => TIER_PALETTES[tier.value]);
const seed = computed(() => fnv1a(props.tournamentId));

const variants = computed(() => {
  const rng = createSeededRng(seed.value);
  const hashSilhouette = Math.floor(rng() * 5);
  const ornament = Math.floor(rng() * 3);
  const gemIndex = Math.floor(rng() * palette.value.gem.length);
  const handleStyle = Math.floor(rng() * 3);
  const silhouette =
    props.silhouetteOverride != null &&
    props.silhouetteOverride >= 0 &&
    props.silhouetteOverride <= 4
      ? props.silhouetteOverride
      : hashSilhouette;
  return { silhouette, ornament, gemIndex, handleStyle };
});

const gemColor = computed(() => palette.value.gem[variants.value.gemIndex]);

const year = computed(() => {
  if (!props.tournamentStart) return "";
  const d = new Date(props.tournamentStart);
  if (Number.isNaN(d.getTime())) return "";
  return String(d.getFullYear());
});

const displayName = computed(() => {
  const raw = props.customName || props.tournamentName;
  if (!raw) return "";
  const name = raw.toUpperCase();
  return name.length > 16 ? `${name.slice(0, 14)}…` : name;
});

const gradId = computed(() => `trophy-grad-${seed.value}-${tier.value}`);
const shineId = computed(() => `trophy-shine-${seed.value}-${tier.value}`);
const ornamentId = computed(
  () => `trophy-ornament-${seed.value}-${tier.value}`,
);
const specularId = computed(
  () => `trophy-specular-${seed.value}-${tier.value}`,
);
const plinthId = computed(() => `trophy-plinth-${seed.value}-${tier.value}`);

const pixelSize = computed(() => SIZES[props.size]);
const showEngraving = computed(
  () => props.size === "md" || props.size === "lg",
);
const showOverlay = computed(() => props.size !== "xs");
</script>

<template>
  <div
    :class="[
      'relative inline-flex shrink-0 items-center justify-center',
      interactive &&
        'group/trophy transition-transform duration-300 motion-reduce:transition-none',
      interactive && 'hover:-translate-y-0.5 hover:scale-[1.03]',
    ]"
    :style="{ width: `${pixelSize}px`, height: `${pixelSize}px` }"
  >
    <!-- Custom uploaded image -->
    <div
      v-if="resolvedImageSrc"
      class="relative h-full w-full overflow-hidden rounded-sm border-2 drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]"
      :style="{
        borderColor: palette.primary,
        background: `linear-gradient(180deg, ${palette.highlight}18 0%, ${palette.shadow}12 100%)`,
        clipPath:
          'polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px)',
      }"
    >
      <img
        :src="resolvedImageSrc"
        :alt="customName || tournamentName || palette.label"
        class="h-full w-full object-contain"
        loading="lazy"
      />
      <!-- corner marks -->
      <span
        class="pointer-events-none absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2"
        :style="{ borderColor: palette.primary }"
      ></span>
      <span
        class="pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2"
        :style="{ borderColor: palette.primary }"
      ></span>
      <!-- shine sweep on hover -->
      <span
        v-if="interactive"
        class="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 transition-[transform,opacity] duration-700 motion-reduce:hidden group-hover/trophy:translate-x-[300%] group-hover/trophy:opacity-100"
      ></span>
    </div>
    <svg
      v-if="!resolvedImageSrc"
      :viewBox="`0 0 200 ${showEngraving ? 260 : 220}`"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      :aria-label="`${palette.label} trophy${tournamentName ? ' for ' + tournamentName : ''}`"
      class="h-full w-full drop-shadow-[0_4px_10px_rgba(0,0,0,0.35)]"
    >
      <defs>
        <linearGradient :id="gradId" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" :stop-color="palette.highlight" />
          <stop offset="45%" :stop-color="palette.primary" />
          <stop offset="100%" :stop-color="palette.secondary" />
        </linearGradient>
        <linearGradient :id="shineId" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="white" stop-opacity="0" />
          <stop offset="50%" stop-color="white" stop-opacity="0.55" />
          <stop offset="100%" stop-color="white" stop-opacity="0" />
        </linearGradient>
        <linearGradient :id="specularId" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="white" stop-opacity="0.55" />
          <stop offset="50%" stop-color="white" stop-opacity="0.08" />
          <stop offset="100%" stop-color="white" stop-opacity="0" />
        </linearGradient>
        <linearGradient :id="plinthId" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" :stop-color="palette.secondary" />
          <stop offset="50%" :stop-color="palette.primary" />
          <stop offset="100%" :stop-color="palette.shadow" />
        </linearGradient>
        <pattern
          :id="ornamentId"
          patternUnits="userSpaceOnUse"
          width="14"
          height="14"
          patternTransform="rotate(30)"
        >
          <template v-if="variants.ornament === 0">
            <line
              x1="0"
              y1="7"
              x2="14"
              y2="7"
              :stroke="palette.shadow"
              stroke-width="1.5"
              stroke-opacity="0.35"
            />
          </template>
          <template v-else-if="variants.ornament === 1">
            <circle
              cx="7"
              cy="7"
              r="1.6"
              :fill="palette.shadow"
              fill-opacity="0.35"
            />
          </template>
          <template v-else>
            <path
              d="M0 14 L7 0 L14 14"
              :stroke="palette.shadow"
              stroke-width="1.2"
              stroke-opacity="0.35"
              fill="none"
            />
          </template>
        </pattern>
      </defs>

      <!-- Laurel handles -->
      <g v-if="variants.handleStyle === 0">
        <path
          d="M60 80 Q20 80 20 130 Q20 170 60 170"
          fill="none"
          :stroke="`url(#${gradId})`"
          stroke-width="8"
          stroke-linecap="round"
        />
        <path
          d="M140 80 Q180 80 180 130 Q180 170 140 170"
          fill="none"
          :stroke="`url(#${gradId})`"
          stroke-width="8"
          stroke-linecap="round"
        />
      </g>
      <g v-else-if="variants.handleStyle === 1">
        <path
          d="M60 90 C30 100 30 150 65 155"
          fill="none"
          :stroke="`url(#${gradId})`"
          stroke-width="10"
          stroke-linecap="round"
        />
        <path
          d="M140 90 C170 100 170 150 135 155"
          fill="none"
          :stroke="`url(#${gradId})`"
          stroke-width="10"
          stroke-linecap="round"
        />
      </g>
      <g v-else>
        <path
          d="M62 88 Q25 110 35 150 Q45 175 70 160"
          fill="none"
          :stroke="`url(#${gradId})`"
          stroke-width="7"
          stroke-linejoin="round"
        />
        <path
          d="M138 88 Q175 110 165 150 Q155 175 130 160"
          fill="none"
          :stroke="`url(#${gradId})`"
          stroke-width="7"
          stroke-linejoin="round"
        />
      </g>

      <!-- Silhouette variants -->
      <!-- 0: Classic chalice -->
      <template v-if="variants.silhouette === 0">
        <path
          d="M50 55 L150 55 L145 120 Q140 160 100 170 Q60 160 55 120 Z"
          :fill="`url(#${gradId})`"
          :stroke="palette.shadow"
          stroke-width="2"
        />
      </template>
      <!-- 1: Faceted cup -->
      <template v-else-if="variants.silhouette === 1">
        <path
          d="M55 55 L145 55 L135 100 L140 130 L120 165 L80 165 L60 130 L65 100 Z"
          :fill="`url(#${gradId})`"
          :stroke="palette.shadow"
          stroke-width="2"
        />
      </template>
      <!-- 2: Star-topped cup -->
      <template v-else-if="variants.silhouette === 2">
        <path
          d="M55 70 L145 70 L142 130 Q140 165 100 172 Q60 165 58 130 Z"
          :fill="`url(#${gradId})`"
          :stroke="palette.shadow"
          stroke-width="2"
        />
        <polygon
          points="100,35 107,55 128,55 111,68 118,88 100,76 82,88 89,68 72,55 93,55"
          :fill="palette.highlight"
          :stroke="palette.shadow"
          stroke-width="1.5"
        />
      </template>
      <!-- 3: Shield -->
      <template v-else-if="variants.silhouette === 3">
        <path
          d="M50 55 L150 55 L150 110 Q150 165 100 178 Q50 165 50 110 Z"
          :fill="`url(#${gradId})`"
          :stroke="palette.shadow"
          stroke-width="2"
        />
      </template>
      <!-- 4: Laurel wreath cup -->
      <template v-else>
        <path
          d="M58 55 L142 55 Q148 55 146 65 L138 128 Q135 162 100 172 Q65 162 62 128 L54 65 Q52 55 58 55 Z"
          :fill="`url(#${gradId})`"
          :stroke="palette.shadow"
          stroke-width="2"
        />
        <path
          d="M68 75 Q100 90 132 75"
          fill="none"
          :stroke="palette.shadow"
          stroke-width="1.5"
          stroke-opacity="0.5"
        />
      </template>

      <!-- Ornament pattern overlay on cup -->
      <path
        d="M56 65 L144 65 L138 120 Q135 158 100 168 Q65 158 62 120 Z"
        :fill="`url(#${ornamentId})`"
      />

      <!-- Specular highlight (left edge) -->
      <path
        d="M62 68 Q64 110 76 158"
        fill="none"
        :stroke="`url(#${specularId})`"
        stroke-width="4"
        stroke-linecap="round"
        opacity="0.85"
      />

      <!-- Gem / MVP star -->
      <g v-if="placement === 0">
        <polygon
          points="100,78 106,92 122,92 110,101 114,116 100,107 86,116 90,101 78,92 94,92"
          :fill="palette.highlight"
          :stroke="palette.shadow"
          stroke-width="1.5"
        />
      </g>
      <g v-else>
        <circle
          cx="100"
          cy="95"
          r="10"
          :fill="gemColor"
          :stroke="palette.shadow"
          stroke-width="1.5"
        />
        <circle cx="96" cy="91" r="3" fill="white" fill-opacity="0.7" />
      </g>

      <!-- Type overlay icon -->
      <g v-if="showOverlay && tournamentType" transform="translate(100 140)">
        <g
          :stroke="palette.shadow"
          stroke-width="1.2"
          fill="none"
          stroke-opacity="0.55"
        >
          <!-- Single/Double elimination: bracket -->
          <template v-if="tournamentType === 'SingleElimination'">
            <path d="M-12 -6 L-6 -6 L-6 0 L-12 0" />
            <path d="M-12 0 L-6 0 L-6 6 L-12 6" />
            <path d="M-6 -3 L0 -3" />
            <path d="M-6 3 L0 3" />
            <path d="M0 -3 L0 3" />
            <path d="M0 0 L6 0" />
          </template>
          <template v-else-if="tournamentType === 'DoubleElimination'">
            <path d="M-12 -8 L-6 -8 L-6 -2 L-12 -2" />
            <path d="M-12 2 L-6 2 L-6 8 L-12 8" />
            <path d="M-6 -5 L0 -5 L0 5 L-6 5" />
            <path d="M0 0 L6 0" />
            <path d="M6 -3 L6 3" />
          </template>
          <template v-else-if="tournamentType === 'Swiss'">
            <rect x="-10" y="-6" width="4" height="4" />
            <rect x="-2" y="-6" width="4" height="4" />
            <rect x="6" y="-6" width="4" height="4" />
            <rect x="-10" y="2" width="4" height="4" />
            <rect x="-2" y="2" width="4" height="4" />
            <rect x="6" y="2" width="4" height="4" />
          </template>
          <template v-else-if="tournamentType === 'RoundRobin'">
            <circle cx="0" cy="0" r="9" />
            <circle cx="0" cy="0" r="4" />
            <line x1="-9" y1="0" x2="-4" y2="0" />
            <line x1="4" y1="0" x2="9" y2="0" />
            <line x1="0" y1="-9" x2="0" y2="-4" />
            <line x1="0" y1="4" x2="0" y2="9" />
          </template>
        </g>
      </g>

      <!-- Base / plinth (angular clip) -->
      <path d="M70 170 L130 170 L128 182 L72 182 Z" :fill="palette.secondary" />
      <path
        d="M58 182 L142 182 L145 204 L55 204 Z"
        :fill="`url(#${plinthId})`"
        :stroke="palette.shadow"
        stroke-width="1.5"
      />
      <path d="M45 204 L155 204 L152 212 L48 212 Z" :fill="palette.shadow" />

      <!-- Engraving -->
      <template v-if="showEngraving">
        <text
          x="100"
          y="228"
          text-anchor="middle"
          font-family="ui-monospace, 'SF Mono', Menlo, monospace"
          font-size="11"
          font-weight="700"
          letter-spacing="2"
          :fill="palette.highlight"
          fill-opacity="0.95"
        >
          {{ displayName }}
        </text>
        <text
          v-if="year"
          x="100"
          y="248"
          text-anchor="middle"
          font-family="ui-monospace, 'SF Mono', Menlo, monospace"
          font-size="9"
          letter-spacing="3"
          :fill="palette.highlight"
          fill-opacity="0.75"
        >
          {{ palette.label }} · {{ year }}
        </text>
      </template>

      <!-- Shine sweep on hover -->
      <rect
        v-if="interactive"
        x="-40"
        y="50"
        width="40"
        height="140"
        :fill="`url(#${shineId})`"
        class="pointer-events-none opacity-0 transition-[transform,opacity] duration-700 motion-reduce:hidden group-hover/trophy:translate-x-[260px] group-hover/trophy:opacity-100"
        transform="skewX(-20)"
      />
    </svg>
  </div>
</template>
