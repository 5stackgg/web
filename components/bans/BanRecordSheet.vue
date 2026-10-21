<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { ExternalLink, TriangleAlert } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { toast } from "~/components/ui/toast";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import SanctionPlayer from "~/components/SanctionPlayer.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import BanTags from "~/components/bans/BanTags.vue";
import BanMapIcon from "~/components/bans/BanMapIcon.vue";
import mapLabel from "~/utilities/mapLabel";
import { outranksPlayer } from "~/utilities/sanctionAuthority";
import { useAuthStore } from "~/stores/AuthStore";
import { END_BAN_MUTATION } from "~/graphql/bansGraphql";
import {
  banTimeline,
  dateLabel,
  dateTimeLabel,
  sharedMatchesOf,
  steamBanned,
  steamDateLabel,
  type BanEntry,
  type BanLength,
  type SharedMatch,
} from "~/utilities/bans";

const props = defineProps<{
  entry: BanEntry | null;
  now: Date;
  moderator: boolean;
}>();

const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{ (e: "changed"): void }>();

const { t } = useI18n();
const { client } = useApolloClient();

const timeline = computed(() =>
  props.entry ? banTimeline(props.entry, props.now) : [],
);
const shared = computed(() =>
  props.entry ? sharedMatchesOf(props.entry) : [],
);
const gap = computed(
  () => !!props.entry && steamBanned(props.entry) && !props.entry.banned_here,
);
const canAct = computed(
  () =>
    props.moderator &&
    !!props.entry?.player &&
    outranksPlayer(useAuthStore().isRoleAbove, props.entry.player.role),
);

const confirming = ref(false);
const ending = ref(false);
watch(
  () => props.entry?.steam_id,
  () => {
    confirming.value = false;
  },
);

async function endBan() {
  const entry = props.entry;
  if (!entry || ending.value) return;
  ending.value = true;
  try {
    await client.mutate({
      mutation: END_BAN_MUTATION,
      variables: {
        steam_id: String(entry.steam_id),
        sanction_id: entry.sanction_id,
      },
    });
    toast({ title: t("player.sanctions.removed") });
    confirming.value = false;
    emit("changed");
  } catch (error) {
    console.error("Failed to end ban:", error);
    toast({
      title: t("player.sanctions.remove_failed"),
      variant: "destructive",
    });
  } finally {
    ending.value = false;
  }
}

// Focus the panel itself: the first focusable inside is the ELO chip, whose
// hover card would open over the record.
function onOpenAutoFocus(event: Event) {
  event.preventDefault();
  (event.target as HTMLElement | null)?.focus({ preventScroll: true });
}

function lengthText(length: BanLength): string {
  if (length.state === "permanent") return t("pages.bans.length.permanent");
  if (length.state === "ended") return t("pages.bans.length.ended");
  return `${t(`pages.bans.length.${length.unit}s`, { count: length.total }, length.total)}, ${t(
    `pages.bans.length.${length.leftUnit}s_left`,
    { count: length.left },
    length.left,
  )}`;
}

function scoreClass(match: SharedMatch) {
  if (match.won === true) return "text-green-400";
  if (match.won === false) return "text-red-400";
  return "text-foreground";
}

