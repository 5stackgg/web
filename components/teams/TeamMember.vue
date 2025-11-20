<script setup lang="ts">
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronDownIcon } from "lucide-vue-next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
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
import Separator from "../ui/separator/Separator.vue";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { e_team_roster_statuses_enum } from "~/generated/zeus";
</script>

<template>
  <div :class="[team.can_change_role ? 'col-span-5' : 'col-span-7', 'min-w-0']">
    <PlayerDisplay :player="member.player" :linkable="true"></PlayerDisplay>
  </div>

  <div class="col-span-2" v-if="!isInvite && team.can_change_role">
    <Popover
      v-if="
        !isInvite &&
        (team.can_change_role || team.can_remove) &&
        member.player.steam_id != me.steam_id
      "
    >
      <PopoverTrigger as-child>
        <Button variant="outline" class="w-full justify-between">
          <span class="truncate">{{ member.role }}</span>
          <ChevronDownIcon class="ml-2 h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent class="p-0" align="start">
        <Command v-model="memberRole">
          <CommandList>
            <CommandGroup>
              <template v-if="team.can_change_role">
                <CommandItem
                  :value="role.value"
                  class="flex flex-col items-start px-4 py-2 cursor-pointer"
                  v-for="role of roles"
                >
                  <p>{{ role.value }}</p>
                  <p class="text-sm text-muted-foreground">
                    {{ role.description }}
                  </p>
                </CommandItem>

                <Separator></Separator>
              </template>

              <CommandItem
                :value="'remove'"
                class="flex flex-col items-start px-4 py-2 cursor-pointer"
                @click.stop="removeMemberDialog = true"
                v-if="team.can_remove"
              >
                <div class="text-red-600">{{ $t("team.member.remove") }}</div>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>

  <div class="col-span-2" v-if="!isInvite && team.can_change_role">
    <label
      v-if="team.can_change_role"
      class="flex items-center gap-2 cursor-pointer select-none"
      @click.stop.prevent="toggleCoach"
    >
      <span class="text-sm text-muted-foreground">{{
        $t("team.member.coach")
      }}</span>
      <Switch :model-value="member.coach" class="pointer-events-none" />
    </label>
  </div>

  <div class="col-span-3" v-if="!isInvite && team.can_change_role">
    <div class="flex items-center">
      <Select
        :model-value="member.status"
        @update:modelValue="
          (v: any) => updateMemberStatus(v as e_team_roster_statuses_enum)
        "
      >
        <SelectTrigger class="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem :value="e_team_roster_statuses_enum.Starter">{{
              $t("team.member.starter")
            }}</SelectItem>
            <SelectItem :value="e_team_roster_statuses_enum.Benched">{{
              $t("team.member.benched")
            }}</SelectItem>
            <SelectItem :value="e_team_roster_statuses_enum.Substitute">{{
              $t("team.member.substitute")
            }}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  </div>

  <div class="col-span-12" v-else-if="isInvite">
    <AlertDialog>
      <AlertDialogTrigger>
        <Button size="sm">{{ $t("team.member.cancel_invite") }}</Button>
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
        <AlertDialogAction @click="removeMember">{{
          $t("common.confirm")
        }}</AlertDialogAction>
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
      memberRole: undefined,
      removeMemberDialog: false,
    };
  },
  watch: {
    ["member.role"]: {
      immediate: true,
      handler(role) {
        this.memberRole = role;
      },
    },
    memberRole: {
      handler(role) {
        if (role) {
          this.publishRole();
          return;
        }
      },
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
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
    async publishRole() {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          update_team_roster_by_pk: [
            {
              _set: {
                role: this.memberRole as unknown as e_team_roles_enum,
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
