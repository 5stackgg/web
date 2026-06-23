<script lang="ts">
import { defineComponent } from "vue";
import { Swords, Server, HardDrive } from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import TeamRankSummary from "~/components/team/TeamRankSummary.vue";
import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";

const MATCH_TYPES = ["MatchStatusChange", "MatchSupport"];
const SERVER_TYPES = ["DedicatedServerStatus", "DedicatedServerRconStatus"];
const NODE_TYPES = ["GameNodeStatus"];
const PLAYER_TYPES = ["PlayerSanctioned"];
const SCRIM_TYPES = [
  "ScrimRequestReceived",
  "ScrimRequestCountered",
  "ScrimRequestAccepted",
  "ScrimRequestDeclined",
  "ScrimRequestExpired",
  "ScrimMatchScheduled",
  "ScrimMatchCanceled",
  "ScrimTimeChanged",
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MATCH_STATUS_TONE: Record<string, string> = {
  Live: "bg-red-500/20 text-red-300 border-red-500/30",
  Finished: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  Canceled: "bg-muted text-muted-foreground border-border",
  Forfeit: "bg-muted text-muted-foreground border-border",
  Surrendered: "bg-muted text-muted-foreground border-border",
  Tie: "bg-muted text-muted-foreground border-border",
  MapPaused: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

const NODE_STATUS_TONE: Record<string, string> = {
  Online: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  Offline: "bg-red-500/20 text-red-300 border-red-500/30",
  Setup: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

export default defineComponent({
  components: {
    Swords,
    Server,
    HardDrive,
    Spinner,
    PlayerDisplay,
    Avatar,
    AvatarImage,
    AvatarFallback,
    TeamRankSummary,
  },
  props: {
    type: { type: String, required: true },
    entityId: { type: String, required: true },
  },
  data() {
    return {
      match: null as any,
      server: null as any,
      node: null as any,
      player: null as any,
      scrim: null as any,
      matchLoaded: false,
      serverLoaded: false,
      nodeLoaded: false,
      playerLoaded: false,
      scrimLoaded: false,
    };
  },
  computed: {
    loading() {
      if (!this.kind || !this.hasValidEntity) return false;
      if (this.kind === "match") return !this.matchLoaded;
      if (this.kind === "server") return !this.serverLoaded;
      if (this.kind === "node") return !this.nodeLoaded;
      if (this.kind === "player") return !this.playerLoaded;
      if (this.kind === "scrim") return !this.scrimLoaded;
      return false;
    },
    apiDomain() {
      return useRuntimeConfig().public.apiDomain;
    },
    scrimLink() {
      if (!this.scrim) return null;
      // A scheduled (Matched) scrim points at the hosted match; anything still
      // pending points at the team's requests tab.
      if (this.scrim.status === "Matched" && this.scrim.match_id) {
        return `/matches/${this.scrim.match_id}`;
      }
      if (!this.scrim.awaiting_team_id) return null;
      return `/teams/${this.scrim.awaiting_team_id}?tab=scrim&scrimTab=requests`;
    },
    scrimScheduled() {
      return this.scrim?.status === "Matched";
    },
    hasValidEntity() {
      // match/server are keyed by uuid; node ids are plain strings. Sentinel
      // entity_ids (e.g. "plugin_version") must not trigger a *_by_pk lookup.
      if (this.kind === "node") return !!this.entityId;
      if (this.kind === "player") return /^\d+$/.test(this.entityId ?? "");
      return UUID_RE.test(this.entityId ?? "");
    },
    kind() {
      if (MATCH_TYPES.includes(this.type)) return "match";
      if (SERVER_TYPES.includes(this.type)) return "server";
      if (NODE_TYPES.includes(this.type)) return "node";
      if (PLAYER_TYPES.includes(this.type)) return "player";
      if (SCRIM_TYPES.includes(this.type)) return "scrim";
      return null;
    },
    iconComponent() {
      if (this.kind === "match") return "Swords";
      if (this.kind === "server") return "Server";
      if (this.kind === "node") return "HardDrive";
      return null;
    },
    primaryText() {
      if (this.kind === "match" && this.match) {
        const a = this.match.lineup_1?.name?.trim();
        const b = this.match.lineup_2?.name?.trim();
        if (a && b) return `${a} vs ${b}`;
        return a || b || "Match";
      }
      if (this.kind === "server" && this.server) {
        return this.server.label || this.server.host || "Server";
      }
      if (this.kind === "node" && this.node) {
        return this.node.label || this.node.id || "Node";
      }
      return null;
    },
    status() {
      if (this.kind === "match" && this.match) return this.match.status;
      if (this.kind === "server" && this.server) {
        if (this.server.connected === true)
          return this.$t("notification_context.online");
        if (this.server.connected === false)
          return this.$t("notification_context.offline");
        return null;
      }
      if (this.kind === "node" && this.node) return this.node.status ?? null;
      return null;
    },
    statusClass() {
      if (this.kind === "match" && this.status) {
        return (
          MATCH_STATUS_TONE[this.status] ||
          "bg-muted text-muted-foreground border-border"
        );
      }
      if (this.kind === "server" && this.status) {
        return this.status === "ONLINE"
          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
          : "bg-red-500/20 text-red-300 border-red-500/30";
      }
      if (this.kind === "node" && this.status) {
        return (
          NODE_STATUS_TONE[this.status] ||
          "bg-muted text-muted-foreground border-border"
        );
      }
      return "bg-muted text-muted-foreground border-border";
    },
  },
  apollo: {
    $subscribe: {
      match: {
        skip: function (this: any) {
          return this.kind !== "match" || !this.hasValidEntity;
        },
        query: typedGql("subscription")({
          matches_by_pk: [
            { id: $("id", "uuid!") },
            {
              id: true,
              status: true,
              lineup_1: { name: true },
              lineup_2: { name: true },
            },
          ],
        }),
        variables: function (this: any) {
          return { id: this.entityId };
        },
        result: function (this: any, { data }: any) {
          this.match = data?.matches_by_pk ?? null;
          this.matchLoaded = true;
        },
      },
      server: {
        skip: function (this: any) {
          return this.kind !== "server" || !this.hasValidEntity;
        },
        query: typedGql("subscription")({
          servers_by_pk: [
            { id: $("id", "uuid!") },
            {
              id: true,
              label: true,
              host: true,
              connected: true,
            },
          ],
        }),
        variables: function (this: any) {
          return { id: this.entityId };
        },
        result: function (this: any, { data }: any) {
          this.server = data?.servers_by_pk ?? null;
          this.serverLoaded = true;
        },
      },
      node: {
        skip: function (this: any) {
          return this.kind !== "node" || !this.entityId;
        },
        query: typedGql("subscription")({
          game_server_nodes_by_pk: [
            { id: $("id", "String!") },
            {
              id: true,
              label: true,
              status: true,
            },
          ],
        }),
        variables: function (this: any) {
          return { id: this.entityId };
        },
        result: function (this: any, { data }: any) {
          this.node = data?.game_server_nodes_by_pk ?? null;
          this.nodeLoaded = true;
        },
      },
      player: {
        skip: function (this: any) {
          return this.kind !== "player" || !this.hasValidEntity;
        },
        query: typedGql("subscription")({
          players_by_pk: [
            { steam_id: $("steam_id", "bigint!") },
            {
              steam_id: true,
              name: true,
              avatar_url: true,
              custom_avatar_url: true,
              country: true,
              role: true,
            },
          ],
        }),
        variables: function (this: any) {
          return { steam_id: this.entityId };
        },
        result: function (this: any, { data }: any) {
          this.player = data?.players_by_pk ?? null;
          this.playerLoaded = true;
        },
      },
    },
    // A plain cache-first query (not a live subscription) so reopening the
    // notifications panel reads from cache instantly instead of re-loading.
    scrim: {
      skip: function (this: any) {
        return this.kind !== "scrim" || !this.hasValidEntity;
      },
      fetchPolicy: "cache-first",
      query: typedGql("query")({
        team_scrim_requests_by_pk: [
          { id: $("id", "uuid!") },
          {
            id: true,
            status: true,
            awaiting_team_id: true,
            match_id: true,
            proposed_scheduled_at: true,
            expires_at: true,
            match_options: { best_of: true },
            from_team: {
              id: true,
              name: true,
              avatar_url: true,
              ranks: {
                avg_elo: true,
                avg_faceit_level: true,
                avg_faceit_elo: true,
                avg_premier: true,
                roster_size: true,
              },
              reputation: {
                scrims_completed: true,
                no_shows: true,
                reliability_pct: true,
              },
            },
            to_team: {
              id: true,
              name: true,
              avatar_url: true,
              ranks: {
                avg_elo: true,
                avg_faceit_level: true,
                avg_faceit_elo: true,
                avg_premier: true,
                roster_size: true,
              },
              reputation: {
                scrims_completed: true,
                no_shows: true,
                reliability_pct: true,
              },
            },
          },
        ],
      }),
      variables: function (this: any) {
        return { id: this.entityId };
      },
      update: (data: any) => data?.team_scrim_requests_by_pk ?? null,
      result: function (this: any) {
        this.scrimLoaded = true;
      },
    },
  },
  methods: {
    teamAvatar(team: any): string | null {
      return team?.avatar_url
        ? `https://${this.apiDomain}/${team.avatar_url}`
        : null;
    },
    scrimTime(): string {
      if (!this.scrim?.proposed_scheduled_at) return "";
      return new Date(this.scrim.proposed_scheduled_at).toLocaleString(
        undefined,
        {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        },
      );
    },
    // Only meaningful while the request is still awaiting a response.
    expiresLabel(): string {
      if (
        !this.scrim?.expires_at ||
        !["Pending", "Countered"].includes(this.scrim?.status)
      ) {
        return "";
      }
      const ms = new Date(this.scrim.expires_at).getTime() - Date.now();
      if (ms <= 0) {
        return "Expired";
      }
      const hours = Math.floor(ms / 3600000);
      const minutes = Math.floor((ms % 3600000) / 60000);
      if (hours >= 24) {
        return `Expires in ${Math.floor(hours / 24)}d`;
      }
      if (hours >= 1) {
        return `Expires in ${hours}h`;
      }
      return `Expires in ${Math.max(1, minutes)}m`;
    },
  },
});
</script>

<template>
  <div
    v-if="loading"
    class="flex items-center gap-2 text-xs px-2 py-1 rounded border border-border bg-background/40 text-muted-foreground"
  >
    <Spinner class="h-3 w-3" />
    <span class="italic">{{ $t("notification_context.loading_status") }}</span>
  </div>
  <div
    v-else-if="kind === 'player' && player"
    class="px-2 py-1 rounded border border-border bg-background/40"
  >
    <PlayerDisplay
      :player="player"
      linkable
      :show-elo="false"
      :show-flag="false"
      size="sm"
    />
  </div>
  <NuxtLink
    v-else-if="kind === 'scrim' && scrim"
    :to="scrimLink"
    class="block overflow-hidden rounded-lg border border-[hsl(var(--tac-amber)/0.3)] [background:linear-gradient(135deg,hsl(var(--tac-amber)/0.08),hsl(var(--card)/0.5))] transition-colors hover:border-[hsl(var(--tac-amber)/0.6)]"
  >
    <div class="divide-y divide-border/50">
      <div
        v-for="(team, index) in [scrim.from_team, scrim.to_team]"
        :key="team?.id"
        class="relative flex items-center gap-3 px-3 py-2.5"
      >
        <Avatar shape="square" class="h-9 w-9 shrink-0 rounded-md">
          <AvatarImage
            v-if="teamAvatar(team)"
            :src="teamAvatar(team)"
            :alt="team?.name"
          />
          <AvatarFallback class="rounded-md text-[0.6rem] font-semibold uppercase">
            {{ (team?.name || "?").slice(0, 2) }}
          </AvatarFallback>
        </Avatar>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-semibold leading-tight">
            {{ team?.name }}
          </div>
          <TeamRankSummary
            class="mt-1"
            :ranks="team?.ranks"
            :reputation="team?.reputation"
          />
        </div>
        <span
          v-if="index === 0"
          class="absolute -bottom-2.5 left-1/2 z-10 -translate-x-1/2 rounded-full border border-[hsl(var(--tac-amber)/0.5)] bg-background px-1.5 py-0.5 font-sans text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
        >
          vs
        </span>
      </div>
    </div>
    <div
      class="flex items-center justify-center gap-2 border-t border-border/50 bg-background/30 px-3 py-1.5 text-[0.7rem] text-muted-foreground"
    >
      <span
        v-if="scrimScheduled"
        class="inline-flex items-center gap-1 font-semibold uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))]"
      >
        <span class="h-1.5 w-1.5 rounded-full bg-[hsl(var(--tac-amber))]" />
        Scheduled
      </span>
      <span v-if="scrimScheduled" class="text-muted-foreground/60">·</span>
      <span class="font-medium text-foreground">{{ scrimTime() }}</span>
      <span v-if="scrim.match_options">
        · Best of {{ scrim.match_options.best_of }}
      </span>
      <span
        v-if="expiresLabel()"
        class="font-medium text-[hsl(var(--tac-amber))]"
      >
        · {{ expiresLabel() }}
      </span>
    </div>
  </NuxtLink>
  <div
    v-else-if="primaryText"
    class="flex items-center gap-2 text-xs px-2 py-1 rounded border border-border bg-background/40"
  >
    <component
      :is="iconComponent"
      v-if="iconComponent"
      class="h-3 w-3 text-muted-foreground"
    />
    <span class="font-medium truncate">{{ primaryText }}</span>
    <span
      v-if="status"
      :class="[
        'ml-auto inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border',
        statusClass,
      ]"
    >
      {{ status }}
    </span>
  </div>
</template>
