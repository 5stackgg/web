<script setup lang="ts">
import { computed } from "vue";
import LegalPage from "~/components/legal/LegalPage.vue";
import LegalDocument from "~/components/legal/LegalDocument.vue";

const { t } = useI18n();
const { brandName } = useBranding();

const brand = computed(() => brandName.value || "5Stack");

const sections = computed(() => [
  {
    id: "operators",
    title: t("legal.terms.operators.title"),
    body: [t("legal.terms.operators.body")],
  },
  {
    id: "account",
    title: t("legal.terms.account.title"),
    body: [t("legal.terms.account.body"), t("legal.terms.account.age")],
  },
  {
    id: "conduct",
    title: t("legal.terms.conduct.title"),
    body: [t("legal.terms.conduct.body")],
    items: [
      t("legal.terms.conduct.cheating"),
      t("legal.terms.conduct.match_fixing"),
      t("legal.terms.conduct.abuse"),
      t("legal.terms.conduct.impersonation"),
      t("legal.terms.conduct.disruption"),
      t("legal.terms.conduct.security"),
    ],
    after: [t("legal.terms.conduct.competition_rules")],
  },
  {
    id: "moderation",
    title: t("legal.terms.moderation.title"),
    body: [t("legal.terms.moderation.body")],
  },
  {
    id: "content",
    title: t("legal.terms.content.title"),
    body: [t("legal.terms.content.body"), t("legal.terms.content.public")],
  },
  {
    id: "services",
    title: t("legal.terms.services.title"),
    body: [t("legal.terms.services.body"), t("legal.terms.services.valve")],
  },
  {
    id: "software",
    title: t("legal.terms.software.title"),
    body: [t("legal.terms.software.body")],
  },
  {
    id: "warranty",
    title: t("legal.terms.warranty.title"),
    body: [t("legal.terms.warranty.body")],
  },
  {
    id: "liability",
    title: t("legal.terms.liability.title"),
    body: [t("legal.terms.liability.body")],
  },
  {
    id: "ending",
    title: t("legal.terms.ending.title"),
    body: [t("legal.terms.ending.body")],
  },
  {
    id: "changes",
    title: t("legal.terms.changes.title"),
    body: [t("legal.terms.changes.body")],
  },
  {
    id: "contact",
    title: t("legal.terms.contact.title"),
    body: [t("legal.terms.contact.body")],
  },
]);
</script>

<template>
  <LegalPage :title="$t('legal.terms.title')" updated="2026-10-21">
    <LegalDocument
      :intro="$t('legal.terms.intro', { brand })"
      :sections="sections"
    />
  </LegalPage>
</template>
