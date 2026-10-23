<script setup lang="ts">
import { computed } from "vue";
import { Swords } from "lucide-vue-next";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import BanTags from "~/components/bans/BanTags.vue";
import BanMapIcon from "~/components/bans/BanMapIcon.vue";
import BanSharedMatches from "~/components/bans/BanSharedMatches.vue";
import { banColumns } from "~/components/bans/banColumns";
import mapLabel from "~/utilities/mapLabel";
import {
  banLength,
  dateTimeLabel,
  reasonCategory,
  sharedMatchesOf,
  steamAnchorDay,
  steamBanned,
  steamDateLabel,
  steamDayLabel,
  steamDaysAgo,
  type BanEntry,
  type BanFilters,
} from "~/utilities/bans";

const props = defineProps<{
  entry: BanEntry;
  filters: BanFilters;
  now: Date;
  signedIn: boolean;
  moderator: boolean;
}>();

const emit = defineEmits<{ (e: "open"): void }>();

const name = computed(() => props.entry.player?.name ?? props.entry.steam_id);
const steamAnchor = computed(() =>
  props.entry.banned_at_source === "steam" && !!props.entry.steam_banned_on
    ? steamAnchorDay(props.entry)
    : null,
);
const length = computed(() =>
  props.entry.sanction
    ? banLength(
        props.entry.sanction.created_at,
        props.entry.sanction.remove_sanction_date,
        props.now,
      )
    : null,
);
const gap = computed(
  () => steamBanned(props.entry) && !props.entry.banned_here,
);
// Staff write the reason; an automatic ban's text only repeats its tag.
const reason = computed(() =>
  props.entry.sanction_kind === "staff"
    ? reasonCategory(props.entry.sanction?.reason)
    : null,
);
const issuer = computed(() =>
  props.moderator ? (props.entry.sanction?.sanctioned_by?.name ?? null) : null,
);
const shared = computed(() => sharedMatchesOf(props.entry));
const lost = computed(() => shared.value.filter((m) => m.won === false).length);
</script>

