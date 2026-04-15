<script setup lang="ts">
import { MoreHorizontal, Trash2, UserMinus, GraduationCap } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { e_team_roster_statuses_enum } from "~/generated/zeus";
</script>

<template>
  <div
    :class="[
      'group relative flex items-center gap-3 rounded-md border border-transparent px-3 py-2 transition-colors',
      'hover:border-border hover:bg-muted/40',
      accentClass,
    ]"
  >
    <div
      :class="[
        'absolute inset-y-2 left-0 w-[3px] rounded-full',
        accentBarClass,
      ]"
      aria-hidden="true"
    ></div>

    <div class="flex-1 min-w-0">
      <PlayerDisplay :player="member.player" :linkable="true">
        <template #name-postfix>
          <span
            v-if="!isInvite && member.role"
            class="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80"
          >
            {{ member.role }}
          </span>
          <GraduationCap
            v-if="!isInvite && member.coach"
            class="h-3.5 w-3.5 text-muted-foreground/80"
            :aria-label="$t('team.member.coach')"
          />
        </template>
      </PlayerDisplay>
    </div>

    <template v-if="isInvite">
      <AlertDialog>
        <AlertDialogTrigger as-child>
          <Button size="sm" variant="ghost" class="text-muted-foreground">
            {{ $t("team.member.cancel_invite") }}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{{
              $t("team.member.confirm_cancel_invite")
            }}</AlertDialogTitle>
            <AlertDialogDescription>
              {{
                $t("team.member.cancel_invite_description", {
                  name: member.player.name,
                  steam_id: member.player.steam_id,
                })
              }}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
            <AlertDialogAction @click="removeInvite">{{
              $t("common.confirm")
            }}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </template>

    <template v-else-if="showActionMenu">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal class="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-56">
          <DropdownMenuGroup v-if="team.can_change_role && roles?.length">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span>{{ $t("team.members.role") }}</span>
                <span class="ml-auto text-muted-foreground text-xs">{{
                  member.role
                }}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent class="w-64">
                <DropdownMenuItem
                  v-for="role of roles"
                  :key="role.value"
                  class="flex flex-col items-start gap-0.5"
                  @click="publishRole(role.value)"
                >
                  <div class="flex w-full items-center justify-between">
                    <span>{{ role.value }}</span>
                    <span
                      v-if="role.value === member.role"
                      class="text-xs text-primary"
                      >✓</span
                    >
                  </div>
                  <span class="text-xs text-muted-foreground">{{
                    role.description
                  }}</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span>{{ $t("common.status") }}</span>
                <span class="ml-auto text-muted-foreground text-xs capitalize">{{
                  member.coach
                    ? $t("team.member.coach")
                    : $t(`team.member.${statusKey}`)
                }}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent class="w-48">
                <DropdownMenuItem
                  @click="updateMemberStatus(e_team_roster_statuses_enum.Starter)"
                >
                  {{ $t("team.member.starter") }}
                  <span
                    v-if="
                      !member.coach &&
                      member.status === e_team_roster_statuses_enum.Starter
                    "
                    class="ml-auto text-primary"
                    >✓</span
                  >
                </DropdownMenuItem>
                <DropdownMenuItem
                  @click="updateMemberStatus(e_team_roster_statuses_enum.Benched)"
                >
                  {{ $t("team.member.benched") }}
                  <span
                    v-if="
                      !member.coach &&
                      member.status === e_team_roster_statuses_enum.Benched
                    "
                    class="ml-auto text-primary"
                    >✓</span
                  >
                </DropdownMenuItem>
                <DropdownMenuItem
                  @click="
                    updateMemberStatus(e_team_roster_statuses_enum.Substitute)
                  "
                >
                  {{ $t("team.member.substitute") }}
                  <span
                    v-if="
                      !member.coach &&
                      member.status === e_team_roster_statuses_enum.Substitute
                    "
                    class="ml-auto text-primary"
                    >✓</span
                  >
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem @click="toggleCoach">
                  <GraduationCap class="mr-2 h-4 w-4" />
                  {{ $t("team.member.coach") }}
                  <span v-if="member.coach" class="ml-auto text-primary">✓</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuGroup>

          <DropdownMenuSeparator
            v-if="team.can_change_role && canRemoveMember"
          />

          <DropdownMenuItem
            v-if="canRemoveMember"
            class="text-red-600 focus:text-red-600"
            @click="removeMemberDialog = true"
          >
            <UserMinus class="mr-2 h-4 w-4" />
            {{ $t("team.member.remove") }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </template>
  </div>

  <AlertDialog :open="removeMemberDialog">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{
          $t("team.member.confirm_remove")
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{
            $t("team.member.remove_description", {
              name: member.player.name,
              steam_id: member.player.steam_id,
            })
          }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="removeMemberDialog = false">{{
          $t("common.cancel")
        }}</AlertDialogCancel>
        <AlertDialogAction
          class="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          @click="removeMember"
        >
          <Trash2 class="mr-2 h-4 w-4" />
          {{ $t("common.confirm") }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import type { e_team_roles_enum } from "~/generated/zeus";

interface Role {
  value: string;
  description: string;
}

interface Member {
  role: string;
  coach?: boolean;
  core?: boolean;
  substitute?: boolean;
  status?: e_team_roster_statuses_enum;
  id?: string;
  team_id: string;
  player: {
    name: string;
    steam_id: string;
    avatar_url: string;
  };
}

export default {
  props: {
    team: {
      type: Object,
      required: true,
    },
    member: {
      type: Object as PropType<Member>,
      required: true,
    },
    roles: {
      required: false,
      type: Array as PropType<Role[]>,
    },
    isInvite: {
      required: true,
    },
  },
  data() {
    return {
      removeMemberDialog: false,
    };
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    isSelf(): boolean {
      return this.member.player.steam_id === this.me?.steam_id;
    },
    canRemoveMember(): boolean {
      return !!this.team.can_remove && !this.isSelf;
    },
    showActionMenu(): boolean {
      if (this.isSelf) return false;
      return !!(this.team.can_change_role || this.canRemoveMember);
    },
    statusKey(): string {
      switch (this.member.status) {
        case "Starter":
          return "starter";
        case "Benched":
          return "benched";
        case "Substitute":
          return "substitute";
        default:
          return "starter";
      }
    },
    accentBarClass(): string {
      if (this.isInvite) return "bg-amber-500/40";
      switch (this.member.status) {
        case "Starter":
          return "bg-primary/70";
        case "Benched":
          return "bg-amber-500/60";
        case "Substitute":
          return "bg-muted-foreground/40";
        default:
          return "bg-transparent";
      }
    },
    accentClass(): string {
      return "pl-4";
    },
  },
  methods: {
    async updateMemberStatus(value: e_team_roster_statuses_enum) {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          update_team_roster_by_pk: [
            {
              _set: {
                status: value,
              } as any,
              pk_columns: {
                team_id: this.member.team_id,
                player_steam_id: this.member.player.steam_id,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async removeMember() {
      this.removeMemberDialog = false;
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          delete_team_roster_by_pk: [
            {
              team_id: this.member.team_id,
              player_steam_id: this.member.player.steam_id,
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async removeInvite() {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          delete_team_invites_by_pk: [
            {
              id: this.member.id,
            },
            {
              id: true,
            },
          ],
        }),
      });
    },
    async publishRole(roleValue: string) {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          update_team_roster_by_pk: [
            {
              _set: {
                role: roleValue as unknown as e_team_roles_enum,
              },
              pk_columns: {
                team_id: this.member.team_id,
                player_steam_id: this.member.player.steam_id,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async toggleCoach() {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          update_team_roster_by_pk: [
            {
              _set: {
                coach: !this.member.coach,
              },
              pk_columns: {
                team_id: this.member.team_id,
                player_steam_id: this.member.player.steam_id,
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
};
</script>
