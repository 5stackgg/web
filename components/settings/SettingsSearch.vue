<script setup lang="ts">
import { useMediaQuery } from "@vueuse/core";
import { Search, X } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import SettingsStatusChip from "~/components/settings/SettingsStatusChip.vue";
import { useSettingsNav } from "~/composables/useSettingsNav";
import {
  useSettingsSearch,
  type SettingsSearchHit,
} from "~/composables/useSettingsSearch";
import type { SettingsItemStatus } from "~/composables/useSettingsStatus";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

defineProps<{
  statuses?: Record<string, SettingsItemStatus>;
}>();

type Option = {
  id: string;
  path: string;
  hit?: SettingsSearchHit;
};

const query = ref("");
const { search, select } = useSettingsSearch();
const { groups: navGroups } = useSettingsNav();

const searching = computed(() => query.value.trim().length > 0);
const results = computed(() => (searching.value ? search(query.value) : []));

// Each page heading followed by its settings: the order the arrow keys walk.
const options = computed<Option[]>(() =>
  results.value.flatMap((group) => [
    { id: group.path, path: group.path },
    ...group.hits.map((hit) => ({ id: hit.id, path: hit.path, hit })),
  ]),
);
const indexOf = (id: string) =>
  options.value.findIndex((option) => option.id === id);
const hitCount = computed(() =>
  results.value.reduce((sum, group) => sum + group.hits.length, 0),
);

// The subgroup a section sits in ("Integrations"), shown beside its name.
const subgroupOf = computed(() => {
  const map: Record<string, string> = {};
  for (const group of navGroups.value) {
    for (const subgroup of group.subgroups) {
      for (const item of subgroup.items) {
        map[item.path] = subgroup.label;
      }
    }
  }
  return map;
});

const active = ref(0);
watch(query, () => (active.value = 0));

const desktop = useMediaQuery("(min-width: 1024px)");
function clear() {
  query.value = "";
}

function clearAndFocus() {
  clear();
  document.getElementById("settings-search-input")?.focus();
}

// Results take over the content pane, so opening one always hands the pane
// back to the page it points at.
function choose(option: Option) {
  select(option.hit);
  clear();
  if (!desktop.value) {
    (document.activeElement as HTMLElement | null)?.blur();
  }
}

function onKeydown(event: KeyboardEvent) {
  const last = options.value.length - 1;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    if (last < 0) return;
    event.preventDefault();
    active.value = Math.min(
      Math.max(active.value + (event.key === "ArrowDown" ? 1 : -1), 0),
      last,
    );
    document
      .getElementById(`settings-search-option-${active.value}`)
      ?.scrollIntoView({ block: "nearest" });
  } else if (event.key === "Enter" && options.value[active.value]) {
    event.preventDefault();
    const option = options.value[active.value];
    choose(option);
    navigateTo(option.path);
  } else if (event.key === "Escape" && query.value) {
    event.preventDefault();
    clear();
  }
}

const route = useRoute();
watch(
  () => route.path,
  () => clear(),
);

