<script setup lang="ts">
import { computed, nextTick, onMounted, watch } from "vue";
import { DiscordLogoIcon } from "@radix-icons/vue";
import { BookOpen, ExternalLink, FlaskConical, Github } from "lucide-vue-next";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import FaqContent from "~/components/faq/FaqContent.vue";
import FaqNav from "~/components/faq/FaqNav.vue";
import { PageTransition } from "~/components/ui/transitions";
import {
  FAQ_DOCS_URL,
  useFaqDialog,
  useFaqOutline,
  useFaqReader,
} from "~/composables/useFaq";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useAuthStore } from "~/stores/AuthStore";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const { t } = useI18n();
const route = useRoute();
const outline = useFaqOutline();
const { isAdmin } = useFaqReader();
const signedIn = computed(() => !!useAuthStore().me);

useHead({ title: () => t("faq.title") });

function go(anchor: string) {
  const target = document.getElementById(anchor);
  if (!target) {
    return;
  }
  history.replaceState(history.state, "", `#${anchor}`);
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function followHash() {
  const anchor = decodeURIComponent(route.hash.replace(/^#/, ""));
  if (!anchor) {
    return;
  }
  await nextTick();
  document.getElementById(anchor)?.scrollIntoView({ block: "start" });
}

onMounted(() => {
  setTimeout(followHash, 60);
});

watch(() => route.hash, followHash);

const { jump } = useFaqDialog();
watch(jump, (value) => {
  if (value) {
    go(value.anchor);
  }
});

const inviteLink = computed(
  () => `https://${useRuntimeConfig().public.webDomain}/discord-invite`,
);
const githubUrl = computed(() => useApplicationSettingsStore().githubUrl);

const supportLinks = computed(() =>
  [
    {
      key: "discord",
      icon: DiscordLogoIcon,
      label: t("faq.support.discord"),
      href: inviteLink.value,
    },
    {
      key: "github",
      icon: Github,
      label: t("faq.support.github"),
      href: githubUrl.value,
    },
    {
      key: "docs",
      icon: BookOpen,
      label: t("faq.support.docs"),
      href: FAQ_DOCS_URL,
    },
  ].filter((link) => isAdmin.value || link.key === "discord"),
);
</script>

<template>
  <div class="mx-auto flex w-full max-w-[78rem] flex-col gap-6 pb-16">
    <PageTransition>
      <TacticalPageHeader>
        <template #title>{{ $t("faq.title") }}</template>
        <template #actions>
          <NuxtLink
            to="/faq/demo-match"
            class="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] px-3 py-2 font-mono text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))] transition-colors hover:bg-[hsl(var(--tac-amber)/0.18)]"
          >
            <FlaskConical class="size-3.5" />
            {{ $t("faq.content.demo.open") }}
          </NuxtLink>
        </template>
      </TacticalPageHeader>
    </PageTransition>

    <PageTransition :delay="40">
      <p class="max-w-3xl text-sm leading-relaxed text-muted-foreground">
        {{ isAdmin ? $t("faq.intro_admin") : $t("faq.intro") }}
        <template v-if="signedIn">{{ $t("faq.search_hint") }}</template>
      </p>
    </PageTransition>

    <div class="grid items-start gap-8 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <PageTransition :delay="80" class="lg:sticky lg:top-4">
        <aside
          class="lg:max-h-[calc(100svh-6rem)] lg:overflow-y-auto lg:pr-1 [scrollbar-width:thin]"
        >
          <FaqNav :parts="outline" @go="go" />
        </aside>
      </PageTransition>

      <PageTransition :delay="160">
        <main class="flex min-w-0 flex-col gap-10">
          <FaqContent />

          <section class="tac-section-sep py-6">
            <div :class="tacticalSectionLabelClasses">
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t("faq.support.title") }}
            </div>
            <p
              class="mb-4 max-w-3xl text-sm leading-relaxed text-muted-foreground"
            >
              {{
                isAdmin
                  ? $t("faq.support.description")
                  : $t("faq.support.description_player")
              }}
            </p>
            <div class="flex flex-wrap gap-3">
              <a
                v-for="link in supportLinks"
                :key="link.key"
                :href="link.href"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.18)]"
              >
                <component :is="link.icon" class="size-3.5" />
                {{ link.label }}
                <ExternalLink class="size-3 opacity-60" />
              </a>
            </div>
          </section>
        </main>
      </PageTransition>
    </div>
  </div>
</template>
