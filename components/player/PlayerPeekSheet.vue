<script setup lang="ts">
import { ExternalLink, X } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "~/components/ui/drawer";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import PlayerElo from "~/components/PlayerElo.vue";
import PlayerRoleForm from "~/components/PlayerRoleForm.vue";
import StatChevron from "~/components/StatChevron.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import type { e_player_roles_enum } from "~/generated/zeus";
import { KD_TIER } from "~/utils/statTiers";

// A phone's players list keeps three columns; staff tap a row for the rest of
// it here: the numbers, the privilege, and the way to the profile.
defineProps<{
  player: Record<string, any> | null;
  kd: string;
}>();

const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{
  (e: "role-updated", role: e_player_roles_enum): void;
}>();

// Focus the panel itself rather than the close button or a privilege.
function onOpenAutoFocus(event: Event) {
  event.preventDefault();
  (event.target as HTMLElement | null)?.focus({ preventScroll: true });
}
</script>

<template>
  <Drawer v-model:open="open">
    <DrawerContent
      class="max-h-[85dvh] outline-none"
      @open-auto-focus="onOpenAutoFocus"
    >
      <template v-if="player">
        <DrawerTitle class="sr-only">{{ player.name }}</DrawerTitle>
        <DrawerDescription class="sr-only">{{
          $t(`player_roles.${player.role || "user"}`)
        }}</DrawerDescription>

        <div
          class="flex items-center gap-3 border-b border-border/60 px-4 py-3"
        >
          <PlayerDisplay
            class="min-w-0 flex-1"
            :player="player"
            size="lg"
            :show-elo="false"
            :show-role="false"
            truncate-name
          >
            <template #elo-postfix>
              <i18n-t
                v-if="
                  player.last_sign_in_at && player.last_sign_in_at !== '~~'
                "
                keypath="pages.players.signed_in"
                scope="global"
                tag="span"
                class="truncate text-xs text-muted-foreground"
              >
                <template #time>
                  <TimeAgo :date="player.last_sign_in_at" hide-icon />
                </template>
              </i18n-t>
            </template>
          </PlayerDisplay>
          <DrawerClose as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-label="$t('common.close')"
            >
              <X class="h-4 w-4" />
            </Button>
          </DrawerClose>
        </div>

        <div class="grid gap-4 overflow-y-auto overscroll-contain p-4">
          <dl
            class="m-0 grid grid-cols-3 divide-x divide-border rounded-md border border-border"
          >
            <div class="grid min-w-0 gap-1 px-3 py-2.5">
              <dt class="text-xs text-muted-foreground">
                {{ $t("pages.players.table.elo") }}
              </dt>
              <dd class="m-0">
                <PlayerElo
                  :elo="{
                    competitive: player.elo_competitive,
                    wingman: player.elo_wingman,
                    duel: player.elo_duel,
                    rush: player.elo_rush,
                  }"
                />
              </dd>
            </div>
            <div class="grid min-w-0 gap-1 px-3 py-2.5">
              <dt class="text-xs text-muted-foreground">
                {{ $t("league.standings.record") }}
              </dt>
              <dd class="m-0 text-base font-semibold tabular-nums">
                {{ player.wins ?? 0 }}–{{ player.losses ?? 0 }}
              </dd>
            </div>
            <div class="grid min-w-0 gap-1 px-3 py-2.5">
              <dt class="text-xs text-muted-foreground">
                {{ $t("pages.players.detail.intro.kd") }}
              </dt>
              <dd
                class="m-0 inline-flex items-center gap-0.5 text-base font-semibold tabular-nums"
              >
                {{ kd }}
                <StatChevron :cfg="KD_TIER" :value="Number(kd)" />
              </dd>
            </div>
          </dl>

          <section class="grid gap-2">
            <h3 class="text-xs font-semibold text-muted-foreground">
              {{ $t("pages.players.table.privilege") }}
            </h3>
            <PlayerRoleForm
              :key="player.steam_id"
              list
              :player="player"
              @updated="emit('role-updated', $event)"
            />
          </section>
        </div>

        <div
          class="border-t border-border/60 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
        >
          <Button as-child variant="outline" class="w-full">
            <NuxtLink
              :to="{
                name: 'players-id',
                params: { id: String(player.steam_id) },
              }"
              @click="open = false"
            >
              {{ $t("pages.bans.record.open_profile") }}
              <ExternalLink class="h-3.5 w-3.5" />
            </NuxtLink>
          </Button>
        </div>
      </template>
    </DrawerContent>
  </Drawer>
</template>