defineExpose({ clear });
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col lg:min-h-0">
    <div
      class="flex max-w-[calc(var(--settings-measure)+0.875rem)] flex-wrap items-center gap-2 pb-5 lg:pl-3"
    >
      <!-- AdminSearch's width; its own input stays, since it is the
           combobox the results hang off (role, activedescendant). -->
      <InputGroup class="h-8 min-w-[12rem] flex-1 bg-card/60 sm:max-w-[18rem]">
        <InputGroupAddon class="pl-2.5">
          <Search class="h-3.5 w-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          id="settings-search-input"
          v-model="query"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="settings-search-results"
          :aria-expanded="searching"
          :aria-activedescendant="
            options.length ? `settings-search-option-${active}` : undefined
          "
          :aria-label="$t('layouts.application_settings.search_placeholder')"
          :placeholder="$t('layouts.application_settings.search_placeholder')"
          autocomplete="off"
          spellcheck="false"
          class="h-full text-sm max-md:text-base"
          @keydown="onKeydown"
        />
        <InputGroupAddon align="inline-end" class="pr-1.5">
          <button
            v-if="query"
            type="button"
            :aria-label="$t('layouts.application_settings.search.clear')"
            class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            @click="clearAndFocus"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </InputGroupAddon>
      </InputGroup>
      <div class="basis-full lg:hidden">
        <slot name="picker" />
      </div>
    </div>

    <!-- Results and the page share one cell: the page stays mounted under the
         results (an edit in progress survives a search) and keeps its own
         scroll position at lg. -->
    <div class="grid min-w-0 grid-rows-[minmax(0,1fr)] lg:min-h-0 lg:flex-1">
      <div
        v-if="searching"
        id="settings-search-results"
        role="listbox"
        class="z-[1] min-w-0 [grid-area:1/1] lg:overflow-y-auto lg:overscroll-contain lg:pl-3 lg:scrollbar-thin"
      >
        <div class="settings-measure pb-40">
          <SectionEmpty
            v-if="!results.length"
            :title="
              $t('layouts.application_settings.search.no_match_title', {
                query: query.trim(),
              })
            "
            :description="
              $t('layouts.application_settings.search.no_match_body')
            "
          >
            <Button variant="outline" size="sm" @click="clearAndFocus">
              {{ $t("layouts.application_settings.search.clear") }}
            </Button>
          </SectionEmpty>
          <template v-else>
            <div
              class="flex items-center justify-between gap-3 pb-3.5 text-[12.5px] text-muted-foreground"
            >
              <span class="tabular-nums">{{
                $t(
                  "layouts.application_settings.search.results",
                  { count: hitCount },
                  hitCount,
                )
              }}</span>
              <button
                type="button"
                class="underline-offset-4 transition-colors hover:text-foreground hover:underline"
                @click="clearAndFocus"
              >
                {{ $t("layouts.application_settings.search.clear") }}
              </button>
            </div>
            <section
              v-for="(group, groupIndex) in results"
              :key="group.path"
              :class="groupIndex > 0 && 'mt-4 border-t border-border/60 pt-4'"
            >
              <NuxtLink
                :id="`settings-search-option-${indexOf(group.path)}`"
                :to="group.path"
                role="option"
                :aria-selected="indexOf(group.path) === active"
                class="-ml-2 flex w-[calc(100%+0.5rem)] items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150"
                :class="
                  indexOf(group.path) === active &&
                  'bg-[hsl(var(--tac-amber)/0.08)]'
                "
                @click="choose({ id: group.path, path: group.path })"
                @mousemove="active = indexOf(group.path)"
              >
                <span :class="[tacticalSectionLabelClasses, 'mb-0']">
                  <span :class="tacticalSectionTickClasses"></span>
                  {{ group.label }}
                </span>
                <span class="text-xs text-muted-foreground/70">{{
                  subgroupOf[group.path]
                }}</span>
                <SettingsStatusChip
                  v-if="statuses?.[group.path]?.chip"
                  :chip="statuses[group.path].chip!"
                  class="ml-auto"
                />
              </NuxtLink>
              <div class="mt-1 grid gap-0.5">
                <NuxtLink
                  v-for="hit in group.hits"
                  :id="`settings-search-option-${indexOf(hit.id)}`"
                  :key="hit.id"
                  :to="hit.path"
                  role="option"
                  :aria-selected="indexOf(hit.id) === active"
                  class="grid gap-0.5 rounded-md px-2.5 py-2 transition-colors duration-150"
                  :class="
                    indexOf(hit.id) === active &&
                    'bg-[hsl(var(--tac-amber)/0.08)]'
                  "
                  @click="choose({ id: hit.id, path: hit.path, hit })"
                  @mousemove="active = indexOf(hit.id)"
                >
                  <span class="text-[13.5px] text-foreground">{{
                    hit.label
                  }}</span>
                  <span
                    v-if="hit.description"
                    class="line-clamp-2 text-xs text-muted-foreground"
                  >
                    {{ hit.description }}
                  </span>
                </NuxtLink>
              </div>
            </section>
          </template>
        </div>
      </div>
      <div
        class="min-w-0 [grid-area:1/1] lg:min-h-0"
        :class="searching ? 'max-lg:hidden lg:invisible' : ''"
      >
        <slot />
      </div>
    </div>
  </div>
</template>
