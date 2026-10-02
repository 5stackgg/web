<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { ChevronLeft } from "lucide-vue-next";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import QuickServerConnect from "~/components/match/QuickServerConnect.vue";
import ServerCommunityOverview, {
  type ServerLiveInfo,
} from "~/components/servers/ServerCommunityOverview.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { PUBLIC_SERVER_SUBSCRIPTION } from "~/graphql/communityGraphql";
import cleanMapName from "~/utilities/cleanMapName";

type PublicServer = {
  id: string;
  label: string;
  type: string;
  game: string;
  region: string;
  connected: boolean;
  connection_link: string | null;
  connection_string: string | null;
  max_players: number | null;
  game_mode: { slug: string; name: string } | null;
};

const props = defineProps<{ serverId: string }>();

const { t } = useI18n();

const server = ref<PublicServer | null>(null);
const serverLoaded = ref(false);
const info = ref<ServerLiveInfo | null>(null);
let serverSub: { unsubscribe: () => void } | null = null;

const heroClasses =
  "relative flex min-w-0 max-w-full flex-wrap items-end gap-x-6 gap-y-4 border border-border px-6 pb-6 pt-5 max-sm:p-4 [background:linear-gradient(180deg,hsl(var(--card)/0.2)_0%,hsl(var(--card)/0.04)_100%)]";

const statusBaseClasses =
  "inline-flex items-center gap-2 px-[0.7rem] py-[0.3rem] font-mono text-[0.68rem] font-bold tracking-[0.2em] uppercase border rounded";

const chipClasses =
  "inline-flex items-center px-[0.7rem] py-[0.25rem] font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] leading-none rounded border border-border/70 bg-muted/35 text-muted-foreground";

const titleClasses =
  "relative m-0 font-sans font-bold [font-stretch:80%] text-[clamp(1.6rem,4vw,2.6rem)] leading-[0.95] tracking-[0.02em] uppercase break-words bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent";

const onlineNow = computed(() => info.value?.players ?? 0);

const mapName = computed(() =>
  info.value?.map ? cleanMapName(info.value.map) : null,
);

function subscribe() {
  serverSub?.unsubscribe();
  serverLoaded.value = false;
  server.value = null;

  serverSub = getGraphqlClient()
    .subscribe({
      query: PUBLIC_SERVER_SUBSCRIPTION,
      variables: { serverId: props.serverId },
    })
    .subscribe({
      next: ({ data }: any) => {
        server.value = data?.servers_by_pk ?? null;
        serverLoaded.value = true;
      },
      error: () => {
        serverLoaded.value = true;
      },
    });
}

watch(
  () => props.serverId,
  () => {
    info.value = null;
    subscribe();
  },
);

useHead(() => ({
  title: server.value?.label ?? t("pages.public_servers.title"),
}));

onMounted(subscribe);

onBeforeUnmount(() => {
  serverSub?.unsubscribe();
});
</script>

<template>
  <div class="flex flex-col gap-5">
    <PageTransition :delay="0">
      <nav
        class="flex items-center gap-2 font-mono text-xs text-muted-foreground"
        :aria-label="$t('community.server_page.breadcrumb')"
      >
        <NuxtLink
          :to="{ name: 'public-servers' }"
          class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <ChevronLeft class="h-3.5 w-3.5" />
          {{ $t("pages.public_servers.title") }}
        </NuxtLink>
        <template v-if="server">
          <span aria-hidden="true">/</span>
          <span class="truncate text-foreground">{{ server.label }}</span>
        </template>
      </nav>
    </PageTransition>

    <FadeSwap>
      <div v-if="!serverLoaded" key="loading" class="flex flex-col gap-5">
        <Skeleton class="h-36 w-full" />
        <div class="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <Skeleton v-for="i in 4" :key="i" class="h-[5.5rem] w-full" />
        </div>
      </div>

      <Empty v-else-if="!server" key="missing" class="min-h-[240px]">
        <EmptyTitle>{{
          $t("community.server_page.not_found_title")
        }}</EmptyTitle>
        <EmptyDescription>
          {{ $t("community.server_page.not_found_description") }}
        </EmptyDescription>
      </Empty>

      <div v-else key="server" class="flex flex-col gap-5">
        <header :class="heroClasses">
          <div class="min-w-0 flex-[1_1_20rem]">
            <div class="mb-4 flex flex-wrap items-center gap-2.5">
              <span
                :class="[
                  statusBaseClasses,
                  server.connected
                    ? 'border-[hsl(var(--success)/0.5)] bg-[hsl(var(--success)/0.15)] text-success'
                    : 'border-[hsl(var(--destructive)/0.6)] bg-[hsl(var(--destructive)/0.15)] text-destructive',
                ]"
                data-testid="server-status"
              >
                <span class="h-2 w-2 rounded-full bg-current" />
                <template v-if="server.connected">
                  {{ $t("community.server_page.online") }}
                  <template v-if="server.max_players">
                    · {{ onlineNow }}/{{ server.max_players }}
                  </template>
                </template>
                <template v-else>
                  {{ $t("community.server_page.offline") }}
                </template>
              </span>
              <span v-if="server.region" :class="chipClasses">
                {{ server.region }}
              </span>
              <span v-if="server.type" :class="chipClasses">
                {{ server.type }}
              </span>
              <span v-if="server.game_mode" :class="chipClasses">
                {{ server.game_mode.name }}
              </span>
            </div>
            <h1 :class="titleClasses">{{ server.label }}</h1>
            <div
              class="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-xs text-muted-foreground"
            >
              <span v-if="mapName">
                {{ $t("community.server_page.map") }}
                <b class="font-medium text-foreground">{{ mapName }}</b>
              </span>
              <span>{{ $t("community.server_page.community_server") }}</span>
            </div>
          </div>
          <QuickServerConnect :server="server" highlight />
        </header>

        <ServerCommunityOverview
          :server-id="server.id"
          :label="server.label"
          :max-players="server.max_players"
          @info="info = $event"
        />
      </div>
    </FadeSwap>
  </div>
</template>
