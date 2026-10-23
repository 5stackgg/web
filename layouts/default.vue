<script setup lang="ts">
import { isAdminRouteName } from "~/composables/useNavMode";
import TopoBackground from "@/layouts/components/TopoBackground.vue";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  computed,
  defineAsyncComponent,
  onBeforeUnmount,
  provide,
  ref,
  watch,
} from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "~/stores/AuthStore";
import { useGtm } from "@/layouts/composables/useGtm";
import { useChatTabSetup } from "~/composables/useChatTabSetup";
import { useChatPresence } from "~/composables/useChatPresence";
import { useChatBlocks } from "~/composables/useChatBlocks";

const AppSidebar = defineAsyncComponent(
  () => import("@/components/AppSidebar.vue"),
);
const MainContent = defineAsyncComponent(
  () => import("@/layouts/components/MainContent.vue"),
);
const AppHeader = defineAsyncComponent(
  () => import("@/layouts/components/AppHeader.vue"),
);
const ApplicationSettingsShell = defineAsyncComponent(
  () => import("@/components/settings/ApplicationSettingsShell.vue"),
);
const ProfileSettingsShell = defineAsyncComponent(
  () => import("@/components/settings/ProfileSettingsShell.vue"),
);
const ClipDetailModal = defineAsyncComponent(
  () => import("~/components/clips/ClipDetailModal.vue"),
);
const GlobalSearch = defineAsyncComponent(
  () => import("~/components/GlobalSearch.vue"),
);
const ActionToasts = defineAsyncComponent(
  () => import("~/components/notification/ActionToasts.vue"),
);
// Owns the voice connection for the whole app session. Mounted here rather than
// in the hub because the hub is role-gated, and the call is not.
const VoiceHost = defineAsyncComponent(
  () => import("~/components/voice/VoiceHost.vue"),
);
const OrphanedUploadsDialog = defineAsyncComponent(
  () => import("~/components/settings/OrphanedUploadsDialog.vue"),
);
const EnablePushPrompt = defineAsyncComponent(
  () => import("~/components/notification/EnablePushPrompt.vue"),
);
const FaqDialog = defineAsyncComponent(
  () => import("~/components/faq/FaqDialog.vue"),
);
import { useClipModal } from "~/composables/useClipModal";
import { useOrphanedScan } from "~/composables/useOrphanedScan";
import { useFaqDialog } from "~/composables/useFaq";

const { activeClipId } = useClipModal();
const { dialogOpen: orphanedUploadsOpen } = useOrphanedScan();

// Both render nothing until opened, so neither is downloaded until then. Once
// opened each stays mounted, so closing still plays its exit transition.
const clipModalMounted = ref(!!activeClipId.value);
watch(activeClipId, (id) => {
  if (id) {
    clipModalMounted.value = true;
  }
});
const orphanedUploadsMounted = ref(orphanedUploadsOpen.value);
watch(orphanedUploadsOpen, (open) => {
  if (open) {
    orphanedUploadsMounted.value = true;
  }
});
const { anchor: faqAnchor } = useFaqDialog();
const faqDialogMounted = ref(!!faqAnchor.value);
watch(faqAnchor, (anchor) => {
  if (anchor) {
    faqDialogMounted.value = true;
  }
});

useGtm();
useChatTabSetup();
useChatTabPersistence();
useIncomingDirectMessages();
useChatPresence();
useChatBlocks();

const route = useRoute();
const authStore = useAuthStore();

// AppHeader loads MatchLobbies lazily, and the root Suspense holds the
// pre-loader until it arrives. Asking for it here, while AppHeader's own chunk
// is still on its way, keeps a signed-in boot from paying for the two one after
// the other.
if (authStore.me) {
  void import("~/layouts/components/MatchLobbies.vue");
}

