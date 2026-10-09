<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  Check,
  Copy,
  Globe,
  Link,
  Lock,
  Plus,
  Users,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { Input } from "~/components/ui/input";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import UtilityCardView from "~/components/utility/UtilityCardView.vue";
import UtilityDockButton from "~/components/utility/UtilityDockButton.vue";
import UtilityDockMenu from "~/components/utility/UtilityDockMenu.vue";
import UtilityLineupCard from "~/components/utility/UtilityLineupCard.vue";
import UtilitySkeletonList from "~/components/utility/UtilitySkeletonList.vue";
import UtilityTypeChips from "~/components/utility/UtilityTypeChips.vue";
import UtilityTypeSections from "~/components/utility/UtilityTypeSections.vue";
import { useSidebar } from "~/components/ui/sidebar/utils";
import cleanMapName from "~/utilities/cleanMapName";
import { UTILITY_TYPES } from "~/utilities/utilityDisplay";
import type {
  UtilityCollectionCard,
  UtilityLineup,
  UtilityType,
  UtilityVisibility,
} from "~/types/utility";

/**
 * A collection, opened. Its lineups on this map in the same type sections the
 * library uses, the set drawn on the board, and a header for what you can do
 * to it; practising it is in the bar at the foot of the card. A collection spans maps, so what is elsewhere is one line under the
 * list and not a second list.
 *
 * Renaming and deleting both happen here in the card: the title turns into a
 * field, and delete asks in the header it was pressed in.
 */
const props = defineProps<{
  open: boolean;
  card: UtilityCollectionCard | null;
  /** The collections are still being read, so "not found" is not known yet. */
  loading: boolean;
  /** Its lineups on this map, as full rows. */
  lineups: UtilityLineup[];
  lineupsLoading: boolean;
  mapName: string;
  /** The other maps it reaches, already written as a list. */
  elsewhere: string;
  types: UtilityType[];
  openLineupId: string | null;
  hoveredId: string | null;
  /** Off on a phone, which cannot join a server to load a lineup onto. */
  canPractice: boolean;
  /** The caller's teams: what Team visibility can be pointed at. */
  teams: Array<{ id: string; name: string }>;
  copying: boolean;
}>();

const emit = defineEmits<{
  (e: "back"): void;
  (e: "toggle-type", type: UtilityType): void;
  (e: "open-lineup", id: string): void;
  (e: "hover", id: string | null): void;
  (e: "add"): void;
  (e: "copy-link"): void;
  (e: "rename", name: string): void;
  (
    e: "visibility",
    visibility: UtilityVisibility,
    teamId: string | null,
  ): void;
  (e: "duplicate"): void;
  (e: "delete"): void;
}>();

const { t } = useI18n();
const { isMobile } = useSidebar();

const map = computed(() => cleanMapName(props.mapName));

const collection = computed(() => props.card?.collection ?? null);
const editable = computed(() => !!collection.value?.can_edit);

const STATUS_TONES: Record<UtilityVisibility, string> = {
  Public: "bg-success/15 text-success",
  Team: "bg-[hsl(214_80%_62%/0.15)] text-[hsl(214_80%_68%)]",
  Private: "bg-muted/60 text-muted-foreground",
};

const visibility = computed<UtilityVisibility>(
  () => collection.value?.visibility ?? "Private",
);

const counts = computed(() => {
  const tally: Partial<Record<UtilityType, number>> = {};
  for (const lineup of props.lineups) {
    tally[lineup.utility_type] = (tally[lineup.utility_type] ?? 0) + 1;
  }
  return tally;
});

// The page's type filter can be set to types this collection has none of,
// and then there is no heading left to press to undo it.
const hiddenByTypes = computed(
  () =>
    props.lineups.length > 0 &&
    props.types.length > 0 &&
    !props.lineups.some((lineup) => props.types.includes(lineup.utility_type)),
);

function showAllTypes() {
  for (const type of props.types) {
    emit("toggle-type", type);
  }
}

const more = computed(() =>
  props.card ? props.card.total - props.card.here.length : 0,
);

// How much of it is here, how much there is, and whose it is.
const facts = computed(() => {
  const card = props.card;
  if (!card) {
    return [];
  }
  const out = [
    t("pages.utility.collections.facts_here", {
      count: card.here.length,
      map: map.value,
    }),
    t("pages.utility.collections.facts_total", { count: card.total }),
  ];
  if (card.mine) {
    out.push(t("pages.utility.collections.facts_yours"));
  } else if (card.collection.owner?.name) {
    out.push(
      t("pages.utility.collections.by_owner", {
        name: card.collection.owner.name,
      }),
    );
  }
  if (!card.collection.can_edit) {
    out.push(t("pages.utility.collections.view_only"));
  }
  return out;
});

const typeOf = (lineup: UtilityLineup) => lineup.utility_type;
const keyOf = (lineup: UtilityLineup) => lineup.id;

function toggleType(type: UtilityType) {
  emit("toggle-type", type);
}

function openLineup(id: string) {
  emit("open-lineup", id);
}

