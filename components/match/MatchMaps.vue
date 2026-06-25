<script setup lang="ts">
import { Badge } from "~/components/ui/badge";
import MatchLineupScoreDisplay from "~/components/match/MatchLineupScoreDisplay.vue";
import RoundHistoryBar from "~/components/match/RoundHistoryBar.vue";
import {
  Download,
  ChevronRight,
  ChevronLeft,
  PlayCircle,
  RefreshCw,
  MoreVertical,
} from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import MatchSelectMapWinner from "~/components/match/MatchSelectMapWinner.vue";
import { toast } from "@/components/ui/toast";
import { generateMutation } from "~/graphql/graphqlGen";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import cleanMapName from "~/utilities/cleanMapName";
</script>

<template>
  <div
    class="rounded-xl overflow-hidden border border-border/50 transition-colors"
    :class="{
      'ring-2 ring-red-500': matchMap.is_current_map,
      'cursor-pointer hover:border-primary/60': canOpenStats,
      'outline-dashed outline-2 outline-offset-2 outline-[hsl(var(--tac-amber))]':
        isActive,
    }"
    :role="canOpenStats ? 'button' : undefined"
    :tabindex="canOpenStats ? 0 : undefined"
    @click="canOpenStats && $emit('open-stats', matchMap)"
    @keydown.enter="canOpenStats && $emit('open-stats', matchMap)"
    @keydown.space.prevent="canOpenStats && $emit('open-stats', matchMap)"
  >
    <!-- Map image header -->
    <div class="relative aspect-[16/5]">
      <NuxtImg
        :src="matchMap.map.poster"
        class="w-full h-full object-cover brightness-50"
        sizes="400px"
      />
      <div
        class="absolute inset-0 bg-gradient-to-t from-black/80 to-black/20"
      />
      <!-- Map name top -->
      <div class="absolute top-0 left-0 right-0 px-2 pt-2 z-10">
        <span
          class="text-[11px] font-bold text-white/90 uppercase tracking-widest drop-shadow-lg"
        >
          {{ cleanMapName(matchMap.map.name) }}
        </span>
      </div>
      <!-- Patch centered -->
      <div class="absolute inset-0 flex items-center justify-center">
        <img
          v-if="matchMap.map.patch"
          :src="matchMap.map.patch"
          class="w-1/4 max-w-[72px] h-auto max-h-[60%] object-contain drop-shadow-2xl opacity-80"
        />
      </div>
      <!-- Status badge + demo controls top-right -->
      <div class="absolute top-2 right-2 z-10 flex items-center gap-1.5">
        <Badge
          v-if="matchMap.status !== e_match_status_enum.Scheduled"
          :variant="matchMap.is_current_map ? 'destructive' : 'secondary'"
          class="text-xs px-2 py-0.5 backdrop-blur-sm"
          >{{ matchMap.status.replace(/([a-z])([A-Z])/g, "$1 $2") }}</Badge
        >
        <Badge
          v-else-if="isDecider && match.options.best_of > 1"
          variant="destructive"
          class="text-xs px-2 py-0.5 backdrop-blur-sm"
          >{{ $t("match.decider") }}</Badge
        >
        <template v-if="hasDemo && hasDemoMetadata">
          <Tooltip v-if="mapHasRadar">
            <TooltipTrigger as-child>
              <Button
                size="xs"
                variant="ghost"
                class="inline-flex h-6 w-6 p-0 text-white/70 hover:text-white"
                @click.stop="openReplay2d()"
              >
                <span
                  class="flex h-4 w-4 items-center justify-center rounded-full border border-current font-mono text-[8px] font-black leading-none"
                >
                  2D
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t("match.replay.open") }}</TooltipContent>
          </Tooltip>
          <Tooltip v-if="mapHasMesh">
            <TooltipTrigger as-child>
              <Button
                size="xs"
                variant="ghost"
                class="inline-flex h-6 w-6 p-0 text-[#38e1ff]/80 hover:text-[#38e1ff]"
                @click.stop="openReplay3d()"
              >
                <span
                  class="flex h-4 w-4 items-center justify-center rounded-full border border-current font-mono text-[8px] font-black leading-none"
                >
                  3D
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t("match.replay.open_3d") }}</TooltipContent>
          </Tooltip>
        </template>
        <template v-if="hasDemo && canWatchDemo">
          <Tooltip v-if="!showDemoDropdown">
            <TooltipTrigger as-child>
              <span class="inline-flex">
                <Button
                  size="xs"
                  variant="ghost"
                  :disabled="demoButtonState.disabled"
                  class="h-6 w-6 p-0 text-white/70 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  @click.stop="
                    demoButtonState.onClick && demoButtonState.onClick()
                  "
                >
                  <Spinner
                    v-if="demoButtonState.icon === 'loading'"
                    class="w-4 h-4"
                  />
                  <RefreshCw
                    v-else-if="demoButtonState.icon === 'parse'"
                    class="w-4 h-4"
                  />
                  <PlayCircle v-else class="w-4 h-4" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{{ demoButtonState.tooltip }}</TooltipContent>
          </Tooltip>
          <DropdownMenu v-else>
            <DropdownMenuTrigger as-child>
              <Button
                size="xs"
                variant="ghost"
                class="h-6 w-6 p-0 text-white/70 hover:text-white"
                @click.stop
              >
                <PlayCircle class="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-64">
              <DropdownMenuLabel class="text-xs">
                {{ matchMap.demos.length }} demos for this map
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                v-for="demo in sortedDemos"
                :key="demo.id"
                :disabled="!demo.metadata_parsed_at || !demo.total_ticks"
                @click.stop="openDemoWatcher(demo.id)"
              >
                <div class="flex flex-col gap-0.5 w-full">
                  <div
                    class="flex items-center justify-between gap-2 text-xs font-medium"
                  >
                    <span>{{ formatDemoUploaded(demo.created_at) }}</span>
                    <span class="text-muted-foreground tabular-nums">{{
                      formatDemoSize(demo.size)
                    }}</span>
                  </div>
                  <span
                    v-if="!demo.metadata_parsed_at || !demo.total_ticks"
                    class="text-[10px] uppercase tracking-wider text-muted-foreground"
                  >
                    not parsed
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </template>
        <template v-if="matchMap.demos_download_url">
          <a target="_blank" :href="matchMap.demos_download_url" @click.stop>
            <Button
              size="xs"
              variant="ghost"
              class="h-6 w-6 p-0 text-white/70 hover:text-white"
              v-if="
                matchMap.demos_total_size || (matchMap.demos?.length ?? 0) > 0
              "
            >
              <Download class="w-3.5 h-3.5" />
            </Button>
          </a>
        </template>
        <template v-else>
          <template v-for="demo in matchMap.demos" :key="demo.id">
            <a :href="demo.download_url" @click.stop>
              <Button
                size="xs"
                variant="ghost"
                class="h-6 w-6 p-0 text-white/70 hover:text-white"
              >
                <Download class="w-3.5 h-3.5" />
              </Button>
            </a>
          </template>
        </template>
        <DropdownMenu v-if="match.is_organizer">
          <DropdownMenuTrigger as-child>
            <Button
              size="xs"
              variant="ghost"
              class="h-6 w-6 p-0 text-white/70 hover:text-white"
              @click.stop
            >
              <MoreVertical class="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <MatchSelectMapWinner :match="match" :match-map="matchMap" />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    <!-- Score section -->
    <div class="bg-muted/40">
      <div class="flex items-center justify-between gap-1 px-3 pt-2.5 pb-2">
        <!-- Team 1 -->
        <div
          class="flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 min-h-[2.5rem]"
        >
          <img v-if="showTeamPatch" :src="team1Patch" class="w-5 h-5" />
          <span class="text-[10px] text-muted-foreground truncate max-w-full">{{
            match.lineup_1.name
          }}</span>
        </div>

        <Tooltip v-if="pickedByLineup === 1">
          <TooltipTrigger as-child>
            <ChevronLeft class="w-4 h-4 text-emerald-500 shrink-0" />
          </TooltipTrigger>
          <TooltipContent>
            {{ match.lineup_1.name }} {{ $t("match.map_veto.pick") }}
          </TooltipContent>
        </Tooltip>

        <!-- Score -->
        <div
          class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-background/60"
        >
          <MatchLineupScoreDisplay
            :match="match"
            :lineup="match.lineup_1"
            :match-map="matchMap"
            class="text-lg font-bold tabular-nums"
            :halves="false"
          />
          <MatchLineupScoreDisplay
            :match="match"
            :lineup="match.lineup_1"
            :match-map="matchMap"
            :score="false"
          />
          <span class="text-muted-foreground text-xs">:</span>
          <MatchLineupScoreDisplay
            :match="match"
            :lineup="match.lineup_2"
            :match-map="matchMap"
            :score="false"
          />
          <MatchLineupScoreDisplay
            :match="match"
            :lineup="match.lineup_2"
            :match-map="matchMap"
            class="text-lg font-bold tabular-nums"
            :halves="false"
          />
        </div>

        <Tooltip v-if="pickedByLineup === 2">
          <TooltipTrigger as-child>
            <ChevronRight class="w-4 h-4 text-emerald-500 shrink-0" />
          </TooltipTrigger>
          <TooltipContent>
            {{ match.lineup_2.name }} {{ $t("match.map_veto.pick") }}
          </TooltipContent>
        </Tooltip>

        <!-- Team 2 -->
        <div
          class="flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 min-h-[2.5rem]"
        >
          <img v-if="showTeamPatch" :src="team2Patch" class="w-5 h-5" />
          <span class="text-[10px] text-muted-foreground truncate max-w-full">{{
            match.lineup_2.name
          }}</span>
        </div>
      </div>

      <div
        v-if="matchMap.rounds?.length > 0"
        class="border-t border-border/40 bg-background/30 px-5 pt-4 pb-5"
      >
        <RoundHistoryBar
          :match="match"
          :match-map="matchMap"
          compact
          seamless
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {
  e_match_status_enum,
  e_player_roles_enum,
  e_veto_pick_types_enum,
} from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import { useGpuPoolStatusStore } from "~/stores/GpuPoolStatusStore";
import { hasMeshForMap, hasRadarForMap } from "~/utilities/mapAssets";

