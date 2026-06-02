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
</script>

<template>
  <PageTransition :delay="0">
    <div class="space-y-0.5">
      <h2 class="text-2xl font-bold tracking-tight">
        {{ $t("layouts.application_settings.title") }}
      </h2>
      <p class="text-muted-foreground">
        {{ $t("layouts.application_settings.description") }}
      </p>
    </div>
  </PageTransition>
  <Separator v-if="showSeparators" class="my-6" />
  <div class="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
    <PageTransition :delay="100">
      <aside class="w-full shrink-0 lg:w-auto">
        <!-- Mobile: single dropdown so all sections are one tap away, no scroll -->
        <div class="lg:hidden">
          <Select v-model="selectedPath">
            <SelectTrigger
              class="w-full"
              :aria-label="$t('ui.tooltips.settings_section')"
            >
              <SelectValue
                :placeholder="$t('layouts.application_settings.select_section')"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup v-for="group in navGroups" :key="group.label">
                <SelectLabel>{{ group.label }}</SelectLabel>
                <SelectItem
                  v-for="item in group.items"
                  :key="item.path"
                  :value="item.path"
                >
                  {{ item.label }}
                </SelectItem>
              </SelectGroup>
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
    <div class="space-y-6 flex-1 min-w-0">
      <slot />
    </div>
  </div>
</template>
