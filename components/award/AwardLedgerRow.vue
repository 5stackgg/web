<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Ellipsis, Lock, Medal, Pencil, Trash2, Users } from "lucide-vue-next";
import AwardBadge from "./AwardBadge.vue";
import StatusDot from "~/components/admin/StatusDot.vue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { TIER_PALETTES, resolveAwardTier } from "~/utilities/awardSeed";
import { dateLocale } from "~/utilities/dateLocale";
import {
  automationLabel,
  awardLedgerColumns,
  awardOwner,
  formatAwardDate,
  highlightParts,
  holderCount,
  isBuiltIn,
  lastGrantedAt,
  ownerLabel,
  ownerStatusText,
  ownerIsLive,
} from "./awardLedger";

const props = withDefaults(
  defineProps<{
    award: any;
    query?: string;
    canManage?: boolean;
    canGrant?: boolean;
    /** Position in a freshly filtered list; rows rise in staggered by it. */
    stagger?: number | null;
  }>(),
  { query: "", canManage: false, canGrant: false, stagger: null },
);

const emit = defineEmits<{
  (e: "open"): void;
  (e: "grant"): void;
  (e: "edit"): void;
  (e: "delete"): void;
}>();

const { t } = useI18n();

const tier = computed(() => resolveAwardTier(null, props.award.tier));
const builtIn = computed(() => isBuiltIn(props.award));
const owner = computed(() => awardOwner(props.award));
const holders = computed(() => holderCount(props.award));
const last = computed(() => lastGrantedAt(props.award));

const nameParts = computed(() => highlightParts(props.award.name, props.query));
const descriptionParts = computed(() =>
  highlightParts(props.award.description, props.query),
);

const ownerName = computed(() => ownerLabel(owner.value, t));
const ownerParts = computed(() => highlightParts(ownerName.value, props.query));
const automation = computed(() => automationLabel(props.award, t));
const ownerStatus = computed(() => ownerStatusText(owner.value, t));

const lastLabel = computed(() => {
  if (last.value === null) return null;
  const days = (Date.now() - last.value) / 86_400_000;
  if (days < 1) return t("pages.awards.today");
  if (days < 14) {
    return t("pages.awards.days_ago", { count: Math.floor(days) });
  }
  return formatAwardDate(last.value);
});

const swatch = computed(() => TIER_PALETTES[tier.value].primary);

function onRowClick(event: MouseEvent) {
  if ((event.target as HTMLElement).closest("button, a, [role='menuitem']")) {
    return;
  }
  emit("open");
}
</script>

