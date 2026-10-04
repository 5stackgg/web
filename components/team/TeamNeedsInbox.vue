<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { CheckCircle2, Inbox, Users } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import CheckIntoMatch from "~/components/match/CheckIntoMatch.vue";
import CheckInDeadline from "~/components/match/CheckInDeadline.vue";
import DateTimePicker from "~/components/common/DateTimePicker.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import { formatStartTime, teamMonogram } from "~/components/watch/watchTicker";
import { useTeamNeeds, type TeamNeed } from "~/composables/useTeamNeeds";

// The team's to-dos for the person looking at it, behind one header button.
// Hidden when nothing needs them.
const props = defineProps<{ team: any }>();
const emit = defineEmits<{
  (e: "invite"): void;
  // Scrim requests waiting on the team, for the Scrims tab's badge.
  (e: "scrim-count", count: number): void;
}>();

const { t, locale } = useI18n();
const { items, waiting, respond, counter } = useTeamNeeds(() => props.team);

watch(
  () =>
    items.value.filter(
      (item) => item.kind === "scrim" || item.kind === "counter",
    ).length,
  (count) => emit("scrim-count", count),
  { immediate: true },
);
onBeforeUnmount(() => emit("scrim-count", 0));

const open = ref(false);
const trigger = ref<InstanceType<typeof Button> | null>(null);
// Answering the last item removes the popover; it must not come back open
// when the next item arrives.
watch(
  () => items.value.length,
  (count) => {
    if (!count) open.value = false;
  },
);
const busy = ref<string | null>(null);

const checkIn = computed(
  () =>
    items.value.find((item) => item.kind === "check_in") as
      Extract<TeamNeed, { kind: "check_in" }> | undefined,
);

const now = ref(new Date());
const clock =
  typeof window !== "undefined"
    ? setInterval(() => (now.value = new Date()), 60_000)
    : null;
onBeforeUnmount(() => clock && clearInterval(clock));

const apiDomain = useRuntimeConfig().public.apiDomain;
function avatarSrc(path: string) {
  return /^https?:\/\//.test(path) ? path : `https://${apiDomain}/${path}`;
}

function otherTeam(request: any) {
  return request.from_team_id === props.team?.id
    ? request.to_team
    : request.from_team;
}

function checkInOpponent(match: any) {
  const other =
    match?.lineup_1?.team_id === props.team?.id
      ? match?.lineup_2
      : match?.lineup_1;
  return other?.name ?? t("pages.watch.ticker.tbd");
}

function proposedLabel(request: any) {
  return request.proposed_scheduled_at
    ? formatStartTime(request.proposed_scheduled_at, now.value, locale.value)
    : "";
}

async function answer(request: any, accept: boolean) {
  busy.value = request.id;
  try {
    await respond(request.id, accept);
  } finally {
    busy.value = null;
  }
}

const countering = ref<any | null>(null);
const counterAt = ref<string | null>(null);
const counterOpen = computed({
  get: () => !!countering.value,
  set: (value: boolean) => {
    if (!value) countering.value = null;
  },
});

function startCounter(request: any) {
  counterAt.value = request.proposed_scheduled_at ?? null;
  countering.value = request;
}

async function sendCounter() {
  if (!countering.value || !counterAt.value) return;
  busy.value = countering.value.id;
  try {
    await counter(countering.value.id, new Date(counterAt.value));
    countering.value = null;
  } finally {
    busy.value = null;
  }
}

function focusTrigger(event: Event) {
  event.preventDefault();
  (trigger.value?.$el as HTMLElement | undefined)?.focus();
}

function invite() {
  open.value = false;
  emit("invite");
}

function waitingLabel(entry: (typeof waiting.value)[number]) {
  switch (entry.kind) {
    case "check_in":
      return t("team.pulse.needs.waiting_check_in", {
        names: entry.names.join(", "),
      });
    case "scrim":
      return t("team.pulse.needs.waiting_scrim", { name: entry.teamName });
    case "invites":
      return t("team.pulse.needs.waiting_invites", {
        names: entry.names.join(", "),
      });
  }
}

