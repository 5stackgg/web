<script setup lang="ts">
import { computed } from "vue";
import { Play } from "lucide-vue-next";
import { loginLinks } from "~/utilities/loginLinks";
import { tacticalCtaButtonClasses } from "~/utilities/tacticalClasses";

const isGuest = computed(() => !useAuthStore().me?.steam_id);

function signIn() {
  window.location.href = `${loginLinks.steam}?redirect=${encodeURIComponent(
    window.location.toString(),
  )}`;
}
</script>

<template>
  <section
    class="cold-start relative isolate overflow-hidden rounded-lg border border-border bg-[linear-gradient(180deg,hsl(var(--card)/0.6)_0%,hsl(var(--card)/0.15)_100%)] px-6 py-7 sm:px-8 sm:py-8 [backdrop-filter:blur(6px)]"
  >
    <!-- Corner brackets — same framing motif as TacticalPageHeader, so the
         empty state reads as part of the page chrome rather than a dropped-in
         placeholder card. -->
    <span
      aria-hidden="true"
      class="pointer-events-none absolute left-2 top-2 h-[14px] w-[14px] border-l-2 border-t-2 border-[hsl(var(--tac-amber))]"
    ></span>
    <span
      aria-hidden="true"
      class="pointer-events-none absolute bottom-2 right-2 h-[14px] w-[14px] border-b-2 border-r-2 border-[hsl(var(--tac-amber))]"
    ></span>

    <span
      aria-hidden="true"
      class="tac-scanlines pointer-events-none absolute inset-0 -z-10"
    ></span>
    <span
      aria-hidden="true"
      class="cold-start__vignette pointer-events-none absolute inset-0 -z-10"
    ></span>

    <div class="relative max-w-xl">
      <h2
        class="cold-start__step font-sans text-[clamp(1.6rem,3.6vw,2.5rem)] font-bold uppercase leading-[0.95] tracking-[0.02em] [font-stretch:80%]"
      >
        {{ $t("pages.watch.cold_start.title") }}
      </h2>

      <p
        class="cold-start__step mt-3 max-w-md text-sm leading-relaxed text-muted-foreground"
        style="--step: 1"
      >
        {{ $t("pages.watch.cold_start.description") }}
      </p>

      <div class="cold-start__step mt-6" style="--step: 2">
        <button
          v-if="isGuest"
          type="button"
          :class="tacticalCtaButtonClasses"
          @click="signIn"
        >
          <Play class="h-4 w-4 fill-current" />
          {{ $t("pages.watch.cold_start.cta_guest") }}
        </button>
        <NuxtLink v-else to="/play" :class="tacticalCtaButtonClasses">
          <Play class="h-4 w-4 fill-current" />
          {{ $t("pages.watch.cold_start.cta") }}
        </NuxtLink>
      </div>

      <!-- The three feeds this page will carry, listed as dead channels so the
           empty state doubles as an explanation of what shows up here. -->
      <dl
        class="cold-start__step mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-border/60 pt-4 font-sans text-[0.68rem] uppercase tracking-[0.18em]"
        style="--step: 3"
      >
        <div
          v-for="channel in [
            $t('pages.watch.cold_start.channel_matches'),
            $t('pages.watch.cold_start.channel_tournaments'),
            $t('pages.watch.cold_start.channel_highlights'),
          ]"
          :key="channel"
        >
          <dt class="text-foreground/70">{{ channel }}</dt>
          <dd
            class="mt-1 inline-flex items-center gap-1.5 text-[0.62rem] text-muted-foreground/70"
          >
            <span
              aria-hidden="true"
              class="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
            ></span>
            {{ $t("pages.watch.cold_start.channel_status") }}
          </dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<style scoped>
.cold-start__vignette {
  background: radial-gradient(
    120% 100% at 8% 50%,
    hsl(var(--card) / 0.85) 0%,
    hsl(var(--card) / 0.35) 45%,
    transparent 75%
  );
}

/* Staggered reveal — the panel lands as one gesture instead of five elements
   appearing at once. */
.cold-start__step {
  animation: cold-start-in 420ms ease-out backwards;
  animation-delay: calc(var(--step, 0) * 70ms + 60ms);
}

@keyframes cold-start-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cold-start__step {
    animation: none;
  }
}
</style>
