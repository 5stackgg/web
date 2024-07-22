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
</script>

<template>
  <TableRow>
    <TableCell class="font-medium">
      <Avatar class="mx-3">
        <AvatarImage
          :src="organizer.avatar_url"
          :alt="organizer.name"
          v-if="organizer.avatar_url"
        />
        <AvatarFallback>{{ organizer.name }}</AvatarFallback>
      </Avatar>
      <p>{{ organizer.name }}</p>
    </TableCell>

    <TableCell>
      <Button>
        <AlertDialog>
          <AlertDialogTrigger @click.stop>Remove Organizer</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove {{ organizer.name }} ({{ organizer.steam_id }})
                from being an organizer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction @click.stop="removeOrganizer"
                >Continue</AlertDialogAction
              >
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Button>
    </TableCell>
  </TableRow>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    organizer: {
      type: Object,
      required: true,
    },
  },
  methods: {
    async removeOrganizer() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_tournament_organizers_by_pk: [
            {
              steam_id: this.organizer.steam_id,
              tournament_id: this.$route.params.tournamentId,
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
