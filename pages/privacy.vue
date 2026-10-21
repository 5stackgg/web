<script setup lang="ts">
import { computed } from "vue";
import LegalPage from "~/components/legal/LegalPage.vue";
import LegalDocument from "~/components/legal/LegalDocument.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

const { t } = useI18n();
const { brandName } = useBranding();
const settingsStore = useApplicationSettingsStore();

const brand = computed(() => brandName.value || "5Stack");

// Optional features only get a line when this site has them turned on.
function setting(name: string) {
  return settingsStore.settings.find((s) => s.name === name)?.value;
}

function shown(...lines: (string | false)[]) {
  return lines.filter((line): line is string => !!line);
}

const sections = computed(() => {
  const on = (name: string) => setting(name) === "true";
  const analytics = !!setting("public.google_tagmanager_code");
  const calls =
    on("public.voice_chat_enabled") || on("public.video_chat_enabled");

  return [
    {
      id: "operators",
      title: t("legal.privacy.operators.title"),
      body: [t("legal.privacy.operators.body")],
    },
    {
      id: "collect",
      title: t("legal.privacy.collect.title"),
      body: [t("legal.privacy.collect.body")],
      items: [
        t("legal.privacy.collect.steam"),
        t("legal.privacy.collect.gameplay"),
        t("legal.privacy.collect.content"),
        t("legal.privacy.collect.social"),
        t("legal.privacy.collect.technical"),
        t("legal.privacy.collect.servers"),
      ],
      after: [
        t("legal.privacy.collect.unregistered"),
        t("legal.privacy.collect.uploads"),
      ],
    },
    {
      id: "linked",
      title: t("legal.privacy.linked.title"),
      body: [t("legal.privacy.linked.body")],
      items: shown(
        on("public.supports_discord_bot") && t("legal.privacy.linked.discord"),
        on("public.supports_twitch") && t("legal.privacy.linked.twitch"),
        on("public.external_matches_enabled") &&
          t("legal.privacy.linked.steam_history"),
        on("public.steam_presence_enabled") &&
          t("legal.privacy.linked.steam_presence"),
        t("legal.privacy.linked.steam_friends"),
        t("legal.privacy.linked.faceit"),
      ),
    },
    calls && {
      id: "calls",
      title: t("legal.privacy.calls.title"),
      body: [t("legal.privacy.calls.body"), t("legal.privacy.calls.stun")],
    },
    {
      id: "use",
      title: t("legal.privacy.use.title"),
      items: [
        t("legal.privacy.use.matches"),
        t("legal.privacy.use.fair_play"),
        t("legal.privacy.use.notifications"),
        t("legal.privacy.use.security"),
      ],
    },
    {
      id: "public",
      title: t("legal.privacy.public.title"),
      body: [t("legal.privacy.public.body"), t("legal.privacy.public.chat")],
    },
    {
      id: "sharing",
      title: t("legal.privacy.sharing.title"),
      body: [t("legal.privacy.sharing.body")],
      items: [
        t("legal.privacy.sharing.steam"),
        t("legal.privacy.sharing.push"),
        t("legal.privacy.sharing.media"),
        t("legal.privacy.sharing.hosting"),
        t("legal.privacy.sharing.telemetry"),
      ],
      after: [t("legal.privacy.sharing.law")],
    },
    {
      id: "cookies",
      title: t("legal.privacy.cookies.title"),
      body: shown(
        t("legal.privacy.cookies.body"),
        analytics && t("legal.privacy.cookies.analytics"),
      ),
    },
    {
      id: "retention",
      title: t("legal.privacy.retention.title"),
      items: [
        t("legal.privacy.retention.profile"),
        t("legal.privacy.retention.chat"),
        t("legal.privacy.retention.direct"),
        t("legal.privacy.retention.edits"),
        t("legal.privacy.retention.sessions"),
        t("legal.privacy.retention.demos"),
        t("legal.privacy.retention.backups"),
      ],
    },
    {
      id: "choices",
      title: t("legal.privacy.choices.title"),
      items: [
        t("legal.privacy.choices.settings"),
        t("legal.privacy.choices.unlink"),
        t("legal.privacy.choices.api_keys"),
        t("legal.privacy.choices.requests"),
      ],
      after: [t("legal.privacy.choices.rights")],
    },
    {
      id: "children",
      title: t("legal.privacy.children.title"),
      body: [t("legal.privacy.children.body")],
    },
    {
      id: "changes",
      title: t("legal.privacy.changes.title"),
      body: [t("legal.privacy.changes.body")],
    },
    {
      id: "contact",
      title: t("legal.privacy.contact.title"),
      body: [t("legal.privacy.contact.body")],
    },
  ].filter((section) => section !== false);
});
</script>

<template>
  <LegalPage :title="$t('legal.privacy.title')" updated="2026-10-21">
    <LegalDocument
      :intro="$t('legal.privacy.intro', { brand })"
      :sections="sections"
    />
  </LegalPage>
</template>
