import { defineStore, acceptHMRUpdate } from "pinia";
import { ref, computed } from "vue";
import { order_by } from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";
import { useSubscriptionManager } from "~/composables/useSubscriptionManager";
import { seededSubscribe } from "~/utilities/seededSubscribe";
import { useAuthStore } from "./AuthStore";
import { useApplicationSettingsStore } from "./ApplicationSettings";

export interface Plugin {
  id: string;
  slug: string;
  title: string;
  icon: string | null;
  remote_entry_url: string;
  remote_scope: string;
  exposed_module: string;
  required_role: string | null;
  enabled: boolean;
  is_default: boolean;
  nav_group: string | null;
  nav_order: number;
  // Null means the plugin contributes no player-profile tab. A non-null value is
  // the tab's label — the opt-in and the wording are the same field.
  profile_tab_label: string | null;
}

const PLUGINS_CACHE_KEY = "5stack:plugins";

const loadCachedPlugins = (): Plugin[] => {
  try {
    const cached = localStorage.getItem(PLUGINS_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {}
  return [];
};

export const usePluginsStore = defineStore("plugins", () => {
  // Painted from the last delivery so nav links are in place on first paint
  // instead of shifting the bar when the subscription lands.
  const plugins = ref<Plugin[]>(loadCachedPlugins());
  // True once the subscription has delivered its first payload — lets the
  // loader page tell "registry still loading" apart from "slug not found".
  const initialized = ref(false);

  const subscribeToPlugins = async () => {
    const { subscribe } = useSubscriptionManager();

    subscribe(
      "plugins:custom_pages",
      seededSubscribe(
        getGraphqlClient(),
        {
          query: generateSubscription({
            custom_pages: [
              {
                order_by: [{ nav_order: order_by.asc }],
              },
              {
                id: true,
                slug: true,
                title: true,
                icon: true,
                remote_entry_url: true,
                remote_scope: true,
                exposed_module: true,
                required_role: true,
                enabled: true,
                is_default: true,
                nav_group: true,
                nav_order: true,
                profile_tab_label: true,
              },
            ],
          }),
        },
        {
          next: ({ data }) => {
            plugins.value = data.custom_pages;
            initialized.value = true;
            try {
              localStorage.setItem(
                PLUGINS_CACHE_KEY,
                JSON.stringify(data.custom_pages),
              );
            } catch {}
          },
        },
      ),
    );
  };

  subscribeToPlugins();

  const canSee = (plugin: Plugin): boolean => {
    if (!useApplicationSettingsStore().pluginsEnabled) {
      return false;
    }
    if (!plugin.enabled) {
      return false;
    }
    // A null required_role is public — visible to guests too. Otherwise the
    // viewer must meet the role floor.
    if (!plugin.required_role) {
      return true;
    }
    return useAuthStore().isRoleAbove(plugin.required_role);
  };

  const visiblePlugins = computed<Plugin[]>(() => {
    return plugins.value.filter(canSee);
  });

  // Plugins that contribute a tab to /players/:steamid. Filtered from
  // visiblePlugins so the master switch, `enabled`, and `required_role` all
  // apply — a tab must never be a way around the gating the nav respects.
  const profileTabPlugins = computed<Plugin[]>(() => {
    return visiblePlugins.value.filter((plugin) => plugin.profile_tab_label);
  });

  const defaultPlugin = computed<Plugin | null>(() => {
    return visiblePlugins.value.find((plugin) => plugin.is_default) ?? null;
  });

  // The master switch must also cover direct /apps/<slug> loads (not just the
  // nav), so a disabled feature resolves as not-found rather than executing
  // plugin code for bookmarked users.
  const pluginBySlug = (slug: string): Plugin | null => {
    if (!useApplicationSettingsStore().pluginsEnabled) {
      return null;
    }
    return plugins.value.find((plugin) => plugin.slug === slug) ?? null;
  };

  return {
    plugins,
    initialized,
    visiblePlugins,
    profileTabPlugins,
    defaultPlugin,
    pluginBySlug,
    canSee,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(usePluginsStore, import.meta.hot));
}
