<script lang="ts">
import { defineComponent } from "vue";
import { Swords, Server, HardDrive, Loader2 } from "lucide-vue-next";
import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";

const MATCH_TYPES = ["MatchStatusChange", "MatchSupport"];
const SERVER_TYPES = ["DedicatedServerStatus", "DedicatedServerRconStatus"];
const NODE_TYPES = ["GameNodeStatus"];

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
  components: { Swords, Server, HardDrive, Loader2 },
  props: {
    type: { type: String, required: true },
    entityId: { type: String, required: true },
  },
  data() {
    return {
      match: null as any,
      server: null as any,
      node: null as any,
      matchLoaded: false,
      serverLoaded: false,
      nodeLoaded: false,
    };
  },
  computed: {
    loading() {
      if (!this.kind) return false;
      if (this.kind === "match") return !this.matchLoaded;
      if (this.kind === "server") return !this.serverLoaded;
      if (this.kind === "node") return !this.nodeLoaded;
      return false;
    },
    kind() {
      if (MATCH_TYPES.includes(this.type)) return "match";
      if (SERVER_TYPES.includes(this.type)) return "server";
      if (NODE_TYPES.includes(this.type)) return "node";
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
        if (this.server.connected === true) return "ONLINE";
        if (this.server.connected === false) return "OFFLINE";
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
          return this.kind !== "match" || !this.entityId;
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
          return this.kind !== "server" || !this.entityId;
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
    },
  },
});
</script>

<template>
  <div
    v-if="loading"
    class="flex items-center gap-2 text-xs px-2 py-1 rounded border border-border bg-background/40 text-muted-foreground"
  >
    <Loader2 class="h-3 w-3 animate-spin" />
    <span class="italic">Loading status…</span>
  </div>
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