// The route on screen, not the one being navigated to: a page leaving keeps
// its own width while it fades, instead of being laid out again at the next
// page's (a draft room leaving for the full-width match page ballooned).
// Nuxt calls page:finish as the old page starts to leave, and
// page:transition:finish once it has gone (before the new one enters), so
// the width follows on the second, or on the first when nothing animates.
const nuxtApp = useNuxtApp();
const shownRouteName = ref(route.name);
const showRoute = () => {
  shownRouteName.value = route.name;
};
const unhooks = [
  nuxtApp.hook("page:transition:finish", showRoute),
  nuxtApp.hook("page:finish", () => {
    if (!(nuxtApp as { _runningTransition?: boolean })._runningTransition) {
      showRoute();
    }
  }),
];
onBeforeUnmount(() => unhooks.forEach((unhook) => unhook()));

// Admin pages sit left-aligned against the nav, the way application settings
// always have, capped so tables don't stretch across a wide monitor. Only
// public pages centre in a column.
// Game Server Nodes and GPU Nodes cap themselves: their panels dock in the
// room past the cap. System Logs runs full width so long lines don't wrap.
const adminContent = computed(
  () =>
    isAdminRouteName(shownRouteName.value) &&
    !["game-server-nodes", "gpu-nodes", "system-logs"].includes(
      String(shownRouteName.value),
    ),
);

const containContent = computed(() => {
  const name = shownRouteName.value;
  if (isAdminRouteName(name)) {
    return false;
  }

  switch (name) {
    case "apps-slug":
    case "news-manage-id":
    case "matches-id":
    // Caps itself, and widens into the gutter for the player panel.
    case "leaderboard":
    // Board on one side, list on the other: pinned to 7xl the tab strip wrapped
    // and the map lost the width it needs to stay square and readable. The maps
    // index shares the map page's shell and has to be given the same room, or
    // the rail the two share sits in a different place on each.
    case "utility":
    case "utility-map":
    case "map-pools":
      return false;
    default:
      return true;
  }
});

// The settings shells follow the page on screen, like the width: switching
// them the moment navigation starts drew the App Settings shell in the
// leaving page's centred column, then snapped it left once the width caught up.
const isApplicationSettings = computed(() =>
  String(shownRouteName.value ?? "").startsWith("settings-application"),
);
const isProfileSettings = computed(
  () =>
    String(shownRouteName.value ?? "").startsWith("settings") &&
    !isApplicationSettings.value,
);

// Provide values to MainContent
provide("containContent", containContent);
provide("adminContent", adminContent);
</script>

<template>
  <TopoBackground />

  <SidebarProvider class="relative z-10 !bg-transparent">
    <AppSidebar />

    <SidebarInset
      class="flex flex-col overflow-y-auto overflow-x-hidden !bg-transparent"
      style="height: 100svh"
    >
      <AppHeader class="pl-2 pr-6" />

      <MainContent class="flex-1">
        <ApplicationSettingsShell v-if="isApplicationSettings">
          <slot></slot>
        </ApplicationSettingsShell>
        <ProfileSettingsShell v-else-if="isProfileSettings">
          <slot></slot>
        </ProfileSettingsShell>
        <slot v-else></slot>
      </MainContent>
    </SidebarInset>
  </SidebarProvider>

  <VoiceHost v-if="authStore.me" />

  <GlobalSearch v-if="authStore.me" />

  <div id="global-chat-container"></div>

  <ClipDetailModal v-if="clipModalMounted" :clip-id="activeClipId" />

  <OrphanedUploadsDialog v-if="orphanedUploadsMounted" />

  <FaqDialog v-if="faqDialogMounted" />

  <EnablePushPrompt v-if="authStore.me" />

  <ActionToasts v-if="authStore.me" />
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  watch: {
    steamIdWithoutCountry: {
      immediate: true,
      async handler(steamId?: string) {
        if (!steamId) {
          return;
        }

        const { getCountryForTimezone } =
          await import("countries-and-timezones");
        const country = getCountryForTimezone(
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        );

        if (!country) {
          return;
        }

        await this.$apollo.mutate({
          mutation: generateMutation({
            update_players_by_pk: [
              {
                pk_columns: {
                  steam_id: steamId,
                },
                _set: {
                  country: country.id,
                },
              },
              {
                __typename: true,
              },
            ],
          }),
        });
      },
    },
  },

  computed: {
    steamIdWithoutCountry() {
      const me = useAuthStore().me;
      if (!me || me.country) {
        return;
      }
      return me.steam_id;
    },
  },
};
</script>
