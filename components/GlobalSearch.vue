<script setup lang="ts">
import type { Component } from "vue";
import type { RouteLocationRaw } from "vue-router";
import { Cog, Loader2, Search, UserCog } from "lucide-vue-next";
import FilterChip from "~/components/common/FilterChip.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { Kbd } from "~/components/ui/kbd";
import debounce from "~/utilities/debounce";
import {
  useGlobalSearch,
  type GlobalSearchSetting,
} from "~/composables/useGlobalSearch";
import { useGlobalSearchOpen } from "~/composables/useGlobalSearchOpen";
import { selectSetting } from "~/composables/useSettingsSearch";

type Option = {
  id: string;
  index: number;
  to: RouteLocationRaw;
  label: string;
  icon?: Component;
  iconProps?: Record<string, unknown>;
  description?: string;
  aside?: string;
  setting?: GlobalSearchSetting;
  player?: any;
};

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const open = useGlobalSearchOpen();
const query = ref("");
const input = ref<HTMLInputElement | null>(null);
const active = ref(0);
const { search } = useGlobalSearch();

const searching = computed(() => query.value.trim().length > 0);

const groups = computed<{ id: string; label: string; options: Option[] }[]>(
  () => {
    if (!searching.value) {
      return [];
    }
    const { sections, account, application } = search(query.value);
    const settings = (list: GlobalSearchSetting[], icon: Component) =>
      list.map<Option>((setting) => ({
        id: setting.id,
        index: 0,
        to: setting.path,
        label: setting.label,
        icon,
        description: setting.description,
        aside: setting.page,
        setting,
      }));
    const visible = [
      {
        id: "pages",
        label: t("global_search.pages"),
        options: sections.map<Option>((section) => ({
          id: section.id,
          index: 0,
          to: section.to,
          label: section.label,
          icon: section.icon,
          iconProps: section.iconProps,
          aside: section.group,
        })),
      },
      {
        id: "account",
        label: t("layouts.account_settings.title"),
        options: settings(account, UserCog),
      },
      {
        id: "application",
        label: t("layouts.application_settings.title"),
        options: settings(application, Cog),
      },
    ].filter((group) => group.options.length > 0);

    let index = 0;
    for (const option of visible.flatMap((group) => group.options)) {
      option.index = index++;
    }
    return visible;
  },
);

const localOptions = computed<Option[]>(() =>
  groups.value.flatMap((group) => group.options),
);

// Session-local and off by default: this search exists to reach any player's
// profile, so it must not default to the online roster the way the shared
// playerSearchOnlineOnly preference does.
const onlineOnly = ref(false);
// Shared with the other player searches so the preference does not reset when
// you switch surfaces.
const searchStore = useSearchStore();
const registeredOnly = computed({
  get: () => searchStore.registeredOnly,
  set: (value: boolean) => {
    localStorage.setItem("playerSearchRegisteredOnly", String(value));
    searchStore.registeredOnly = value;
  },
});
const filtering = computed(() => onlineOnly.value || registeredOnly.value);

const players = ref<any[]>([]);
const loading = ref(false);
const searchToken = ref(0);

const debouncedSearch = debounce(async (searchQuery: string) => {
  // A slower earlier keystroke must not clobber a newer result set.
  const token = ++searchToken.value;

  if (!searchQuery.trim()) {
    players.value = [];
    loading.value = false;
    return;
  }

  // The online roster is already in memory, so this path needs no request.
  if (onlineOnly.value) {
    players.value = searchStore.search(searchQuery, []);
    loading.value = false;
    return;
  }

  loading.value = true;

  try {
    const response = await $fetch("/api/players-search", {
      method: "post",
      body: {
        query: searchQuery,
        per_page: 10,
        registeredOnly: registeredOnly.value,
      },
    });

    if (token !== searchToken.value) {
      return;
    }

    players.value = (response.hits || []).map(({ document }: any) => ({
      steam_id: document.steam_id,
      name: document.name,
      role: document.role,
      country: document.country,
      avatar_url: document.avatar_url,
      custom_avatar_url: document.custom_avatar_url,
      roster_image_url: document.roster_image_url,
      profile_url: document.profile_url,
      is_banned: document.is_banned,
      is_muted: document.is_muted,
      is_gagged: document.is_gagged,
      // Whether they have ever signed in here, as opposed to a Steam account we
      // only know about. Every player stays searchable either way.
      is_registered: document.is_registered,
      elo: {
        competitive: document.elo_competitive,
        wingman: document.elo_wingman,
        duel: document.elo_duel,
        rush: document.elo_rush,
      },
    }));
  } catch (error) {
    if (token !== searchToken.value) {
      return;
    }
    console.error("Error searching players:", error);
    players.value = [];
  } finally {
    if (token === searchToken.value) {
      loading.value = false;
    }
  }
}, 300);