<template>
  <div
    role="row"
    :class="[
      awardLedgerColumns,
      'award-row cursor-pointer border-b border-border/50 px-3 py-2 outline-none transition-colors duration-150 last:border-b-0 hover:bg-muted/40 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring data-[active=true]:bg-muted/40',
      stagger !== null && 'award-row-in',
    ]"
    :style="stagger !== null ? { '--i': Math.min(stagger, 14) } : undefined"
    :data-award-id="award.id"
    @click="onRowClick"
  >
    <div role="cell" class="flex min-w-0 items-center gap-3 max-sm:gap-2.5">
      <span
        class="grid size-10 shrink-0 place-items-center rounded-lg border border-border/60 bg-muted/30 max-sm:size-8 max-sm:border-0 max-sm:bg-transparent"
      >
        <AwardBadge
          :award="award"
          :seed-key="award.id"
          size="xs"
          :interactive="false"
          :show-name="false"
        />
      </span>
      <div class="grid min-w-0 gap-0.5">
        <span class="flex min-w-0 items-center gap-2">
          <button
            type="button"
            class="min-w-0 truncate text-left font-semibold text-foreground transition-colors duration-150 hover:text-[hsl(var(--tac-amber))]"
            :title="award.name"
            @click="emit('open')"
          >
            <template v-for="(part, i) in nameParts" :key="i">
              <mark
                v-if="part.hit"
                class="rounded-[2px] bg-[hsl(var(--tac-amber)/0.25)] px-px text-foreground"
                >{{ part.text }}</mark
              ><template v-else>{{ part.text }}</template>
            </template>
          </button>
          <span
            v-if="builtIn"
            class="inline-flex h-5 shrink-0 items-center rounded-[5px] border border-border bg-muted/40 px-1.5 text-[0.68rem] font-medium text-muted-foreground max-sm:hidden"
            :title="$t('pages.awards.built_in_hint')"
          >
            {{ $t("pages.awards.built_in") }}
          </span>
        </span>
        <!-- On phones the built-in chip drops to this line so the name keeps
             the width. -->
        <span
          v-if="award.description || builtIn"
          class="flex min-w-0 items-center gap-1.5"
          :class="!award.description && 'sm:hidden'"
        >
          <span
            v-if="builtIn"
            class="inline-flex h-4 shrink-0 items-center rounded-[4px] border border-border bg-muted/40 px-1 text-[0.62rem] font-medium text-muted-foreground sm:hidden"
          >
            {{ $t("pages.awards.built_in") }}
          </span>
          <span
            v-if="award.description"
            class="min-w-0 max-w-[52ch] truncate text-xs text-muted-foreground"
            :title="award.description"
          >
            <template v-for="(part, i) in descriptionParts" :key="i">
              <mark
                v-if="part.hit"
                class="rounded-[2px] bg-[hsl(var(--tac-amber)/0.25)] px-px text-foreground"
                >{{ part.text }}</mark
              ><template v-else>{{ part.text }}</template>
            </template>
          </span>
        </span>
      </div>
    </div>

    <div role="cell" class="grid min-w-0 gap-px text-[0.78rem] max-md:hidden">
      <span v-if="builtIn" class="truncate text-muted-foreground">
        {{ automation }}
      </span>
      <span v-else-if="!owner" class="text-muted-foreground">
        {{ $t("pages.awards.scope_global") }}
      </span>
      <template v-else>
        <span class="truncate" :title="ownerName">
          <template v-for="(part, i) in ownerParts" :key="i">
            <mark
              v-if="part.hit"
              class="rounded-[2px] bg-[hsl(var(--tac-amber)/0.25)] px-px text-foreground"
              >{{ part.text }}</mark
            ><template v-else>{{ part.text }}</template>
          </template>
        </span>
        <span
          class="inline-flex items-center gap-1.5 whitespace-nowrap text-[0.72rem] text-muted-foreground/80"
        >
          <StatusDot
            v-if="owner.phase === 'live'"
            tone="ok"
            size="sm"
            :live="ownerIsLive(owner)"
          />
          <StatusDot
            v-else-if="owner.phase === 'upcoming'"
            tone="amber"
            size="sm"
          />
          {{ ownerStatus }}
        </span>
      </template>
    </div>

    <div role="cell" class="min-w-0">
      <span
        class="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground"
      >
        <span
          class="size-2 shrink-0 rounded-[2px]"
          :style="{ background: swatch }"
          aria-hidden="true"
        />
        {{ $t(`pages.awards.tiers.${tier}`) }}
      </span>
    </div>

    <div role="cell" class="whitespace-nowrap text-right tabular-nums">
      {{ holders.toLocaleString(dateLocale()) }}
    </div>

    <div
      role="cell"
      class="whitespace-nowrap text-right text-[0.78rem] tabular-nums max-md:hidden"
    >
      <span v-if="lastLabel === null" class="text-muted-foreground/70">
        {{ $t("common.never") }}
      </span>
      <span v-else :title="formatAwardDate(last)">
        {{ lastLabel }}
      </span>
    </div>

    <div role="cell" class="flex items-center justify-end gap-1">
      <!-- Phones grant from the menu; the column only fits the ⋯ there. -->
      <button
        v-if="canGrant"
        type="button"
        class="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground max-sm:hidden"
        :aria-label="$t('pages.awards.grant')"
        @click="emit('grant')"
      >
        <Medal class="size-3.5" />
        <span class="max-md:sr-only">{{ $t("pages.awards.grant_short") }}</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground"
            :aria-label="$t('pages.awards.more_for', { name: award.name })"
          >
            <Ellipsis class="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-56">
          <DropdownMenuItem @select="emit('open')">
            <Users />
            {{ $t("pages.awards.open_holders") }}
          </DropdownMenuItem>
          <DropdownMenuItem v-if="canGrant" @select="emit('grant')">
            <Medal />
            {{ $t("pages.awards.grant") }}
          </DropdownMenuItem>
          <template v-if="canManage">
            <DropdownMenuItem @select="emit('edit')">
              <Pencil />
              {{ $t("pages.awards.edit_award") }}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem v-if="builtIn" disabled>
              <Lock />
              {{ $t("pages.awards.builtin_cant_delete") }}
            </DropdownMenuItem>
            <DropdownMenuItem
              v-else
              class="text-destructive focus:text-destructive"
              @select="emit('delete')"
            >
              <Trash2 />
              {{ $t("pages.awards.delete_award") }}
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</template>

<style scoped>
.award-row-in {
  animation: award-row-in 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--i, 0) * 14ms);
}

@keyframes award-row-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .award-row-in {
    animation: none;
  }
}
</style>