function hoverLineup(id: string | null) {
  emit("hover", id);
}

// The strip speaks in whole lists; the page's filter moves one type at a time.
function onTypes(next: UtilityType[]) {
  for (const type of UTILITY_TYPES) {
    if (next.includes(type) !== props.types.includes(type)) {
      emit("toggle-type", type);
    }
  }
}

// Team is one choice per team you are on: the table will not hold a team
// collection without saying whose.
const visibilityOptions = computed(() => {
  const current = collection.value;
  const out: Array<{
    key: string;
    visibility: UtilityVisibility;
    teamId: string | null;
    label: string;
    icon: typeof Lock;
    on: boolean;
  }> = [
    {
      key: "Private",
      visibility: "Private",
      teamId: null,
      label: t("pages.utility.visibility.Private"),
      icon: Lock,
      on: visibility.value === "Private",
    },
  ];
  for (const team of props.teams) {
    out.push({
      key: `Team-${team.id}`,
      visibility: "Team",
      teamId: team.id,
      label:
        props.teams.length > 1
          ? t("pages.utility.collections.team_named", { name: team.name })
          : t("pages.utility.visibility.Team"),
      icon: Users,
      on: visibility.value === "Team" && current?.team_id === team.id,
    });
  }
  out.push({
    key: "Public",
    visibility: "Public",
    teamId: null,
    label: t("pages.utility.visibility.Public"),
    icon: Globe,
    on: visibility.value === "Public",
  });
  return out;
});

const renaming = ref(false);
const draftName = ref("");
const confirming = ref(false);
const nameId = useId();
const nameInput = ref<{ $el?: HTMLElement } | null>(null);

function startRename() {
  draftName.value = collection.value?.name ?? "";
  confirming.value = false;
  renaming.value = true;
  // After the menu has handed focus back to its trigger: sooner and the
  // field gets it for one frame and loses it again.
  setTimeout(async () => {
    await nextTick();
    const root = nameInput.value?.$el as HTMLElement | undefined;
    const field =
      root instanceof HTMLInputElement ? root : root?.querySelector("input");
    field?.focus();
    field?.select();
  }, 80);
}

function saveName() {
  const name = draftName.value.trim();
  if (!name) {
    return;
  }
  if (name !== collection.value?.name) {
    emit("rename", name);
  }
  renaming.value = false;
}

// Whatever was half-done belongs to the collection it was started on.
watch(
  () => [props.open, collection.value?.id] as const,
  () => {
    renaming.value = false;
    confirming.value = false;
  },
);

</script>