const amberOutline =
  "h-8 gap-1.5 border-[hsl(var(--tac-amber)/0.55)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.1)] hover:text-[hsl(var(--tac-amber))]";
</script>

<template>
  <Popover v-if="items.length" v-model:open="open">
    <!-- One trigger element: reka records it on mount, so swapping buttons
         when a check-in opens would leave it pointing at a removed node. -->
    <PopoverTrigger as-child>
      <Button
        ref="trigger"
        :variant="checkIn ? 'default' : 'outline'"
        size="sm"
        :class="
          checkIn
            ? 'tac-amber-cta h-8 gap-2 border font-semibold'
            : amberOutline
        "
      >
        <CheckCircle2 v-if="checkIn" class="size-3.5" />
        <Inbox v-else class="size-3.5" />
        {{
          checkIn
            ? $t("pages.play.schedule.check_in")
            : $t("team.pulse.needs.title")
        }}
        <CheckInDeadline
          v-if="checkIn?.match.cancels_at"
          :cancels-at="checkIn.match.cancels_at"
        />
        <span
          class="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.65rem] font-bold tabular-nums"
          :class="
            checkIn
              ? 'bg-[hsl(var(--tac-amber-foreground))] text-[hsl(var(--tac-amber))]'
              : 'bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))]'
          "
          ><span aria-hidden="true">{{ items.length }}</span
          ><span class="sr-only">{{
            $t("team.pulse.needs.to_do", { count: items.length })
          }}</span></span
        >
      </Button>
    </PopoverTrigger>

    <PopoverContent align="end" class="w-[min(92vw,420px)] p-1.5">
      <div class="flex items-center justify-between gap-2 px-2.5 pb-2 pt-1.5">
        <b class="text-sm font-semibold">{{ $t("team.pulse.needs.title") }}</b>
        <span class="text-xs text-muted-foreground tabular-nums">{{
          $t("team.pulse.needs.to_do", { count: items.length })
        }}</span>
      </div>

      <ul class="grid divide-y divide-border/70">
        <li
          v-for="(item, index) in items"
          :key="item.key"
          class="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 gap-y-2 px-2.5 py-3"
        >
          <!-- Check in: the match page's own control, with its clock -->
          <template v-if="item.kind === 'check_in'">
            <span
              class="inline-grid size-9 place-items-center rounded-md bg-[hsl(var(--tac-amber)/0.14)] text-[hsl(var(--tac-amber))]"
            >
              <CheckCircle2 class="size-4" />
            </span>
            <div class="min-w-0 self-center">
              <p class="text-sm font-semibold">
                {{
                  $t("team.pulse.needs.check_in_title", {
                    name: checkInOpponent(item.match),
                  })
                }}
              </p>
              <NuxtLink
                :to="{ name: 'matches-id', params: { id: item.match.id } }"
                class="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                @click="open = false"
              >
                {{ $t("pages.play.schedule.open_match") }}
              </NuxtLink>
            </div>
            <div class="col-start-2">
              <CheckIntoMatch :match="item.match" />
            </div>
          </template>

          <!-- A scrim request or counter-offer waiting on this team -->
          <template
            v-else-if="item.kind === 'scrim' || item.kind === 'counter'"
          >
            <img
              v-if="otherTeam(item.request)?.avatar_url"
              :src="avatarSrc(otherTeam(item.request).avatar_url)"
              alt=""
              class="size-9 rounded-md object-cover"
            />
            <span
              v-else
              aria-hidden="true"
              class="inline-grid size-9 place-items-center rounded-md bg-muted text-[0.6rem] font-extrabold tracking-wide text-foreground/80"
              >{{
                teamMonogram(
                  otherTeam(item.request)?.name ?? "?",
                  otherTeam(item.request)?.short_name,
                )
              }}</span
            >
            <div class="min-w-0 self-center">
              <p class="text-sm font-semibold [overflow-wrap:anywhere]">
                <NuxtLink
                  v-if="otherTeam(item.request)?.id"
                  :to="{
                    name: 'teams-id',
                    params: { id: otherTeam(item.request).id },
                  }"
                  class="font-bold hover:underline"
                  @click="open = false"
                  >{{ otherTeam(item.request)?.name }}</NuxtLink
                >
                {{
                  item.kind === "counter"
                    ? $t("team.pulse.needs.counter_title")
                    : $t("team.pulse.needs.scrim_title")
                }}
              </p>
              <p class="text-xs text-muted-foreground tabular-nums">
                <template v-if="proposedLabel(item.request)"
                  >{{ proposedLabel(item.request) }} ·
                </template>
                {{
                  $t("team.pulse.needs.best_of_short", {
                    count: item.request.match_options?.best_of ?? 1,
                  })
                }}
                ·
                <TimeAgo :date="item.request.created_at" />
              </p>
            </div>
            <div class="col-start-2 flex flex-wrap gap-2">
              <Button
                v-if="index === 0"
                size="sm"
                class="tac-amber-cta h-8 border font-semibold"
                :disabled="busy === item.request.id"
                @click="answer(item.request, true)"
              >
                {{ $t("common.accept") }}
              </Button>
              <Button
                v-else
                variant="outline"
                size="sm"
                :class="amberOutline"
                :disabled="busy === item.request.id"
                @click="answer(item.request, true)"
              >
                {{ $t("common.accept") }}
              </Button>
              <Button
                variant="outline"
                size="sm"
                class="h-8"
                :disabled="busy === item.request.id"
                @click="startCounter(item.request)"
              >
                {{ $t("scrim.counter") }}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="h-8 text-muted-foreground"
                :disabled="busy === item.request.id"
                @click="answer(item.request, false)"
              >
                {{ $t("common.decline") }}
              </Button>
            </div>
          </template>

          <!-- Fewer than five starters -->
          <template v-else-if="item.kind === 'roster'">
            <span
              class="inline-grid size-9 place-items-center rounded-md bg-muted text-foreground/80"
            >
              <Users class="size-4" />
            </span>
            <div class="min-w-0 self-center">
              <p class="text-sm font-semibold">
                {{
                  $t("team.pulse.needs.roster_title", {
                    count: item.starters,
                  })
                }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ $t("team.pulse.needs.roster_meta") }}
              </p>
            </div>
            <div class="col-start-2">
              <Button
                variant="outline"
                size="sm"
                :class="index === 0 ? amberOutline : 'h-8'"
                @click="invite"
              >
                {{ $t("team.members.invite_player") }}
              </Button>
            </div>
          </template>
        </li>
      </ul>

      <p
        v-if="waiting.length"
        class="mx-2.5 mb-1.5 mt-1 border-t border-border/70 pt-2.5 text-xs text-muted-foreground"
      >
        <span
          class="mr-1.5 font-semibold uppercase tracking-[0.12em] text-[0.65rem]"
          >{{ $t("team.pulse.needs.waiting_on") }}</span
        >
        <template v-for="(entry, i) in waiting" :key="entry.key">
          <span v-if="i" aria-hidden="true"> · </span>
          <span>{{ waitingLabel(entry) }}</span>
        </template>
      </p>
    </PopoverContent>
  </Popover>

  <Dialog v-model:open="counterOpen">
    <DialogContent class="sm:max-w-md" @close-auto-focus="focusTrigger">
      <DialogHeader>
        <DialogTitle>{{
          $t("team.pulse.needs.counter_dialog_title")
        }}</DialogTitle>
        <DialogDescription>
          {{
            $t("team.pulse.needs.counter_dialog_description", {
              name: countering ? otherTeam(countering)?.name : "",
            })
          }}
        </DialogDescription>
      </DialogHeader>
      <DateTimePicker v-model="counterAt" />
      <DialogFooter class="gap-2">
        <Button variant="outline" class="h-8" @click="counterOpen = false">
          {{ $t("common.cancel") }}
        </Button>
        <Button
          class="tac-amber-cta h-8 border font-semibold"
          :disabled="!counterAt || busy === countering?.id"
          @click="sendCounter"
        >
          {{ $t("team.pulse.needs.send_new_time") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
