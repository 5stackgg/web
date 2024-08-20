<script setup lang="ts">
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronDownIcon } from "lucide-vue-next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
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
</script>

<template>
  <div class="flex items-center space-x-4">
    <PlayerDisplay :player="member.player">
      <div class="text-left">
        here?
        <p class="text-sm font-medium leading-none">
          {{ member.player.name }} <badge>{{ memberRole }}</badge>
        </p>
        <p class="text-sm text-muted-foreground">
          {{ member.player.steam_id }}
        </p>
      </div>
    </PlayerDisplay>
  </div>
  <Popover v-if="!isInvite">
    <PopoverTrigger as-child>
      <Button variant="outline" class="ml-auto">
        {{ member.role }}
        <ChevronDownIcon class="ml-2 h-4 w-4 text-muted-foreground" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="p-0" align="end">
      <Command v-model="memberRole">
        <CommandInput placeholder="Select new role..." />
        <CommandList>
          <CommandEmpty>No roles found.</CommandEmpty>
          <CommandGroup>
            <CommandItem
              :value="role.value"
              class="flex flex-col items-start px-4 py-2"
              v-for="role of roles"
            >
              <p>{{ role.value }}</p>
              <p class="text-sm text-muted-foreground">
                {{ role.description }}
              </p>
            </CommandItem>

            <CommandItem
              :value="false"
              class="flex flex-col items-start px-4 py-2"
            >
              <AlertDialog>
                <AlertDialogTrigger @click.stop
                  >Remove From Team</AlertDialogTrigger
                >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle
                      >Are you absolutely sure?</AlertDialogTitle
                    >
                    <AlertDialogDescription>
                      This will remove {{ member.player.name }} ({{
                        member.player.steam_id
                      }}) from the team.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction @click.stop="removeMember"
                      >Continue</AlertDialogAction
                    >
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
  <template v-else>
    <AlertDialog>
      <AlertDialogTrigger>
        <Button>Cancel Invite</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This cancel the invite to {{ member.player.name }} ({{
              member.player.steam_id
            }}).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction @click="removeInvite">Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </template>
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
  methods: {
    async removeMember() {
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
