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
  Loader2,
} from "lucide-vue-next";
import { toast } from "@/components/ui/toast";
import { generateMutation } from "~/graphql/graphqlGen";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
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
          >{{ matchMap.status }}</Badge
        >
        <Badge
          v-else-if="isDecider && match.options.best_of > 1"
          variant="destructive"
          class="text-xs px-2 py-0.5 backdrop-blur-sm"
          >{{ $t("match.decider") }}</Badge
        >
        <Tooltip v-if="hasDemo && canWatchDemo && hasDemoMetadata">
          <TooltipTrigger as-child>
            <Button
              size="xs"
              variant="ghost"
              class="h-6 w-6 p-0 text-white/70 hover:text-white"
              @click.stop="openDemoWatcher()"
            >
              <PlayCircle class="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Watch demo</TooltipContent>
        </Tooltip>
        <Tooltip v-else-if="hasDemo && canParseDemo">
          <TooltipTrigger as-child>
            <Button
              size="xs"
              variant="ghost"
              class="h-6 w-6 p-0 text-white/70 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="isParsingDemo"
              @click.stop="parseDemo()"
            >
              <Loader2 v-if="isParsingDemo" class="w-4 h-4 animate-spin" />
              <RefreshCw v-else class="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {{ isParsingDemo ? "Parsing demo…" : "Parse demo metadata" }}
          </TooltipContent>
        </Tooltip>
        <Tooltip v-else-if="hasDemo && canWatchDemo">
          <TooltipTrigger as-child>
            <Button
              size="xs"
              variant="ghost"
              class="h-6 w-6 p-0 text-white/70 opacity-50 cursor-not-allowed"
              disabled
            >
              <PlayCircle class="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Demo metadata has not been parsed</TooltipContent>
        </Tooltip>
        <template v-if="matchMap.demos_download_url">
          <a target="_blank" :href="matchMap.demos_download_url" @click.stop>
            <Button
              size="xs"
              variant="ghost"
              class="h-6 w-6 p-0 text-white/70 hover:text-white"
              v-if="matchMap.demos_total_size"
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
    };
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
    canParseDemo() {
      return useAuthStore().isAdmin;
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
        toast({ title: "Demo parsed" });
      } catch (error) {
        toast({
          title: "Failed to parse demo",
          description: (error as Error)?.message,
          variant: "destructive",
        });
      } finally {
        this.isParsingDemo = false;
      }
    },
    openDemoWatcher() {
      // Pop the demo watcher into a dedicated window. The popup owns
      // the session lifecycle: closing the window kills the session
      // server-side via the WS close handler. Sized to match the 16:9
      // player + control bar; user can resize freely afterward.
      const url = `/demo/${this.matchMap.id}`;
      const features =
        "width=1280,height=820,menubar=no,toolbar=no,location=no";
      // The window name is keyed off the map id so re-clicking the
      // same map's watch button focuses the existing popup instead
      // of opening a second one. Different maps get different names.
      const name = `demo-${this.matchMap.id}`;
      const popup = window.open(url, name, features);
      if (popup) {
        popup.focus();
      }
    },
  },
};
</script>
