<script setup lang="ts">
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import SettingsSideTabs from "~/components/settings/SettingsSideTabs.vue";
import { useSettingsNav } from "~/composables/useSettingsNav";

const showSeparators = computed(
  () => useApplicationSettingsStore().showSeparators,
);

const { t: $t } = useI18n();
const { groups: navGroups, items: navItems } = useSettingsNav();

const route = useRoute();
const router = useRouter();

/** Resolve current path to a nav item path (for sub-routes like /players/123). */
const resolvedPath = computed(() => {
  const path = route.path;
  const items = navItems.value ?? [];
  if (items.some((item) => item.path === path)) return path;
  const match = items
    .filter((item) => path.startsWith(item.path + "/"))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match ? match.path : (items[0]?.path ?? path);
});

const selectedPath = computed({
  get: () => resolvedPath.value,
  set: (path: string) => {
    if (path !== route.path) router.push(path);
  },
});

// This nav is long enough to run past a viewport, so a section picked from the
// bottom of it would otherwise render off-screen above the user.
const contentRow = ref<HTMLElement | null>(null);

useScrollIntoViewOnChange(contentRow, () => route.path);
</script>

<template>
  <!-- Two-pane console at lg: the page itself is pinned to the viewport and
       each pane owns its own scrollbar, so the nav and the content scroll
       independently. `overscroll-contain` is what keeps a flick that runs out
       of one pane from ever leaking into the page behind it. -->
  <div
    class="lg:flex lg:flex-col lg:h-[calc(var(--sidebar-height,100svh)-2rem-var(--main-bottom-dock-height,0px))]"
  >
    <PageTransition :delay="0">
      <TacticalPageHeader>
        <template #title>{{
          $t("layouts.application_settings.title")
        }}</template>
        <template #subtitle>{{
          $t("layouts.application_settings.description")
        }}</template>
      </TacticalPageHeader>
    </PageTransition>
    <Separator v-if="showSeparators" class="my-6" />
    <div
      ref="contentRow"
      class="flex flex-col space-y-8 lg:min-h-0 lg:flex-1 lg:flex-row lg:space-x-6 lg:space-y-0"
    >
      <PageTransition :delay="100">
        <aside
          class="w-full shrink-0 lg:h-full lg:w-auto lg:overflow-y-auto lg:overscroll-contain"
        >
          <!-- Mobile: single dropdown so all sections are one tap away, no scroll -->
          <div class="lg:hidden">
            <Select v-model="selectedPath">
              <SelectTrigger
                class="w-full"
                :aria-label="$t('ui.tooltips.settings_section')"
              >
                <SelectValue
                  :placeholder="
                    $t('layouts.application_settings.select_section')
                  "
                />
              </SelectTrigger>
              <SelectContent>
                <template v-for="group in navGroups" :key="group.label">
                  <SelectGroup
                    v-for="subgroup in group.subgroups"
                    :key="`${group.label}-${subgroup.label}`"
                  >
                    <SelectLabel>
                      {{ group.label }} · {{ subgroup.label }}
                    </SelectLabel>
                    <SelectItem
                      v-for="item in subgroup.items"
                      :key="item.path"
                      :value="item.path"
                    >
                      {{ item.label }}
                    </SelectItem>
                  </SelectGroup>
                </template>
              </SelectContent>
            </Select>
          </div>
          <SettingsSideTabs
            :groups="navGroups"
            :active-path="resolvedPath"
            :aria-label="$t('ui.tooltips.settings_section')"
          />
        </aside>
      </PageTransition>
      <!-- Keyed on the route so each tab switch mounts a fresh transition and
           re-fires the enter animation; the shell itself stays mounted, so the
           page's own PageTransition (appear) never re-runs on tab switches.
           The key also hands each section a fresh pane, so switching sections
           always starts at the top without touching the nav's scroll.

           The grid is what lets the outgoing and incoming pane cross-fade: both
           land in the same 1/1 cell, so they stack instead of standing side by
           side and halving the column for the length of the transition. -->
      <div class="grid min-w-0 flex-1 grid-rows-[1fr] lg:min-h-0">
        <PageTransition :key="route.path">
          <div
            class="space-y-6 min-w-0 [grid-area:1/1] lg:h-full lg:overflow-y-auto lg:overscroll-contain"
          >
            <slot />
          </div>
        </PageTransition>
      </div>
    </div>
  </div>
</template>
