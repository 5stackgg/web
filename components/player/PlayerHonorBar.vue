<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronRight } from "lucide-vue-next";
import AwardBadge from "~/components/award/AwardBadge.vue";
import AwardModal from "~/components/award/AwardModal.vue";
import HorizontalScrollRow from "~/components/common/HorizontalScrollRow.vue";
import ScrollArrows from "~/components/common/ScrollArrows.vue";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { resolveAwardTier, type AwardTier } from "~/utilities/awardSeed";
import { dateLocale } from "~/utilities/dateLocale";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const props = defineProps<{
  awards: any[];
}>();

const TIER_RING: Record<AwardTier, string> = {
  mvp: "hsl(195 85% 60% / 0.6)",
  gold: "hsl(45 95% 60% / 0.6)",
  silver: "hsl(0 0% 78% / 0.5)",
  bronze: "hsl(28 70% 52% / 0.6)",
  special: "hsl(258 90% 74% / 0.55)",
};

type Group = "tournaments" | "seasons" | "awarded";
const GROUPS: Group[] = ["tournaments", "seasons", "awarded"];

const rowRef = ref<InstanceType<typeof HorizontalScrollRow> | null>(null);
const sheetOpen = ref(false);
const selected = ref<any>(null);
const modalOpen = ref(false);

// Newest first: the bar leads with what the player earned most recently.
const honors = computed(() =>
  props.awards
    .map((grant) => ({
      grant,
      tier: resolveAwardTier(grant.placement, grant.award?.tier),
      name:
        grant.tournament_award?.custom_name ||
        grant.award?.name ||
        grant.tournament?.name ||
        "",
      source: grant.tournament?.name || null,
      date:
        grant.source === "manual"
          ? grant.created_at
          : grant.tournament?.start || grant.created_at,
      group: (grant.tournament_id
        ? "tournaments"
        : grant.source === "season"
          ? "seasons"
          : "awarded") as Group,
    }))
    .sort(
      (a, b) =>
        new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
    ),
);

const groups = computed(() =>
  GROUPS.map((key) => ({
    key,
    items: honors.value.filter((honor) => honor.group === key),
  })).filter((group) => group.items.length),
);

function open(grant: any) {
  selected.value = grant;
  modalOpen.value = true;
}

function formatDate(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(dateLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
</script>

<template>
  <!-- Same shape as the hero's Recent form block: a label line, then the
       strip. One row; anything past the card's width scrolls sideways. -->
  <div class="min-w-0 space-y-2.5">
    <div class="flex items-center justify-between gap-3">
      <span
        class="inline-flex items-center gap-2 font-mono text-[0.72rem] uppercase tracking-[0.24em] text-muted-foreground"
      >
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("pages.players.detail.honors_section") }}
      </span>
      <div class="flex shrink-0 items-center gap-2">
        <ScrollArrows
          :can-left="rowRef?.state?.canScrollLeft"
          :can-right="rowRef?.state?.canScrollRight"
          @scroll="(direction) => rowRef?.scrollByDirection(direction)"
        />
        <button
          type="button"
          class="inline-flex h-6 items-center gap-1 rounded-md px-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground transition-colors duration-150 hover:bg-muted/40 hover:text-foreground"
          @click="sheetOpen = true"
        >
          {{ $t("pages.players.detail.honors_all") }}
          <ChevronRight class="h-3 w-3" />
        </button>
      </div>
    </div>

    <HorizontalScrollRow
      ref="rowRef"
      class="!gap-1.5 !pb-0.5 !pt-0.5"
      :class="{
        '[mask-image:linear-gradient(to_right,black_85%,transparent)]':
          rowRef?.state?.canScrollRight,
      }"
    >
      <Tooltip v-for="honor in honors" :key="honor.grant.id">
        <TooltipTrigger as-child>
          <button
            type="button"
            class="grid h-11 w-11 shrink-0 snap-start place-items-center rounded-full bg-background/60 transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
            :style="{ boxShadow: `inset 0 0 0 2px ${TIER_RING[honor.tier]}` }"
            :aria-label="honor.name"
            @click="open(honor.grant)"
          >
            <AwardBadge
              :award="honor.grant.award"
              :seed-key="honor.grant.tournament_id || honor.grant.award?.id"
              :placement="honor.grant.placement"
              :tournament-name="honor.grant.tournament?.name"
              :tournament-start="honor.grant.tournament?.start"
              :tournament-type="honor.grant.tournament?.stages?.[0]?.type"
              :custom-name="honor.grant.tournament_award?.custom_name"
              :silhouette-override="honor.grant.tournament_award?.silhouette"
              :image-url="honor.grant.tournament_award?.image_url"
              size="xs"
              :interactive="false"
              :show-name="false"
              :style="{ width: '34px', height: '34px' }"
            />
          </button>
        </TooltipTrigger>
        <TooltipContent class="max-w-[16rem]">
          <div class="font-semibold">{{ honor.name }}</div>
          <div v-if="honor.source" class="text-muted-foreground">
            {{ honor.source }}
          </div>
          <div
            v-if="honor.date"
            class="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground"
          >
            {{ formatDate(honor.date) }}
          </div>
        </TooltipContent>
      </Tooltip>
    </HorizontalScrollRow>

    <Sheet v-model:open="sheetOpen">
      <SheetContent side="right" class="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {{ $t("pages.players.detail.honors_section") }}
          </SheetTitle>
        </SheetHeader>
        <div class="mt-4 space-y-6">
          <section v-for="group in groups" :key="group.key">
            <div :class="tacticalSectionLabelClasses">
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t(`pages.players.detail.honors_group.${group.key}`) }}
            </div>
            <button
              v-for="honor in group.items"
              :key="honor.grant.id"
              type="button"
              class="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-150 hover:bg-muted/40"
              @click="open(honor.grant)"
            >
              <AwardBadge
                :award="honor.grant.award"
                :seed-key="honor.grant.tournament_id || honor.grant.award?.id"
                :placement="honor.grant.placement"
                :tournament-name="honor.grant.tournament?.name"
                :tournament-start="honor.grant.tournament?.start"
                :tournament-type="honor.grant.tournament?.stages?.[0]?.type"
                :custom-name="honor.grant.tournament_award?.custom_name"
                :silhouette-override="honor.grant.tournament_award?.silhouette"
                :image-url="honor.grant.tournament_award?.image_url"
                size="sm"
                :interactive="false"
                :show-name="false"
              />
              <span class="min-w-0">
                <span class="block truncate font-semibold">
                  {{ honor.name }}
                </span>
                <span
                  v-if="honor.source"
                  class="block truncate text-xs text-muted-foreground"
                >
                  {{ honor.source }}
                </span>
                <span
                  v-if="honor.date"
                  class="mt-0.5 block font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground"
                >
                  {{ formatDate(honor.date) }}
                </span>
              </span>
            </button>
          </section>
        </div>
      </SheetContent>
    </Sheet>

    <AwardModal
      v-if="selected"
      :open="modalOpen"
      :award="selected"
      @update:open="(value) => (modalOpen = value)"
    />
  </div>
</template>
