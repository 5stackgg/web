<script lang="ts" setup>
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "~/components/ui/hover-card";
import { ChevronUpIcon } from "lucide-vue-next";
</script>

<template>
  <HoverCard v-if="competitiveElo || wingmanElo || duelElo">
    <HoverCardTrigger as-child>
      <div
        class="inline-flex items-center gap-1 px-2 py-1 rounded-md cursor-default transition-colors hover:bg-muted"
      >
        <!-- Primary ELO -->
        <span
          :class="getEloColorClass(competitiveElo)"
          class="text-sm font-semibold"
        >
          {{ competitiveElo ?? "-" }}
        </span>

        <!-- Indicator if more ranks exist -->
        <ChevronUpIcon
          v-if="wingmanElo || duelElo"
          class="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5"
        />
      </div>
    </HoverCardTrigger>

    <!-- Hover Content -->
    <HoverCardContent class="w-56">
      <div class="space-y-2 text-sm">
        <div class="flex items-center justify-between">
          <span :class="['text-muted-foreground']"> Duel </span>

          <span
            v-if="duelElo"
            class="font-mono font-semibold"
            :class="getEloColorClass(duelElo)"
          >
            {{ duelElo }}
          </span>
          <span v-else class="text-muted-foreground">—</span>
        </div>

        <div class="flex items-center justify-between">
          <span :class="['text-muted-foreground']"> Wingman </span>

          <span
            v-if="wingmanElo"
            class="font-mono font-semibold"
            :class="getEloColorClass(wingmanElo)"
          >
            {{ wingmanElo }}
          </span>
          <span v-else class="text-muted-foreground">—</span>
        </div>
      </div>
    </HoverCardContent>
  </HoverCard>

  <span v-else class="text-sm text-muted-foreground">-</span>
</template>
<script lang="ts">
export default {
  props: {
    elo: {
      type: Object as () => {
        competitive?: number;
        wingman?: number;
        duel?: number;
      },
      required: false,
    },
    type: {
      type: String,
      required: false,
      default: "competitive",
    },
  },
  computed: {
    competitiveElo(): number | undefined {
      return this.elo?.competitive;
    },
    wingmanElo(): number | undefined {
      return this.elo?.wingman;
    },
    duelElo(): number | undefined {
      return this.elo?.duel;
    },
  },
  methods: {
    getEloColorClass(elo: number): string {
      if (elo >= 30000) return "text-[#EB4B4B]";
      if (elo >= 25000) return "text-[#D22CE6]";
      if (elo >= 20000) return "text-[#FED700]";
      if (elo >= 15000) return "text-[#8846FF]";
      if (elo >= 10000) return "text-[#4B69FF]";
      if (elo >= 5000) return "text-[#5E98D7]";
      return "text-[#B1C3D9]";
    },
  },
};
</script>
