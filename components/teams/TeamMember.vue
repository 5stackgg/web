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
</script>

<template>
  <div class="flex items-center space-x-4">
    <PlayerDisplay :player="member.player">
      <template v-slot:avatar-sub>
        <badge v-if="memberRole">{{ memberRole }}</badge>
      </template>
    </PlayerDisplay>
  </div>
  <Popover
    v-if="
      !isInvite &&
      (team.can_change_role || team.can_remove) &&
      member.player.steam_id != me.steam_id
    "
  >
    <PopoverTrigger as-child>
      <Button variant="outline" class="ml-auto">
        {{ member.role }}
        <ChevronDownIcon class="ml-2 h-4 w-4 text-muted-foreground" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="p-0" align="end">
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
              :value="false"
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
  <template v-else-if="isInvite">
    <AlertDialog>
      <AlertDialogTrigger>
        <Button>{{ $t("team.member.cancel_invite") }}</Button>
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

  <AlertDialog v-else :open="removeMemberDialog">
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
    async removeMember() {
      this.removeMemberDialog = false;
      await this.$apollo.mutate({
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
      await this.$apollo.mutate({
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
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_team_roster_by_pk: [
            {
              _set: {
                role: this.memberRole as e_team_roles_enum,
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