export default {
  emits: ["open-stats"],
  props: {
    match: {
      type: Object,
      required: true,
    },
    matchMap: {
      type: Object,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      isParsingDemo: false,
      mapHasMesh: true,
      mapHasRadar: true,
    };
  },
  mounted() {
    const name = this.matchMap?.map?.name;
    if (!name) {
      return;
    }
    void hasRadarForMap(name).then((v) => {
      this.mapHasRadar = v;
    });
    void hasMeshForMap(
      useRuntimeConfig().public.mapMeshCdn as string,
      name,
    ).then((v) => {
      this.mapHasMesh = v;
    });
  },
  computed: {
    canOpenStats() {
      if (this.matchMap.status === e_match_status_enum.Scheduled) {
        return false;
      }
      return (this.match.options?.best_of ?? 1) > 1;
    },
    hasDemo() {
      return (
        !!this.matchMap.demos_total_size ||
        (this.matchMap.demos?.length ?? 0) > 0
      );
    },
    canWatchDemo() {
      return (
        this.match.is_organizer ||
        useAuthStore().isRoleAbove(e_player_roles_enum.streamer)
      );
    },
    hasDemoMetadata() {
      return (this.matchMap.demos ?? []).some(
        (d) => !!d.metadata_parsed_at && !!d.total_ticks,
      );
    },
    sortedDemos() {
      const demos = (this.matchMap.demos ?? []).slice();
      demos.sort((a, b) => {
        const at = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (at !== bt) return bt - at;
        return String(b.id ?? "").localeCompare(String(a.id ?? ""));
      });
      return demos;
    },
    showDemoDropdown() {
      if ((this.matchMap.demos?.length ?? 0) <= 1) return false;
      if (this.demoButtonState.disabled) return false;
      if (this.demoButtonState.icon !== "play") return false;
      return true;
    },
    canParseDemo() {
      return useAuthStore().isAdmin;
    },
    demoButtonState() {
      if (this.isParsingDemo) {
        return {
          icon: "loading",
          disabled: true,
          tooltip: "Parsing demo…",
          onClick: null,
        };
      }
      if (!this.hasDemoMetadata) {
        if (this.canParseDemo) {
          return {
            icon: "parse",
            disabled: false,
            tooltip: "Parse demo metadata",
            onClick: () => this.parseDemo(),
          };
        }
        return {
          icon: "play",
          disabled: true,
          tooltip: "Demo metadata has not been parsed",
          onClick: null,
        };
      }
      const gpu = useGpuPoolStatusStore();
      const demo = gpu.getAvailability("demo");
      if (gpu.hasLoaded && !demo.hasFree) {
        return {
          icon: "play",
          disabled: true,
          tooltip: demo.busyReasonKey
            ? this.$t(demo.busyReasonKey)
            : this.$t("stream_status.gpu_busy"),
          onClick: null,
        };
      }
      return {
        icon: "play",
        disabled: false,
        tooltip: "Watch demo",
        onClick: () => this.openDemoWatcher(),
      };
    },
    showTeamPatch() {
      return (
        !this.isDecider || this.matchMap.status === e_match_status_enum.Live
      );
    },
    isDecider() {
      return this.matchMap.vetos.find(({ type }) => {
        return type === e_veto_pick_types_enum.Decider;
      });
    },
    pickedByLineup() {
      const pick = this.matchMap.vetos.find(
        ({ type }) => type === e_veto_pick_types_enum.Pick,
      );
      if (!pick) return null;
      if (pick.match_lineup_id === this.match.lineup_1.id) return 1;
      if (pick.match_lineup_id === this.match.lineup_2.id) return 2;
      return null;
    },
    team1Patch() {
      return this.matchMap.lineup_1_side === "TERRORIST"
        ? "/img/teams/t_logo.svg"
        : "/img/teams/ct_logo.svg";
    },
    team2Patch() {
      return this.matchMap.lineup_2_side === "TERRORIST"
        ? "/img/teams/t_logo.svg"
        : "/img/teams/ct_logo.svg";
    },
  },
  methods: {
    async parseDemo() {
      if (this.isParsingDemo) return;
      this.isParsingDemo = true;
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            reparseDemo: [
              { match_map_id: this.matchMap.id },
              { success: true },
            ],
          }),
        });
        toast({ title: this.$t("toasts.demo_parsed") });
      } catch (error) {
        toast({
          title: this.$t("toasts.demo_parse_failed"),
          description: (error as Error)?.message,
          variant: "destructive",
        });
      } finally {
        this.isParsingDemo = false;
      }
    },
    openDemoWatcher(demoId) {
      const url = demoId
        ? `/demo/${this.matchMap.id}?demoId=${demoId}`
        : `/demo/${this.matchMap.id}`;
      const features =
        "width=1280,height=820,menubar=no,toolbar=no,location=no";
      const name = demoId
        ? `demo-${this.matchMap.id}-${demoId}`
        : `demo-${this.matchMap.id}`;
      const popup = window.open(url, name, features);
      if (popup) {
        popup.focus();
      }
    },
    openReplay2d() {
      const popup = window.open(
        `/matches/${this.match.id}/playback/2d/${this.matchMap.id}`,
        `replay-popout-${this.matchMap.id}`,
        "popup=yes,width=1100,height=900,resizable=yes,scrollbars=yes",
      );
      if (popup) {
        popup.focus();
      }
    },
    openReplay3d() {
      const w = Math.min(1760, screen.availWidth);
      const h = Math.min(1040, screen.availHeight);
      const left = Math.max(0, (screen.availWidth - w) / 2);
      const top = Math.max(0, (screen.availHeight - h) / 2);
      const popup = window.open(
        `/matches/${this.match.id}/playback/3d/${this.matchMap.id}`,
        `replay-3d-${this.matchMap.id}`,
        `popup=yes,width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`,
      );
      if (popup) {
        popup.focus();
      }
    },
    formatDemoSize(bytes) {
      if (typeof bytes !== "number" || bytes <= 0) return "—";
      const units = ["B", "KB", "MB", "GB"];
      let i = 0;
      let n = bytes;
      while (n >= 1024 && i < units.length - 1) {
        n /= 1024;
        i++;
      }
      return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
    },
    formatDemoUploaded(iso) {
      if (!iso) return this.$t("match_extras.unknown_date");
      const d = new Date(iso);
      if (Number.isNaN(d.getTime()))
        return this.$t("match_extras.unknown_date");
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    },
  },
};
</script>