const playerOptions = computed<Option[]>(() =>
  players.value.map((player, index) => ({
    id: `player-${player.steam_id}`,
    index: localOptions.value.length + index,
    to: `/players/${player.steam_id}`,
    label: player.name,
    player,
  })),
);

// Players come last: they arrive after the rest, so nothing above the
// highlighted row moves when they do.
const options = computed<Option[]>(() => [
  ...localOptions.value,
  ...playerOptions.value,
]);

const showPlayers = computed(
  () =>
    searching.value &&
    (loading.value || players.value.length > 0 || filtering.value),
);

watch(query, (value) => {
  active.value = 0;
  debouncedSearch(value);
});

watch([registeredOnly, onlineOnly], () => {
  debouncedSearch(query.value);
});

function optionId(index: number) {
  return `global-search-option-${index}`;
}

function href(to: RouteLocationRaw) {
  return router.resolve(to).href;
}

function choose(option: Option | undefined) {
  if (!option) {
    return;
  }
  if (option.setting) {
    selectSetting(option.setting.hit);
  }
  open.value = false;
  navigateTo(option.to);
}

function move(step: number) {
  const last = options.value.length - 1;
  if (last < 0) {
    return;
  }
  active.value = Math.min(Math.max(active.value + step, 0), last);
  nextTick(() =>
    document
      .getElementById(optionId(active.value))
      ?.scrollIntoView({ block: "nearest" }),
  );
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    move(event.key === "ArrowDown" ? 1 : -1);
  } else if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    choose(options.value[active.value]);
  } else if (event.key === "Escape") {
    event.preventDefault();
    open.value = false;
  }
}

// A chip click takes focus; typing and the arrow keys belong to the input.
function refocus() {
  input.value?.focus();
}

function onGlobalKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    open.value = !open.value;
  }
}

onMounted(() => window.addEventListener("keydown", onGlobalKeydown));
onUnmounted(() => window.removeEventListener("keydown", onGlobalKeydown));

let returnFocus: HTMLElement | null = null;
watch(open, (isOpen) => {
  if (isOpen) {
    returnFocus = document.activeElement as HTMLElement | null;
    nextTick(() => input.value?.focus());
    return;
  }
  query.value = "";
  players.value = [];
  active.value = 0;
  if (returnFocus?.isConnected) {
    returnFocus.focus({ preventScroll: true });
  }
  returnFocus = null;
});

