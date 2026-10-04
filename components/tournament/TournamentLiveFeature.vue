<script setup lang="ts">
import { computed } from "vue";
import { Button } from "~/components/ui/button";
import TournamentBracketPreview from "~/components/tournament/TournamentBracketPreview.vue";
import TournamentFactList from "~/components/tournament/TournamentFactList.vue";
import TournamentPrizeSplit from "~/components/tournament/TournamentPrizeSplit.vue";
import { useTournamentDisplay } from "~/composables/useTournamentDisplay";

const props = defineProps<{ tournament: any }>();

const { paused, bannerSrc, statusLabel, categories, sub } =
  useTournamentDisplay(() => props.tournament);

const path = computed(() => `/tournaments/${props.tournament.id}`);
</script>

<template>
  <article class="overflow-hidden rounded-lg border border-border bg-card/40">
    <div
      class="relative isolate flex flex-wrap items-end justify-between gap-x-7 gap-y-4 px-4 pb-5 pt-24 sm:min-h-[13rem] sm:px-6 sm:pt-6"
    >
      <img
        v-if="bannerSrc"
        :src="bannerSrc"
        alt=""
        class="absolute inset-0 -z-20 h-full w-full object-cover object-[50%_40%]"
      />
      <div aria-hidden="true" class="scrim absolute inset-0 -z-10"></div>

      <div class="grid min-w-0 max-w-[680px] gap-2">
        <p
          class="m-0 flex flex-wrap items-center gap-x-1.5 text-[0.8125rem] text-foreground/80"
        >
          <span class="relative mr-0.5 inline-flex h-2 w-2 shrink-0">
            <span
              v-if="!paused"
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75 motion-reduce:animate-none"
            ></span>
            <span
              class="relative inline-flex h-2 w-2 rounded-full"
              :class="paused ? 'bg-muted-foreground' : 'bg-destructive'"
            ></span>
          </span>
          <span
            class="font-semibold"
            :class="paused ? 'text-foreground/85' : 'text-destructive'"
          >
            {{ statusLabel }}
          </span>
          <template v-for="category in categories" :key="category">
            <span aria-hidden="true">·</span>
            <span>{{ category }}</span>
          </template>
        </p>
        <h2
          class="m-0 text-[clamp(1.75rem,3.2vw,2.75rem)] font-extrabold leading-none [text-wrap:balance]"
        >
          <NuxtLink
            :to="path"
            class="hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {{ tournament.name }}
          </NuxtLink>
        </h2>
        <p class="m-0 text-[0.8125rem] text-foreground/70">{{ sub }}</p>
      </div>

      <Button
        v-if="!paused"
        as-child
        size="sm"
        class="hit h-8 shrink-0 border border-destructive/55 bg-destructive/10 text-destructive hover:bg-destructive/20"
      >
        <NuxtLink :to="path">{{ $t("pages.tournaments.watch_live") }}</NuxtLink>
      </Button>
    </div>

    <div
      class="grid border-t border-border lg:grid-cols-[minmax(0,1fr)_18rem]"
    >
      <div class="min-w-0 p-4 sm:p-5">
        <p class="m-0 mb-3 text-xs text-muted-foreground">
          {{
            paused
              ? $t("pages.tournaments.bracket_paused")
              : $t("pages.tournaments.bracket")
          }}
        </p>
        <TournamentBracketPreview :tournament-id="tournament.id" />
      </div>
      <div
        class="grid content-start gap-5 border-t border-border p-4 sm:p-5 lg:border-l lg:border-t-0"
      >
        <TournamentFactList :tournament="tournament" />
        <TournamentPrizeSplit :prizes="tournament.prizes" />
      </div>
    </div>
  </article>
</template>

<style scoped>
.scrim {
  background:
    linear-gradient(
      90deg,
      hsl(240 10% 2% / 0.92) 0%,
      hsl(240 10% 2% / 0.66) 50%,
      hsl(240 10% 2% / 0.25) 100%
    ),
    linear-gradient(180deg, transparent 40%, hsl(240 10% 2% / 0.7));
}
.hit {
  position: relative;
}
@media (pointer: coarse) {
  .hit::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: max(100%, 2.75rem);
    height: max(100%, 2.75rem);
    transform: translate(-50%, -50%);
  }
}
</style>
