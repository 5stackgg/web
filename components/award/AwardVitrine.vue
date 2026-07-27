<script setup lang="ts">
import { computed } from "vue";
import AwardBadge from "./AwardBadge.vue";
import { TIER_PALETTES, resolveAwardTier } from "~/utilities/awardSeed";
import { Pencil, Trash2 } from "lucide-vue-next";

interface CatalogAward {
  id: string;
  name?: string | null;
  description?: string | null;
  tier?: string | null;
  silhouette?: number | null;
  image_url?: string | null;
  system_key?: string | null;
  allow_multiple?: boolean | null;
  recipients_aggregate?: {
    aggregate?: { count?: number | null } | null;
  } | null;
}

const props = withDefaults(
  defineProps<{
    award: CatalogAward;
    /** Staggers the entrance so a full shelf reveals left-to-right. */
    index?: number;
    canManage?: boolean;
    canGrant?: boolean;
  }>(),
  { index: 0, canManage: false, canGrant: false },
);

defineEmits<{
  (e: "edit"): void;
  (e: "grant"): void;
  (e: "remove"): void;
}>();

const tier = computed(() => resolveAwardTier(null, props.award.tier));
const accent = computed(() => TIER_PALETTES[tier.value].primary);
const holders = computed(
  () => props.award.recipients_aggregate?.aggregate?.count ?? 0,
);
const isBuiltIn = computed(() => !!props.award.system_key);
</script>

