<script setup lang="ts">
import { Play, ChevronDown, X, Check } from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import { useQuickQueue } from "~/composables/useQuickQueue";
import { setActiveHub } from "~/composables/useHubState";
import { useRightSidebar } from "~/composables/useRightSidebar";

// The header's Play control. One click queues the mode you played last; the
// arrow picks another. While a search runs it becomes the search clock, so the
// queue is visible from every page -- it used to exist only on /play. Clicking
// the clock opens the party room in the hub; the cross cancels.
const props = defineProps<{ leader: boolean }>();

const { modes, quickMode, queue, clock, modeTitle, join, leave, partySize } =
  useQuickQueue();

function openPartyRoom() {
  setActiveHub("lobby");
  useRightSidebar().setRightSidebarOpen(true);
}

const ctaFill =
  "border border-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] [background:linear-gradient(135deg,var(--tac-amber-cta-from)_0%,hsl(var(--tac-amber))_50%,var(--tac-amber-cta-to)_100%)]";
</script>

<template>
  <div
    v-if="queue"
    class="inline-flex h-8 items-center overflow-hidden rounded-md border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]"
  >
    <button
      type="button"
      class="inline-flex h-full items-center gap-2 pl-2.5 pr-2.5 text-xs font-semibold tabular-nums transition-colors hover:bg-[hsl(var(--tac-amber)/0.12)]"
      :aria-label="
        $t('layouts.queue.searching', {
          mode: modeTitle(queue.type),
          time: clock ?? '',
        })
      "
      @click="openPartyRoom"
    >
      <span class="relative flex size-1.5" aria-hidden="true">
        <span
          class="absolute inline-flex size-full animate-ping rounded-full bg-[hsl(var(--tac-amber))] opacity-75"
        />
        <span
          class="relative inline-flex size-1.5 rounded-full bg-[hsl(var(--tac-amber))]"
        />
      </span>
      <span v-if="clock">{{ clock }}</span>
      <span class="font-medium text-[hsl(var(--tac-amber)/0.75)]">
        {{ modeTitle(queue.type) }}
      </span>
    </button>
    <button
      v-if="props.leader"
      type="button"
      class="grid h-full w-7 place-items-center border-l border-[hsl(var(--tac-amber)/0.3)] transition-colors hover:bg-[hsl(var(--tac-amber)/0.15)]"
      :aria-label="$t('layouts.queue.cancel')"
      @click="leave"
    >
      <X class="size-3.5" />
    </button>
  </div>

  <div
    v-else-if="props.leader && quickMode"
    class="inline-flex h-8 rounded-md shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.35),0_4px_14px_-4px_hsl(var(--tac-amber)/0.5)] transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.55),0_8px_22px_-4px_hsl(var(--tac-amber)/0.7)]"
  >
    <button
      type="button"
      class="inline-flex h-8 items-center gap-1.5 rounded-l-md px-3 text-xs font-semibold"
      :class="ctaFill"
      @click="join(quickMode.type)"
    >
      <Play class="size-3.5 fill-current" />
      {{ modeTitle(quickMode.type) }}
    </button>
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          class="grid h-8 w-7 place-items-center rounded-r-md border-l-black/25"
          :class="ctaFill"
          :aria-label="$t('layouts.queue.pick_mode')"
        >
          <ChevronDown class="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-64">
        <DropdownMenuLabel class="text-xs font-medium text-muted-foreground">
          {{ $t("layouts.queue.pick_mode") }}
        </DropdownMenuLabel>
        <DropdownMenuItem
          v-for="mode in modes"
          :key="mode.type"
          :disabled="!mode.canQueue"
          @select="join(mode.type)"
        >
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="text-sm">
              {{ modeTitle(mode.type) }}
              <span class="text-muted-foreground">
                {{ mode.expected / 2 }}v{{ mode.expected / 2 }}
              </span>
            </span>
            <span class="text-[0.7rem] text-muted-foreground">
              {{
                mode.canQueue
                  ? $t("layouts.queue.in_queue", { count: mode.inQueue })
                  : $t("layouts.queue.party_too_big", { count: partySize })
              }}
            </span>
          </div>
          <Check
            v-if="quickMode.type === mode.type"
            class="text-[hsl(var(--tac-amber))]"
          />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem @select="navigateTo('/play')">
          {{ $t("layouts.queue.all_modes") }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>

  <NuxtLink
    v-else-if="props.leader"
    to="/play"
    :title="$t('layouts.lobby_panel.find_match')"
    class="inline-flex h-8 w-8 items-center justify-center rounded-md"
    :class="ctaFill"
  >
    <Play class="size-4 fill-current" />
  </NuxtLink>
</template>
