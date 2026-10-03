<script setup lang="ts">
import { computed, ref } from "vue";
import { CheckCircle2, Plug, Trophy } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { generateMutation } from "~/graphql/graphqlGen";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import type { ScheduleRowModel } from "~/components/play/scheduleRow";

const props = defineProps<{
  model: ScheduleRowModel;
  // The raw match, for the connect link; null for tournament rows.
  match?: any;
}>();

// Team avatars are stored as paths on the API host.
const apiDomain = useRuntimeConfig().public.apiDomain;
function avatarSrc(avatar: string) {
  return /^https?:\/\//.test(avatar)
    ? avatar
    : `https://${apiDomain}/${avatar}`;
}

const path = computed(() =>
  props.model.kind === "match"
    ? `/matches/${props.model.id}`
    : `/tournaments/${props.model.id}`,
);

const stateClasses = computed(() => {
  switch (props.model.state.tone) {
    case "hot":
      return "font-semibold text-[hsl(var(--tac-amber))]";
    case "live":
      return "font-semibold text-destructive";
    case "ok":
      return "text-foreground/85";
    default:
      return "text-muted-foreground";
  }
});

const checkingIn = ref(false);

async function checkIn() {
  checkingIn.value = true;
  try {
    await getGraphqlClient().mutate({
      mutation: generateMutation({
        checkIntoMatch: [{ match_id: props.model.id }, { success: true }],
      }),
    });
  } catch {
    // Refused (a required camera, a closed window): the match page has the
    // full check-in with its camera setup and deadline.
    navigateTo(path.value);
  } finally {
    checkingIn.value = false;
  }
}
</script>

<template>
  <div
    class="schedule-row grid items-center gap-4 rounded-lg border border-border bg-muted/20 px-3.5 py-3"
  >
    <div class="row-when min-w-0">
      <b class="block text-base font-bold tabular-nums">{{ model.time }}</b>
      <span v-if="model.sub" class="text-xs text-muted-foreground">{{
        model.sub
      }}</span>
    </div>

    <div class="row-what grid min-w-0 gap-0.5">
      <div
        class="flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold"
      >
        <template v-if="model.teams">
          <template v-for="(team, index) in model.teams" :key="index">
            <span
              v-if="index === 1"
              class="text-[12.5px] font-medium text-muted-foreground"
              >{{ $t("pages.play.schedule.vs") }}</span
            >
            <span class="inline-flex min-w-0 items-center gap-1.5">
              <img
                v-if="team.avatar"
                :src="avatarSrc(team.avatar)"
                alt=""
                class="size-5 shrink-0 rounded-[4px] object-cover"
              />
              <span
                v-else
                aria-hidden="true"
                class="inline-grid size-5 shrink-0 place-items-center rounded-[4px] bg-muted text-[0.6rem] font-extrabold tracking-wide text-foreground/80"
                >{{ team.monogram }}</span
              >
              <span class="truncate">{{ team.name }}</span>
            </span>
          </template>
        </template>
        <span v-else class="inline-flex min-w-0 items-center gap-1.5">
          <Trophy class="size-4 shrink-0 text-[hsl(var(--tac-amber))]" />
          <span class="truncate">{{ model.title }}</span>
        </span>
      </div>
      <p
        v-if="model.meta"
        class="m-0 truncate text-[12.5px] text-muted-foreground"
      >
        {{ model.meta }}
      </p>
    </div>

    <span class="row-state text-[13px] tabular-nums" :class="stateClasses">
      {{ model.state.text }}
    </span>

    <div class="row-action flex justify-end">
      <Button
        v-if="model.action === 'check_in'"
        variant="outline"
        size="sm"
        class="hit h-8 gap-1.5 border-[hsl(var(--tac-amber)/0.55)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.1)] hover:text-[hsl(var(--tac-amber))]"
        :disabled="checkingIn"
        @click="checkIn"
      >
        <CheckCircle2 class="size-3.5" />
        {{ $t("pages.play.schedule.check_in") }}
      </Button>
      <Button
        v-else-if="model.action === 'connect' && match?.connection_link"
        as-child
        variant="outline"
        size="sm"
        class="hit h-8 gap-1.5"
      >
        <a :href="match.connection_link">
          <Plug class="size-3.5" />
          {{ $t("pages.play.schedule.connect") }}
        </a>
      </Button>
      <Button v-else as-child variant="outline" size="sm" class="hit h-8">
        <NuxtLink :to="path">
          {{
            model.action === "details"
              ? $t("pages.play.schedule.details")
              : $t("pages.play.schedule.open_match")
          }}
        </NuxtLink>
      </Button>
    </div>
  </div>
</template>

<style scoped>
.schedule-row {
  grid-template-columns: 96px minmax(0, 1.4fr) minmax(0, 1fr) auto;
}

/* Phones: time and teams on top, the state and one full-width action below. */
@media (max-width: 900px) {
  .schedule-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }
  .row-when {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .row-when b {
    display: inline;
  }
  .row-action {
    justify-content: stretch;
  }
  .row-action > * {
    flex: 1;
  }
}

.hit {
  position: relative;
}
@media (pointer: coarse) {
  .hit::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: max(100%, 2.75rem);
    transform: translateY(-50%);
  }
}
</style>