<template>
  <article
    class="vitrine group/vitrine relative flex flex-col overflow-hidden rounded-lg border border-border [background:linear-gradient(180deg,hsl(var(--card)/0.75)_0%,hsl(var(--card)/0.3)_100%)] [backdrop-filter:blur(6px)] transition-[border-color,transform] duration-300 hover:-translate-y-px hover:border-[hsl(var(--tac-amber)/0.45)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    :style="{ '--vitrine-delay': `${Math.min(index, 11) * 45}ms` }"
  >
    <!-- Tier light bar: the case's own lamp, so the shelf reads by colour -->
    <span
      class="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
      :style="{
        background: `linear-gradient(90deg, transparent 0%, ${accent} 50%, transparent 100%)`,
      }"
      aria-hidden="true"
    ></span>

    <!-- Corner brackets, revealed on approach -->
    <span
      class="pointer-events-none absolute left-1.5 top-1.5 h-[11px] w-[11px] border-l-2 border-t-2 border-[hsl(var(--tac-amber))] opacity-0 transition-opacity duration-300 group-hover/vitrine:opacity-100 motion-reduce:transition-none"
      aria-hidden="true"
    ></span>
    <span
      class="pointer-events-none absolute bottom-1.5 right-1.5 h-[11px] w-[11px] border-b-2 border-r-2 border-[hsl(var(--tac-amber))] opacity-0 transition-opacity duration-300 group-hover/vitrine:opacity-100 motion-reduce:transition-none"
      aria-hidden="true"
    ></span>

    <span
      class="pointer-events-none absolute inset-0 [background-image:repeating-linear-gradient(3deg,transparent_0,transparent_3px,hsl(var(--tac-amber)/0.02)_3px,hsl(var(--tac-amber)/0.02)_4px)]"
      aria-hidden="true"
    ></span>

    <!-- The card body opens the award; the instrument row below stays outside
         the link so its buttons keep their own clicks. -->
    <NuxtLink
      :to="`/awards/${award.id}`"
      class="relative flex flex-1 flex-col"
      :aria-label="award.name || undefined"
    >
      <!-- Stage: the specimen stands uplit on a plinth -->
      <div class="relative flex items-end justify-center px-4 pb-3 pt-6">
        <div
          class="pointer-events-none absolute inset-x-4 bottom-2 top-1/4 opacity-45 blur-2xl transition-opacity duration-300 group-hover/vitrine:opacity-90 motion-reduce:transition-none"
          :style="{
            background: `radial-gradient(ellipse 72% 62% at 50% 100%, ${accent} 0%, transparent 70%)`,
          }"
          aria-hidden="true"
        ></div>
        <div
          class="pointer-events-none absolute inset-x-8 bottom-2 h-[1px]"
          :style="{
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
            opacity: 0.5,
          }"
          aria-hidden="true"
        ></div>
        <AwardBadge
          :award="award"
          :seed-key="award.id"
          size="md"
          :interactive="false"
          :show-name="false"
          class="relative z-[1] transition-transform duration-300 group-hover/vitrine:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover/vitrine:translate-y-0"
        />
      </div>

      <!-- Designation plate: the full name, never truncated -->
      <div class="relative flex flex-1 flex-col gap-1.5 px-4 pb-3">
        <div class="flex items-start gap-2">
          <h3
            class="flex-1 text-pretty text-[0.82rem] font-bold uppercase leading-[1.25] tracking-[0.06em] text-foreground transition-colors duration-150 group-hover/vitrine:text-[hsl(var(--tac-amber))]"
          >
            {{ award.name }}
          </h3>
          <span
            v-if="isBuiltIn"
            class="mt-[0.1rem] shrink-0 rounded-sm border border-border/80 px-1.5 py-[0.1rem] font-mono text-[0.5rem] uppercase leading-none tracking-[0.16em] text-muted-foreground/80"
            :title="$t('pages.awards.built_in_hint')"
          >
            {{ $t("pages.awards.built_in") }}
          </span>
        </div>

        <p
          v-if="award.description"
          class="line-clamp-2 text-[0.72rem] leading-snug text-muted-foreground"
        >
          {{ award.description }}
        </p>
      </div>

      <!-- Data strip -->
      <div
        class="relative flex items-center justify-between gap-2 border-t border-border/60 px-4 py-2"
      >
        <!-- The dot carries the tier colour; the label stays on a themed token so
           silver/bronze remain legible on the light theme too. -->
        <span
          class="inline-flex items-center gap-1.5 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-muted-foreground"
        >
          <span
            class="inline-block h-1.5 w-1.5 rounded-full"
            :style="{ background: accent, boxShadow: `0 0 6px ${accent}` }"
          ></span>
          {{ tier }}
        </span>
        <span class="inline-flex items-baseline gap-1.5">
          <span
            class="font-mono text-sm font-bold leading-none tabular-nums text-foreground"
          >
            {{ String(holders).padStart(2, "0") }}
          </span>
          <span
            class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
          >
            {{ $t("pages.awards.holders") }}
          </span>
        </span>
      </div>
    </NuxtLink>

    <!-- Instrument row -->
    <div
      v-if="canGrant || canManage"
      class="relative flex items-stretch gap-px border-t border-border/60 bg-background/20"
    >
      <button
        v-if="canGrant"
        type="button"
        class="flex-1 px-3 py-2 font-mono text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))] transition-colors duration-150 hover:bg-[hsl(var(--tac-amber)/0.12)]"
        @click="$emit('grant')"
      >
        {{ $t("pages.awards.grant") }}
      </button>
      <button
        v-if="canManage"
        type="button"
        class="grid w-10 place-items-center border-l border-border/60 text-muted-foreground transition-colors duration-150 hover:bg-muted/40 hover:text-foreground"
        :title="$t('common.edit')"
        :aria-label="$t('common.edit')"
        @click="$emit('edit')"
      >
        <Pencil class="h-3.5 w-3.5" />
      </button>
      <button
        v-if="canManage && !isBuiltIn"
        type="button"
        class="grid w-10 place-items-center border-l border-border/60 text-muted-foreground transition-colors duration-150 hover:bg-[hsl(var(--destructive)/0.15)] hover:text-destructive"
        :title="$t('pages.awards.delete')"
        :aria-label="$t('pages.awards.delete')"
        @click="$emit('remove')"
      >
        <Trash2 class="h-3.5 w-3.5" />
      </button>
    </div>
  </article>
</template>

<style scoped>
.vitrine {
  animation: vitrine-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: var(--vitrine-delay, 0ms);
}

@keyframes vitrine-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .vitrine {
    animation: none;
  }
}
</style>