<template>
  <div
    class="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5 px-3 py-2.5 transition-colors duration-150 md:min-h-[3.75rem] md:items-center md:gap-3.5 md:px-3.5 [@media(hover:hover)]:hover:bg-muted/20"
    :class="banColumns(signedIn)"
  >
    <button
      type="button"
      class="absolute inset-0 z-[1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--tac-amber)/0.5)]"
      :aria-label="$t('pages.bans.row_label', { name })"
      @click="emit('open')"
    />

    <div class="min-w-0">
      <PlayerDisplay
        v-if="entry.player"
        :player="entry.player"
        :show-role="false"
        :show-online="false"
        :context-menu="false"
        truncate-name
      />
      <span v-else class="truncate font-semibold">{{ name }}</span>
    </div>

    <div class="col-span-2 grid min-w-0 gap-1 md:col-span-1">
      <BanTags :entry="entry" :filters="filters" :now="now" />
      <span
        v-if="reason || issuer"
        class="truncate text-xs text-muted-foreground"
      >
        {{ reason }}<template v-if="reason && issuer"> · </template
        ><template v-if="issuer">{{
          $t("pages.bans.by", { name: issuer })
        }}</template>
      </span>
      <!-- Phones: length and your matches under the tags -->
      <span
        class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground md:hidden"
      >
        <span v-if="gap" class="text-orange-400">{{
          $t("pages.bans.length.not_banned_here")
        }}</span>
        <span v-else-if="length?.state === 'permanent'">{{
          $t("pages.bans.length.permanent")
        }}</span>
        <span v-else-if="length?.state === 'active'">{{
          $t(
            `pages.bans.length.${length.unit}s`,
            { count: length.total },
            length.total,
          )
        }}</span>
        <span v-else-if="length?.state === 'ended'">{{
          $t("pages.bans.length.ended")
        }}</span>
        <span
          v-if="signedIn && shared.length"
          class="inline-flex items-center gap-1"
        >
          <Swords class="h-3 w-3" />
          {{
            lost
              ? $t(
                  "pages.bans.with_you.summary",
                  { count: shared.length, lost: lost },
                  shared.length,
                )
              : $t(
                  "pages.bans.with_you.count",
                  { count: shared.length },
                  shared.length,
                )
          }}
        </span>
      </span>
    </div>

    <!-- Banned: on phones it sits right of the player -->
    <div
      class="col-start-2 row-start-1 grid justify-items-end gap-px text-right leading-tight md:col-start-auto md:row-start-auto md:justify-items-start md:text-left"
    >
      <span class="whitespace-nowrap text-sm font-medium tabular-nums">
        <template v-if="steamAnchor">{{
          steamDayLabel(steamAnchor, now)
        }}</template>
        <TimeAgo v-else :date="entry.banned_at" hide-icon />
      </span>
      <span
        class="hidden whitespace-nowrap text-xs tabular-nums text-muted-foreground/80 md:block"
      >
        <template v-if="steamAnchor">{{
          steamDaysAgo(steamAnchor, now) < 7
            ? steamDateLabel(steamAnchor, now)
            : ""
        }}</template>
        <template v-else>{{ dateTimeLabel(entry.banned_at, now) }}</template>
      </span>
    </div>

    <!-- Length -->
    <div class="hidden gap-px leading-tight md:grid">
      <template v-if="gap && !length">
        <span class="text-sm font-medium text-orange-400">{{
          $t("pages.bans.length.not_banned_here")
        }}</span>
        <span class="text-xs text-muted-foreground/80">{{
          entry.matches_since_steam_ban
            ? $t(
                "pages.bans.length.matches_since",
                { count: entry.matches_since_steam_ban },
                entry.matches_since_steam_ban,
              )
            : $t("pages.bans.length.no_matches_since")
        }}</span>
      </template>
      <template v-else-if="length?.state === 'permanent'">
        <span class="text-sm font-medium">{{
          $t("pages.bans.length.permanent")
        }}</span>
      </template>
      <template v-else-if="length?.state === 'active'">
        <span class="text-sm font-medium tabular-nums">{{
          $t(
            `pages.bans.length.${length.unit}s`,
            { count: length.total },
            length.total,
          )
        }}</span>
        <span class="text-xs tabular-nums text-muted-foreground/80">{{
          $t(
            `pages.bans.length.${length.leftUnit}s_left`,
            { count: length.left },
            length.left,
          )
        }}</span>
      </template>
      <template v-else-if="length?.state === 'ended'">
        <span class="text-sm font-medium text-muted-foreground">{{
          $t("pages.bans.length.ended")
        }}</span>
        <span class="text-xs tabular-nums text-muted-foreground/80">{{
          dateTimeLabel(length.endedAt, now)
        }}</span>
      </template>
    </div>

    <!-- Last match here -->
    <div class="hidden min-w-0 items-center gap-2 xl:flex">
      <template v-if="entry.last_match_at">
        <BanMapIcon :map="entry.last_match_map" />
        <span class="grid min-w-0 gap-px leading-tight">
          <span class="truncate text-sm font-medium">
            <TimeAgo :date="entry.last_match_at" hide-icon />
          </span>
          <span class="truncate text-xs text-muted-foreground/80">
            {{
              entry.matches_played === 1
                ? $t("pages.bans.last_match.only")
                : entry.last_match_map
                  ? mapLabel({ name: entry.last_match_map })
                  : ""
            }}
          </span>
        </span>
      </template>
      <span v-else class="text-sm text-muted-foreground">{{
        $t("pages.bans.last_match.none")
      }}</span>
    </div>

    <!-- With you -->
    <div v-if="signedIn" class="hidden min-w-0 md:block">
      <BanSharedMatches v-if="shared.length" :matches="shared" />
      <span v-else class="text-sm text-muted-foreground/60">—</span>
    </div>
  </div>
</template>
