<script lang="ts" setup>
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
} from "~/components/ui/alert-dialog";
import { TableCell, TableRow } from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { ChevronDownIcon } from "lucide-vue-next";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
</script>

<template>
  <TableRow>
    <TableCell class="font-medium">
      <PlayerDisplay :player="member.player"></PlayerDisplay>
    </TableCell>

    <TableCell>
      <Popover>
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
    </TableCell>
  </TableRow>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    member: {
      type: Object,
      required: true,
    },
    roles: {
      type: Array,
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
    async publishRole() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_tournament_team_roster_by_pk: [
            {
              _set: {
                role: this.memberRole,
              },
              pk_columns: {
                player_steam_id: this.member.player.steam_id,
                tournament_id:
                  this.$route.params.tournamentId || this.$route.params.id,
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
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_tournament_team_roster_by_pk: [
            {
              player_steam_id: this.member.player.steam_id,
              tournament_id:
                this.$route.params.tournamentId || this.$route.params.id,
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