const dotClasses: Record<string, string> = {
  vac: "border-destructive bg-destructive",
  game: "border-orange-400 bg-orange-400",
  sanction: "border-foreground bg-foreground",
  sanction_end: "border-green-400 bg-background",
  match: "border-border bg-background",
};
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent
      side="right"
      class="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      @open-auto-focus="onOpenAutoFocus"
    >
      <SheetHeader class="border-b border-border/60 px-5 py-4 text-left">
        <SheetTitle class="pr-8 text-base">{{
          $t("pages.bans.record.title")
        }}</SheetTitle>
        <SheetDescription class="sr-only">{{
          entry?.player?.name ?? ""
        }}</SheetDescription>
      </SheetHeader>

      <div
        v-if="entry"
        class="flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5"
      >
        <div class="grid gap-2">
          <PlayerDisplay
            v-if="entry.player"
            :player="entry.player"
            size="lg"
            :show-role="false"
            :show-online="false"
          />
          <p class="m-0 text-xs text-muted-foreground">
            {{
              entry.matches_played
                ? $t(
                    "pages.bans.record.matches_here",
                    { count: entry.matches_played },
                    entry.matches_played,
                  )
                : $t("pages.bans.last_match.none")
            }}
          </p>
          <BanTags :entry="entry" :now="now" />
        </div>

        <div
          v-if="gap"
          class="flex gap-2.5 rounded-md border border-orange-500/40 bg-orange-500/10 px-3 py-2.5 text-sm"
        >
          <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
          <p class="m-0 text-pretty">
            <span class="font-semibold">{{
              entry.vac_ban_count > 0
                ? $t("pages.bans.record.vac_gap_title")
                : $t("pages.bans.record.game_gap_title")
            }}</span>
            {{
              entry.vac_ban_count > 0
                ? $t("pages.bans.record.vac_gap_body")
                : $t("pages.bans.record.game_gap_body")
            }}
            <template v-if="entry.matches_since_steam_ban">
              {{
                $t(
                  "pages.bans.record.matches_since",
                  { count: entry.matches_since_steam_ban },
                  entry.matches_since_steam_ban,
                )
              }}
            </template>
          </p>
        </div>

        <section
          v-if="entry.sanction_kind === 'staff' && entry.sanction?.reason"
          class="grid gap-2"
        >
          <h3 class="text-xs font-semibold text-muted-foreground">
            {{ $t("pages.bans.record.reason") }}
          </h3>
          <p
            class="m-0 whitespace-pre-line rounded-r-md border-l-2 border-border bg-card/40 px-3 py-2 text-sm text-pretty"
          >
            {{ entry.sanction.reason }}
          </p>
        </section>

        <section class="grid gap-2">
          <h3 class="text-xs font-semibold text-muted-foreground">
            {{ $t("pages.bans.record.what_happened") }}
          </h3>
          <ol class="relative m-0 grid list-none gap-0 p-0">
            <span
              class="absolute bottom-3 left-[5px] top-3 w-px bg-border"
              aria-hidden="true"
            />
            <li
              v-for="item in timeline"
              :key="`${item.type}-${item.at}`"
              class="relative flex gap-3 py-1.5"
            >
              <span
                class="relative mt-1 size-[11px] shrink-0 rounded-full border-2"
                :class="
                  dotClasses[
                    item.type === 'steam'
                      ? item.vac > 0
                        ? 'vac'
                        : 'game'
                      : item.type === 'first_match' ||
                          item.type === 'last_match'
                        ? 'match'
                        : item.type
                  ]
                "
                aria-hidden="true"
              />
              <div class="grid min-w-0 gap-px">
                <template v-if="item.type === 'steam'">
                  <span class="text-sm font-medium">{{
                    item.vac > 0 && item.game > 0
                      ? $t("pages.bans.timeline.steam_both")
                      : item.vac > 0
                        ? $t(
                            "pages.bans.timeline.steam_vac",
                            { count: item.vac },
                            item.vac,
                          )
                        : $t(
                            "pages.bans.timeline.steam_game",
                            { count: item.game },
                            item.game,
                          )
                  }}</span>
                  <span class="text-xs text-muted-foreground">{{
                    item.arrived
                      ? $t("pages.bans.timeline.steam_before_join", {
                          date: steamDateLabel(item.day, now),
                        })
                      : $t("pages.bans.timeline.steam_day", {
                          date: steamDateLabel(item.day, now),
                        })
                  }}</span>
                </template>
                <template v-else-if="item.type === 'first_match'">
                  <span class="text-sm font-medium">{{
                    item.only
                      ? $t("pages.bans.timeline.only_match")
                      : $t("pages.bans.timeline.first_match")
                  }}</span>
                  <span class="text-xs text-muted-foreground">{{
                    dateLabel(item.at, now)
                  }}</span>
                </template>
                <template v-else-if="item.type === 'sanction'">
                  <span class="text-sm font-medium">{{
                    item.kind === "auto"
                      ? $t("pages.bans.timeline.banned_auto")
                      : moderator && item.by
                        ? $t("pages.bans.timeline.banned_by", { name: item.by })
                        : $t("pages.bans.timeline.banned_staff")
                  }}</span>
                  <span class="text-xs text-muted-foreground"
                    >{{ dateTimeLabel(item.at, now) }} ·
                    {{ lengthText(item.length)
                    }}<template v-if="item.kind === 'auto'">
                      · {{ $t("pages.bans.timeline.for_vac") }}</template
                    ></span
                  >
                </template>
                <template v-else-if="item.type === 'sanction_end'">
                  <span class="text-sm font-medium">{{
                    $t("pages.bans.timeline.ban_ended")
                  }}</span>
                  <span class="text-xs text-muted-foreground">{{
                    dateTimeLabel(item.at, now)
                  }}</span>
                </template>
                <template v-else-if="item.type === 'last_match'">
                  <span class="text-sm font-medium">{{
                    $t("pages.bans.timeline.last_match")
                  }}</span>
                  <span class="text-xs text-muted-foreground"
                    >{{ dateLabel(item.at, now)
                    }}<template v-if="item.map">
                      · {{ mapLabel({ name: item.map }) }}</template
                    ><template v-if="item.since">
                      ·
                      {{
                        $t(
                          "pages.bans.timeline.matches_after_steam",
                          { count: item.since },
                          item.since,
                        )
                      }}</template
                    ></span
                  >
                </template>
              </div>
            </li>
          </ol>
        </section>

        <section v-if="shared.length" class="grid gap-2">
          <h3 class="text-xs font-semibold text-muted-foreground">
            {{ $t("pages.bans.record.your_matches") }}
          </h3>
          <div
            class="divide-y divide-border overflow-hidden rounded-md border border-border"
          >
            <NuxtLink
              v-for="match in shared"
              :key="match.match_id"
              :to="{ name: 'matches-id', params: { id: match.match_id } }"
              class="flex items-center gap-3 px-3 py-2 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--tac-amber)/0.5)] [@media(hover:hover)]:hover:bg-muted/30"
            >
              <BanMapIcon :map="match.map" />
              <span class="grid min-w-0 flex-1 leading-tight">
                <span class="truncate font-medium">{{
                  match.map ? mapLabel({ name: match.map }) : "—"
                }}</span>
                <span class="truncate text-xs text-muted-foreground">
                  {{ $t(`pages.bans.with_you.${match.side}`) }} ·
                  <TimeAgo :date="match.played_at" hide-icon />
                </span>
              </span>
              <span class="font-bold tabular-nums" :class="scoreClass(match)"
                >{{ match.viewer_score }}–{{ match.other_score }}</span
              >
            </NuxtLink>
          </div>
        </section>

        <section v-if="canAct" class="grid gap-2">
          <h3 class="text-xs font-semibold text-muted-foreground">
            {{ $t("pages.bans.record.moderation") }}
          </h3>
          <template v-if="entry.banned_here && entry.sanction_id">
            <div
              v-if="confirming"
              class="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm"
            >
              <span class="min-w-[12rem] flex-1 text-pretty">{{
                $t("pages.bans.record.end_confirm", {
                  name: entry.player?.name ?? "",
                })
              }}</span>
              <Button
                variant="ghost"
                size="sm"
                :disabled="ending"
                @click="confirming = false"
              >
                {{ $t("pages.bans.record.keep_ban") }}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                :loading="ending"
                @click="endBan"
              >
                {{ $t("pages.bans.record.end_ban") }}
              </Button>
            </div>
            <div v-else>
              <Button
                variant="outline"
                size="sm"
                class="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                @click="confirming = true"
              >
                {{ $t("pages.bans.record.end_now") }}
              </Button>
            </div>
          </template>
          <SanctionPlayer
            v-else
            variant="block"
            :player="entry.player"
            @sanctioned="emit('changed')"
          />
        </section>
      </div>

      <div v-if="entry" class="border-t border-border/60 px-5 py-3">
        <Button as-child variant="outline" size="sm">
          <NuxtLink
            :to="{ name: 'players-id', params: { id: String(entry.steam_id) } }"
          >
            {{ $t("pages.bans.record.open_profile") }}
            <ExternalLink class="h-3.5 w-3.5" />
          </NuxtLink>
        </Button>
      </div>
    </SheetContent>
  </Sheet>
</template>