watch(
  () => route.fullPath,
  () => (open.value = false),
);
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-200 ease-out"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity duration-150 ease-in"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-md"
      @click.self="open = false"
    >
      <Transition
        appear
        enter-active-class="transition-[opacity,transform] duration-200 ease-out"
        enter-from-class="opacity-0 scale-[0.98] -translate-y-1"
      >
        <div
          role="dialog"
          aria-modal="true"
          :aria-label="$t('layouts.app_nav.navigation.search')"
          class="flex max-h-[min(36rem,80vh)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border/50 bg-background shadow-2xl"
          @keydown="onKeydown"
        >
          <div
            class="flex shrink-0 items-center gap-3 border-b border-border/50 px-4"
          >
            <Search class="size-5 shrink-0 text-muted-foreground" />
            <input
              ref="input"
              v-model="query"
              role="combobox"
              aria-autocomplete="list"
              aria-controls="global-search-results"
              :aria-expanded="searching"
              :aria-activedescendant="
                options.length ? optionId(active) : undefined
              "
              :placeholder="$t('global_search.placeholder')"
              autocomplete="off"
              spellcheck="false"
              class="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div
            v-if="searching"
            id="global-search-results"
            role="listbox"
            class="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2"
          >
            <div
              v-for="group in groups"
              :key="group.id"
              role="group"
              :aria-labelledby="`global-search-group-${group.id}`"
            >
              <div
                :id="`global-search-group-${group.id}`"
                class="px-4 pb-1 pt-2 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground"
              >
                {{ group.label }}
              </div>
              <a
                v-for="option in group.options"
                :id="optionId(option.index)"
                :key="option.id"
                role="option"
                tabindex="-1"
                :href="href(option.to)"
                :aria-selected="option.index === active"
                class="flex items-center gap-3 px-4 py-2 text-sm text-foreground no-underline"
                :class="{ 'bg-accent': option.index === active }"
                @mousemove="active = option.index"
                @click.exact.prevent="choose(option)"
              >
                <component
                  :is="option.icon"
                  v-bind="option.iconProps"
                  class="size-4 shrink-0 text-muted-foreground"
                />
                <span class="min-w-0 flex-1">
                  <span class="block truncate">{{ option.label }}</span>
                  <span
                    v-if="option.description"
                    class="block truncate text-xs text-muted-foreground"
                  >
                    {{ option.description }}
                  </span>
                </span>
                <span
                  v-if="option.aside"
                  class="max-w-[40%] shrink-0 truncate text-xs text-muted-foreground"
                >
                  {{ option.aside }}
                </span>
              </a>
            </div>

            <div
              v-if="showPlayers"
              role="group"
              aria-labelledby="global-search-group-players"
            >
              <div class="flex items-center gap-2 px-4 pb-1 pt-2">
                <span
                  id="global-search-group-players"
                  class="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground"
                >
                  {{ $t("global_search.players") }}
                </span>
                <Loader2
                  v-if="loading"
                  class="size-3 animate-spin text-muted-foreground"
                />
                <div class="ml-auto flex items-center gap-1.5">
                  <FilterChip
                    :active="onlineOnly"
                    :label="$t('common.online')"
                    @toggle="
                      onlineOnly = !onlineOnly;
                      refocus();
                    "
                  />
                  <FilterChip
                    :active="registeredOnly"
                    :label="$t('search.registered')"
                    @toggle="
                      registeredOnly = !registeredOnly;
                      refocus();
                    "
                  />
                </div>
              </div>
              <a
                v-for="option in playerOptions"
                :id="optionId(option.index)"
                :key="option.id"
                role="option"
                tabindex="-1"
                :href="href(option.to)"
                :aria-selected="option.index === active"
                class="flex items-center gap-3 px-4 py-2 text-foreground no-underline"
                :class="{ 'bg-accent': option.index === active }"
                @mousemove="active = option.index"
                @click.exact.prevent="choose(option)"
              >
                <PlayerDisplay :player="option.player" />
                <!-- A Steam account we know of but who has never signed in
                     here. Still searchable -- this only sets expectations about
                     what their profile will have on it. -->
                <span
                  v-if="option.player.is_registered === false"
                  class="ml-auto shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted-foreground"
                >
                  {{ $t("search.unregistered") }}
                </span>
              </a>
              <p
                v-if="!playerOptions.length"
                class="px-4 py-2 text-sm text-muted-foreground"
              >
                {{
                  loading
                    ? $t("global_search.searching")
                    : $t("global_search.no_players_found")
                }}
              </p>
            </div>

            <p
              v-if="!groups.length && !showPlayers"
              class="px-4 py-8 text-center text-sm text-muted-foreground"
            >
              {{ $t("global_search.no_results") }}
            </p>
          </div>

          <div
            class="hidden shrink-0 items-center gap-4 border-t border-border/50 px-4 py-2 text-xs text-muted-foreground sm:flex"
          >
            <span class="inline-flex items-center gap-1.5">
              <Kbd>↑</Kbd><Kbd>↓</Kbd>
              {{ $t("global_search.hints.navigate") }}
            </span>
            <span class="inline-flex items-center gap-1.5">
              <Kbd>↵</Kbd>
              {{ $t("global_search.hints.open") }}
            </span>
            <span class="inline-flex items-center gap-1.5">
              <Kbd>esc</Kbd>
              {{ $t("global_search.hints.close") }}
            </span>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
