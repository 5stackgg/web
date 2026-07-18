import { defineStore, acceptHMRUpdate } from "pinia";
import { ref, computed } from "vue";
import { order_by } from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";
import { useSubscriptionManager } from "~/composables/useSubscriptionManager";
import { useAuthStore } from "./AuthStore";
import { useApplicationSettingsStore } from "./ApplicationSettings";

export interface CustomPage {
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
}

export const useCustomPagesStore = defineStore("customPages", () => {
  const pages = ref<CustomPage[]>([]);
  // True once the subscription has delivered its first payload — lets the
  // loader page tell "registry still loading" apart from "slug not found".
  const initialized = ref(false);

  const subscribeToCustomPages = async () => {
    const { subscribe } = useSubscriptionManager();
    const subscription = getGraphqlClient().subscribe({
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
          },
        ],
      }),
    });

    subscribe(
      "customPages:custom_pages",
      subscription.subscribe({
        next: ({ data }) => {
          pages.value = data.custom_pages;
          initialized.value = true;
        },
      }),
    );
  };

  subscribeToCustomPages();

  const canSee = (page: CustomPage): boolean => {
    if (!page.enabled) {
      return false;
    }
    // A null required_role is public — visible to guests too. Otherwise the
    // viewer must meet the role floor.
    if (!page.required_role) {
      return true;
    }
    return useAuthStore().isRoleAbove(page.required_role);
  };

  const visiblePages = computed<CustomPage[]>(() => {
    if (!useApplicationSettingsStore().customPagesEnabled) {
      return [];
    }
    return pages.value.filter(canSee);
  });

  const defaultPage = computed<CustomPage | null>(() => {
    return visiblePages.value.find((page) => page.is_default) ?? null;
  });

  const pageBySlug = (slug: string): CustomPage | null => {
    return pages.value.find((page) => page.slug === slug) ?? null;
  };

  return {
    pages,
    initialized,
    visiblePages,
    defaultPage,
    pageBySlug,
    canSee,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCustomPagesStore, import.meta.hot));
}
