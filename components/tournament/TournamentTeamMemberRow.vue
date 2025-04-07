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
import Separator from "../ui/separator/Separator.vue";
</script>

<template>
  <TableRow>
    <TableCell class="font-medium">
      <PlayerDisplay :player="member.player"></PlayerDisplay>
    </TableCell>

    <TableCell>
      <Popover v-if="canUpdateRole">
        <PopoverTrigger as-child>
          <Button variant="outline" class="ml-auto">
            {{ member.role }}
            <ChevronDownIcon class="ml-2 h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent class="p-0" align="end">
          <Command v-model="memberRole">
            <CommandInput :placeholder="$t('tournament.team.select_role')" />
            <CommandList>
              <CommandEmpty>{{ $t("tournament.team.no_roles") }}</CommandEmpty>
              <CommandGroup>
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

                <CommandItem
                  :value="false"
                  class="flex px-4 py-2 cursor-pointer"
                  @click.stop="removeMemberDialog = true"
                >
                  <div class="text-red-600">
                    {{ $t("tournament.team.remove_member") }}
                  </div>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <template v-else>
        {{ member.role }}
      </template>
    </TableCell>
  </TableRow>

  <AlertDialog :open="removeMemberDialog">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{
          $t("tournament.team.confirm_remove_member")
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{
            $t("tournament.team.remove_member_description", {
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
        <AlertDialogAction @click.stop="removeMember">{{
          $t("common.confirm")
        }}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    team: {
      type: Object,
      required: true,
    },
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
    canUpdateRole() {
      return (
        this.team.can_manage &&
        this.member.player.steam_id !== useAuthStore().me.steam_id
      );
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
      this.removeMemberDialog = false;
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
