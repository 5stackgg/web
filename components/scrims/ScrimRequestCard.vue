<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ArrowRight, Check, ChevronRight, Lock, Send, Zap } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import ScrimStatusTag from "~/components/scrims/ScrimStatusTag.vue";
import ScrimTimeChips from "~/components/scrims/ScrimTimeChips.vue";
import {
  awaitingTeam,
  scrimOpponent,
  useScrimActions,
} from "~/composables/useScrimFinder";
import teamAvatarSrc from "~/utilities/teamAvatar";
import { dayLabel, timeLabel } from "~/utilities/scrimFormat";
import {
  dayOffset,
  firstStart,
  openIntervals,
  seriesMinutes,
  type OpenInterval,
} from "~/utilities/scrimSchedule";

const props = defineProps<{
  request: any;
  teamId: string;
  teamName: string;
  now: Date;
  mine?: OpenInterval[] | null;
  lockedBy?: string | null;
  urgent?: boolean;
  showStatus?: boolean;
  showOpen?: boolean;
}>();

const emit = defineEmits<{ (e: "open", opponent: any): void }>();

const { t } = useI18n();
const actions = useScrimActions();

const opponent = computed(() => scrimOpponent(props.request, props.teamId) ?? {});
const at = computed(() => new Date(props.request.proposed_scheduled_at).getTime());
const bestOf = computed(() => props.request.match_options?.best_of ?? 1);
const booked = computed(() => props.request.status === "Matched");
const ours = computed(() => awaitingTeam(props.request, props.teamId));
const when = (ms: number) =>
  t("scrims.when", { day: dayLabel(ms, props.now), time: timeLabel(ms) });

function duration(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  return minutes < 60
    ? t("scrims.duration.minutes", { n: minutes })
    : t("scrims.duration.hours", { n: Math.round(minutes / 60) });
}

const trail = computed(() => {
  const proposals = props.request.proposals ?? [];
  if (proposals.length < 2) return null;
  const [before, after] = proposals.slice(-2);
  return {
    before: {
      mine: before.proposed_by_team_id === props.teamId,
      at: new Date(before.proposed_scheduled_at).getTime(),
    },
    after: {
      mine: after.proposed_by_team_id === props.teamId,
      at: new Date(after.proposed_scheduled_at).getTime(),
    },
  };
});

const timing = computed(() => {
  const nowMs = props.now.getTime();
  if (ours.value && at.value - nowMs < 2 * 3_600_000) {
    return t("scrims.requests.starts_in", { time: duration(at.value - nowMs) });
  }
  const expires = props.request.expires_at
    ? new Date(props.request.expires_at).getTime() - nowMs
    : null;
  if (expires == null || expires <= 0) return null;
  return ours.value
    ? t("scrims.requests.answer_within", { time: duration(expires) })
    : t("scrims.requests.their_turn", { team: opponent.value.name, time: duration(expires) });
});

const busy = ref<string | null>(null);
async function act(name: string, run: () => Promise<boolean>) {
  busy.value = name;
  await run();
  busy.value = null;
}

const confirming = ref(false);
const countering = ref(false);
const theirs = computed(() => openIntervals(opponent.value.scrim_availability, props.now));
const counterDay = ref(0);
const counterAt = ref<number | null>(null);
function startCounter() {
  const minutes = seriesMinutes(bestOf.value);
  const first =
    firstStart(theirs.value, minutes, props.now, props.mine ?? undefined) ??
    firstStart(theirs.value, minutes, props.now);
  counterAt.value = first;
  counterDay.value = first != null ? dayOffset(first, props.now) : 0;
  countering.value = true;
}
async function sendCounter() {
  if (counterAt.value == null) return;
  await act("counter", () =>
    actions.counter(props.request.id, counterAt.value!, opponent.value.name),
  );
  countering.value = false;
}
</script>