<template>
  <UtilityCardView
    addressed
    :open="open"
    :label="collection?.name ?? $t('pages.utility.collections.tab')"
    @back="emit('back')"
  >
    <template #kicker>
      <span class="truncate">
        {{ $t("pages.utility.collections.kicker", { map }) }}
      </span>
    </template>

    <!-- A phone has no room for the strip; there the section headings are
         the filter on their own. -->
    <template v-if="card && lineups.length && !isMobile" #head>
      <div
        class="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        :aria-label="$t('pages.utility.meta.types')"
      >
        <UtilityTypeChips
          :model-value="types"
          :counts="counts"
          fill
          @update:model-value="onTypes"
        />
      </div>
    </template>

    <template v-if="card && collection">
      <div class="flex items-start gap-2.5">
        <form
          v-if="renaming"
          class="min-w-0 flex-1"
          @submit.prevent="saveName()"
        >
          <label class="sr-only" :for="nameId">
            {{ $t("pages.utility.collections.name_placeholder") }}
          </label>
          <Input
            :id="nameId"
            ref="nameInput"
            v-model="draftName"
            maxlength="120"
            spellcheck="false"
            class="h-8 text-base font-bold md:text-sm"
            @keydown.esc.stop.prevent="renaming = false"
          />
        </form>
        <h2
          v-else
          class="min-w-0 flex-1 text-lg font-bold leading-tight [text-wrap:balance]"
        >
          {{ collection.name }}
        </h2>
        <!-- Who can see it is worth a glyph, not a word's width. -->
        <FiveStackToolTip as-child :delay-duration="120">
          <template #trigger>
            <span
              class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md"
              :class="STATUS_TONES[visibility]"
              role="img"
              :aria-label="$t(`pages.utility.visibility.${visibility}`)"
            >
              <component
                :is="
                  visibility === 'Public'
                    ? Globe
                    : visibility === 'Team'
                      ? Users
                      : Lock
                "
                class="h-3.5 w-3.5"
              />
            </span>
          </template>
          {{ $t(`pages.utility.visibility.${visibility}`) }}
        </FiveStackToolTip>
      </div>

      <p
        v-if="collection.description"
        class="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground"
      >
        {{ collection.description }}
      </p>

      <p
        class="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
      >
        <template v-for="(fact, index) of facts" :key="fact">
          <span v-if="index > 0" aria-hidden="true" class="text-border">
            /
          </span>
          <span class="min-w-0 truncate tabular-nums">{{ fact }}</span>
        </template>
      </p>

      <UtilitySkeletonList
        v-if="lineupsLoading && lineups.length < card.here.length"
        :count="Math.min(4, card.here.length)"
        shape="row"
      />

      <p
        v-else-if="hiddenByTypes"
        class="px-0.5 text-xs leading-relaxed text-muted-foreground"
      >
        {{ $t("pages.utility.collections.types_hidden") }}
        <button
          type="button"
          class="font-semibold text-foreground underline underline-offset-2 hover:text-[hsl(var(--tac-amber))]"
          @click="showAllTypes()"
        >
          {{ $t("pages.utility.collections.show_all_types") }}
        </button>
      </p>

      <UtilityTypeSections
        v-else-if="lineups.length"
        class="-mt-3.5"
        :items="lineups"
        :type-of="typeOf"
        :key-of="keyOf"
        :types="types"
        @toggle-type="toggleType"
      >
        <template #default="{ item }">
          <UtilityLineupCard
            :lineup="item"
            mode="row"
            :menu="false"
            :selected="openLineupId === item.id"
            :hovered="hoveredId === item.id"
            :show-practice="canPractice"
            @select="openLineup"
            @hover="hoverLineup"
          />
        </template>
      </UtilityTypeSections>

      <p v-else class="px-0.5 text-xs leading-relaxed text-muted-foreground">
        {{ $t("pages.utility.collections.none_here", { map }) }}
      </p>

      <p
        v-if="more > 0 && elsewhere"
        class="px-0.5 text-xs leading-relaxed text-muted-foreground"
      >
        {{
          $t(
            "pages.utility.collections.more_elsewhere",
            { count: more, maps: elsewhere },
            more,
          )
        }}
      </p>
    </template>

    <UtilitySkeletonList v-else-if="loading" :count="3" shape="row" />

    <div v-else class="p-8 text-center">
      <p class="text-sm font-semibold">
        {{ $t("pages.utility.collections.not_found") }}
      </p>
      <p class="mx-auto mt-1 max-w-[40ch] text-xs text-muted-foreground">
        {{ $t("pages.utility.collections.not_found_description") }}
      </p>
    </div>

    <template v-if="card && collection" #dock>
      <!-- Asked where it was pressed, not in a dialog over the whole page. -->
      <template v-if="confirming">
        <span class="min-w-0 truncate text-xs text-muted-foreground">
          {{ $t("pages.utility.collections.confirm_dock") }}
        </span>
        <UtilityDockButton wide @click="confirming = false">
          {{ $t("common.cancel") }}
        </UtilityDockButton>
        <UtilityDockButton wide danger @click="emit('delete')">
          {{ $t("common.delete") }}
        </UtilityDockButton>
      </template>

      <template v-else-if="renaming">
        <UtilityDockButton wide @click="renaming = false">
          {{ $t("common.cancel") }}
        </UtilityDockButton>
        <Button
          size="sm"
          class="tac-amber-cta h-8 px-3.5 text-[13px] font-semibold"
          :disabled="!draftName.trim()"
          @click="saveName()"
        >
          {{ $t("pages.utility.collections.save_name") }}
        </Button>
      </template>

      <template v-else>
        <UtilityDockButton v-if="editable" wide @click="emit('add')">
          <Plus class="h-4 w-4" />
          {{ $t("pages.utility.collections.add_lineups") }}
        </UtilityDockButton>
        <UtilityDockButton
          v-else
          wide
          :disabled="copying"
          @click="emit('duplicate')"
        >
          <Copy class="h-4 w-4" />
          {{ $t("pages.utility.collections.save_copy") }}
        </UtilityDockButton>

        <UtilityDockButton
          :tip="$t('pages.utility.preview.copy_link')"
          @click="emit('copy-link')"
        >
          <Link class="h-4 w-4" />
        </UtilityDockButton>

        <UtilityDockMenu v-if="editable">
          <DropdownMenuItem @click="startRename()">
            {{ $t("common.rename") }}
          </DropdownMenuItem>
          <DropdownMenuItem :disabled="copying" @click="emit('duplicate')">
            {{ $t("pages.utility.collections.duplicate") }}
          </DropdownMenuItem>
          <!-- Who sees it and whether it exists are the owner's to decide: a
               team admin can edit a team's collection, and should not be able
               to take it away from the team by accident. -->
          <template v-if="card.mine">
            <DropdownMenuSeparator />
            <DropdownMenuLabel
              class="pb-1 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
            >
              {{ $t("pages.utility.collections.who_can_see") }}
            </DropdownMenuLabel>
            <DropdownMenuItem
              v-for="option of visibilityOptions"
              :key="option.key"
              @click="
                option.on || emit('visibility', option.visibility, option.teamId)
              "
            >
              <component :is="option.icon" />
              <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
              <Check
                v-if="option.on"
                class="text-[hsl(var(--tac-amber))]"
              />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              class="text-destructive focus:text-destructive"
              @click="confirming = true"
            >
              {{ $t("pages.utility.collections.delete") }}
            </DropdownMenuItem>
          </template>
        </UtilityDockMenu>
      </template>
    </template>
  </UtilityCardView>
</template>
