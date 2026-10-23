<script setup lang="ts">
import { computed } from "vue";
import { DiscordLogoIcon } from "@radix-icons/vue";
import { useBranding } from "~/composables/useBranding";

const { brandName, logoUrl } = useBranding();
const name = computed(() => brandName.value || "5Stack");

const webDomain = useRuntimeConfig().public.webDomain as string;
// 5Stack's own address, shown only on 5stack.gg: other panels are run by
// other people.
const email = webDomain === "5stack.gg" ? "hello@5stack.gg" : null;
const year = new Date().getFullYear();

const legal = [
  { to: "/terms", label: "legal.terms.title" },
  { to: "/privacy", label: "legal.privacy.title" },
  { to: "/privacy#cookies", label: "pages.welcome.footer.cookies" },
];

const headingClasses =
  "m-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70";
const linkClasses =
  "w-fit text-muted-foreground transition-colors duration-150 hover:text-foreground";
</script>

<template>
  <footer class="border-t border-border">
    <div
      class="mx-auto grid max-w-[1320px] gap-x-8 gap-y-10 px-8 pb-12 pt-14 max-sm:grid-cols-2 max-sm:px-4 sm:grid-cols-[minmax(0,3fr)_repeat(2,minmax(0,1fr))]"
    >
      <div class="grid content-start gap-3 max-sm:col-span-2">
        <span class="inline-flex items-center gap-2.5">
          <img
            :src="logoUrl || '/favicon/192.png'"
            alt=""
            width="28"
            height="28"
            class="size-7 rounded-md object-cover"
          />
          <span class="text-[15px] font-bold uppercase tracking-[0.08em]">
            {{ name }}
          </span>
        </span>
        <p class="m-0 max-w-[20rem] text-sm text-muted-foreground">
          {{ $t("pages.welcome.footer.tagline") }}
        </p>
      </div>

      <div class="grid content-start gap-2.5 text-sm">
        <p :class="headingClasses">{{ $t("pages.welcome.footer.contact") }}</p>
        <a
          :href="`https://${webDomain}/discord-invite`"
          target="_blank"
          rel="noopener noreferrer"
          :class="[linkClasses, 'inline-flex items-center gap-2']"
        >
          <DiscordLogoIcon class="size-4" />
          Discord
        </a>
        <a v-if="email" :href="`mailto:${email}`" :class="linkClasses">
          {{ email }}
        </a>
      </div>

      <nav
        class="grid content-start gap-2.5 text-sm"
        :aria-label="$t('pages.welcome.footer.legal')"
      >
        <p :class="headingClasses">{{ $t("pages.welcome.footer.legal") }}</p>
        <NuxtLink
          v-for="link in legal"
          :key="link.to"
          :to="link.to"
          :class="linkClasses"
        >
          {{ $t(link.label) }}
        </NuxtLink>
      </nav>
    </div>

    <div class="border-t border-border/60">
      <div
        class="mx-auto flex max-w-[1320px] flex-wrap items-start justify-between gap-x-10 gap-y-3 px-8 py-6 text-xs text-muted-foreground max-sm:px-4"
      >
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>© {{ year }} {{ name }}</span>
          <span class="text-muted-foreground/40" aria-hidden="true">·</span>
          <a
            href="https://5stack.gg"
            target="_blank"
            rel="noopener noreferrer"
            :class="linkClasses"
          >
            Powered by 5Stack
          </a>
          <span class="text-muted-foreground/40" aria-hidden="true">·</span>
          <a
            href="https://docs.5stack.gg"
            target="_blank"
            rel="noopener noreferrer"
            :class="[
              linkClasses,
              'underline decoration-dotted decoration-muted-foreground/70 underline-offset-[3px]',
            ]"
          >
            {{ $t("pages.welcome.footer.run_own") }}
          </a>
        </div>
        <p class="m-0 text-muted-foreground/70">
          {{ $t("pages.welcome.footer.valve", { name }) }}
        </p>
      </div>
    </div>
  </footer>
</template>