<template>
  <article
    class="grid gap-2.5 rounded-lg border bg-card/40 p-3.5"
    :class="urgent ? 'border-[hsl(var(--tac-amber)/0.45)]' : 'border-border'"
  >
    <div class="flex min-w-0 items-center gap-2.5">
      <Avatar shape="square" class="h-8 w-8 shrink-0 rounded-md">
        <AvatarImage v-if="teamAvatarSrc(opponent)" :src="teamAvatarSrc(opponent)!" :alt="opponent.name" />
        <AvatarFallback class="rounded-md text-[0.65rem] font-semibold uppercase">
          {{ (opponent.name || "?").slice(0, 2) }}
        </AvatarFallback>
      </Avatar>
      <div class="grid min-w-0 flex-1 gap-px">
        <span class="truncate font-semibold">{{ opponent.name }}</span>
        <span class="text-xs tabular-nums text-muted-foreground">
          {{ when(at) }} · {{ $t("scrims.form.best_of", { n: bestOf }) }}
        </span>
      </div>
      <ScrimStatusTag v-if="showStatus" :tone="booked ? 'ok' : ours ? 'amber' : 'muted'">
        {{
          booked
            ? $t("scrims.requests.booked")
            : ours
              ? $t("scrims.status.needs_you")
              : $t("scrims.requests.waiting")
        }}
      </ScrimStatusTag>
      <Button
        v-if="showOpen"
        variant="ghost"
        size="icon-sm"
        :aria-label="$t('scrims.requests.open_team', { team: opponent.name })"
        @click="emit('open', opponent)"
      >
        <ChevronRight class="h-4 w-4" />
      </Button>
    </div>

    <p v-if="request.auto_generated && !booked" class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <ScrimStatusTag tone="amber"><Zap class="h-3 w-3" />{{ $t("scrims.requests.suggested") }}</ScrimStatusTag>
      {{ $t("scrims.requests.suggested_why", { time: timeLabel(at) }) }}
    </p>

    <p v-if="trail" class="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      {{ trail.before.mine ? $t("scrims.requests.you_asked") : $t("scrims.requests.they_asked") }}
      <s class="tabular-nums text-muted-foreground/70">{{ when(trail.before.at) }}</s>
      <ArrowRight class="h-3 w-3" />
      {{ trail.after.mine ? $t("scrims.requests.you_proposed") : $t("scrims.requests.they_proposed") }}
      <b class="font-semibold tabular-nums text-foreground">{{ when(trail.after.at) }}</b>
    </p>

    <p v-if="timing && !booked" class="text-xs text-muted-foreground">{{ timing }}</p>

    <template v-if="booked">
      <div
        v-if="confirming"
        class="flex flex-wrap items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm"
      >
        <span class="min-w-[12rem] flex-1">{{ $t("scrims.requests.cancel_confirm", { team: teamName }) }}</span>
        <Button size="sm" variant="outline" @click="confirming = false">{{ $t("scrims.requests.keep") }}</Button>
        <Button
          size="sm"
          variant="destructive"
          :loading="busy === 'cancel'"
          @click="act('cancel', () => actions.cancel(request.id, true, opponent.name))"
        >
          {{ $t("scrims.requests.cancel_scrim") }}
        </Button>
      </div>
      <div v-else class="flex flex-wrap items-center gap-2">
        <Button as-child size="sm" variant="secondary">
          <NuxtLink :to="`/matches/${request.match_id}`">{{ $t("scrims.requests.view_match") }}</NuxtLink>
        </Button>
        <Button size="sm" variant="ghost" class="ml-auto text-muted-foreground" @click="confirming = true">
          {{ $t("scrims.requests.cancel_scrim") }}
        </Button>
      </div>
    </template>

    <template v-else-if="ours">
      <template v-if="lockedBy">
        <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock class="h-3 w-3" />
          {{ $t("scrims.requests.locked", { team: lockedBy }) }}
        </p>
        <div>
          <Button size="sm" variant="outline" :loading="busy === 'decline'" @click="act('decline', () => actions.respond(request.id, false, opponent.name))">
            {{ $t("common.decline") }}
          </Button>
        </div>
      </template>
      <div v-else-if="countering" class="grid gap-3 border-t border-border pt-3">
        <span class="text-xs font-medium text-muted-foreground">
          {{ $t("scrims.requests.counter_title", { team: opponent.name }) }}
        </span>
        <ScrimTimeChips
          v-model:day="counterDay"
          v-model:start="counterAt"
          :intervals="theirs"
          :mine="mine"
          :minutes="seriesMinutes(bestOf)"
          :now="now"
          :both-label="$t('scrims.form.both_free_legend', { team: teamName })"
        />
        <div class="flex flex-wrap items-center gap-2">
          <Button size="sm" class="tac-amber-cta gap-1.5" :disabled="counterAt == null" :loading="busy === 'counter'" @click="sendCounter">
            <Send class="h-3.5 w-3.5" />
            {{ counterAt != null ? $t("scrims.requests.counter_send", { when: when(counterAt) }) : $t("scrims.requests.counter_pick") }}
          </Button>
          <Button size="sm" variant="ghost" @click="countering = false">{{ $t("scrims.requests.never_mind") }}</Button>
        </div>
      </div>
      <div v-else class="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          :variant="urgent ? 'default' : 'secondary'"
          class="gap-1.5"
          :class="{ 'tac-amber-cta': urgent }"
          :loading="busy === 'accept'"
          @click="act('accept', () => actions.respond(request.id, true, opponent.name))"
        >
          <Check class="h-3.5 w-3.5" />
          {{ $t("scrims.requests.accept", { time: timeLabel(at) }) }}
        </Button>
        <Button size="sm" variant="outline" @click="startCounter">{{ $t("scrims.requests.propose") }}</Button>
        <Button size="sm" variant="ghost" class="text-muted-foreground" :loading="busy === 'decline'" @click="act('decline', () => actions.respond(request.id, false, opponent.name))">
          {{ $t("common.decline") }}
        </Button>
      </div>
    </template>

    <div v-else>
      <Button size="sm" variant="ghost" class="text-muted-foreground" :loading="busy === 'cancel'" @click="act('cancel', () => actions.cancel(request.id, false, opponent.name))">
        {{ $t("scrims.requests.cancel_request") }}
      </Button>
    </div>
  </article>
</template>
