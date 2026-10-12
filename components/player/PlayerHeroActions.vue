<script setup lang="ts">
import {
  Ban,
  Clock,
  MessageSquare,
  MoreVertical,
  UserCheck,
  UserPlus,
  X,
} from "lucide-vue-next";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

// The profile hero's actions as one cluster of square icon buttons the size of
// the ⋮ menu, so they can sit anywhere without crowding the player's name.
defineProps<{
  actions: any[];
  relationship: string;
  canAddFriend: boolean;
  canMessage: boolean;
  isBlocked: boolean;
  isSelf: boolean;
  pending: boolean;
}>();

const emit = defineEmits<{
  (e: "add"): void;
  (e: "accept"): void;
  (e: "cancel"): void;
  (e: "message"): void;
}>();

const iconButtonClasses =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:h-4 [&_svg]:w-4";
const neutralClasses =
  "border-border bg-card/60 text-muted-foreground hover:border-[hsl(var(--tac-amber)_/_0.6)] hover:bg-[hsl(var(--tac-amber)_/_0.1)] hover:text-[hsl(var(--tac-amber))]";
const primaryClasses =
  "border-[hsl(var(--tac-amber)_/_0.55)] bg-[hsl(var(--tac-amber)_/_0.12)] text-[hsl(var(--tac-amber))] hover:border-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)_/_0.2)]";
const dangerClasses =
  "border-border bg-card/60 text-muted-foreground hover:border-destructive/50 hover:bg-destructive/15 hover:text-destructive";
</script>

<template>
  <div class="flex items-center gap-2">
    <template v-if="!isSelf">
      <Tooltip v-if="isBlocked">
        <TooltipTrigger as-child>
          <span
            :class="[
              iconButtonClasses,
              'border-border bg-muted/40 text-muted-foreground',
            ]"
            :aria-label="$t('player_blocks.blocked_badge')"
          >
            <Ban />
          </span>
        </TooltipTrigger>
        <TooltipContent>{{ $t("player_blocks.blocked_badge") }}</TooltipContent>
      </Tooltip>

      <Tooltip v-else-if="canAddFriend">
        <TooltipTrigger as-child>
          <button
            type="button"
            :class="[iconButtonClasses, primaryClasses]"
            :disabled="pending"
            :aria-label="$t('player.status.add_friend')"
            @click="emit('add')"
          >
            <UserPlus />
          </button>
        </TooltipTrigger>
        <TooltipContent>{{ $t("player.status.add_friend") }}</TooltipContent>
      </Tooltip>

      <Tooltip v-else-if="relationship === 'incoming'">
        <TooltipTrigger as-child>
          <button
            type="button"
            :class="[iconButtonClasses, primaryClasses]"
            :disabled="pending"
            :aria-label="$t('matchmaking.friends.accept')"
            @click="emit('accept')"
          >
            <UserCheck />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {{ $t("matchmaking.friends.accept") }}
        </TooltipContent>
      </Tooltip>

      <!-- Requested: the clock turns into an X on hover, same as the old
           full-width button's cancel swap. -->
      <Tooltip v-else-if="relationship === 'outgoing'">
        <TooltipTrigger as-child>
          <button
            type="button"
            :class="[iconButtonClasses, dangerClasses, 'group/req']"
            :disabled="pending"
            :aria-label="$t('matchmaking.friends.cancel_request_aria')"
            @click="emit('cancel')"
          >
            <Clock class="group-hover/req:hidden" />
            <X class="hidden group-hover/req:block" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {{ $t("matchmaking.friends.requested") }}
        </TooltipContent>
      </Tooltip>

      <Tooltip v-else-if="relationship === 'friend'">
        <TooltipTrigger as-child>
          <span
            :class="[
              iconButtonClasses,
              'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
            ]"
            :aria-label="$t('pages.players.detail.friend')"
          >
            <UserCheck />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {{ $t("pages.players.detail.friend") }}
        </TooltipContent>
      </Tooltip>

      <Tooltip v-if="canMessage">
        <TooltipTrigger as-child>
          <button
            type="button"
            :class="[iconButtonClasses, primaryClasses]"
            :aria-label="$t('chat.direct.message')"
            @click="emit('message')"
          >
            <MessageSquare />
          </button>
        </TooltipTrigger>
        <TooltipContent>{{ $t("chat.direct.message") }}</TooltipContent>
      </Tooltip>
    </template>

    <!-- A menu holding a single entry is just a slower button, so one
         available action renders as that action directly. -->
    <button
      v-if="actions.length === 1"
      type="button"
      :class="[
        iconButtonClasses,
        actions[0].destructive ? dangerClasses : neutralClasses,
      ]"
      :title="actions[0].label"
      :aria-label="actions[0].label"
      :disabled="actions[0].busy"
      @click="actions[0].run()"
    >
      <component :is="actions[0].icon" />
    </button>
    <DropdownMenu v-else-if="actions.length > 1">
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          :class="[iconButtonClasses, neutralClasses]"
          :title="$t('pages.players.detail.more_actions')"
          :aria-label="$t('pages.players.detail.more_actions')"
        >
          <MoreVertical />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-52">
        <template v-for="action in actions" :key="action.key">
          <DropdownMenuSeparator v-if="action.destructive" />
          <DropdownMenuItem
            class="gap-2"
            :class="{
              'text-destructive focus:text-destructive': action.destructive,
            }"
            :disabled="action.busy"
            @click="action.run()"
          >
            <component
              :is="action.icon"
              class="h-4 w-4"
              :class="{ 'text-destructive': action.danger }"
            />
            {{ action.label }}
            <span
              v-if="action.count"
              class="ml-auto font-mono text-xs tabular-nums text-muted-foreground"
            >
              {{ action.count }}
            </span>
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
