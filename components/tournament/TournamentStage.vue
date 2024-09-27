<script lang="ts" setup>
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import { MoreHorizontal, Trash } from "lucide-vue-next";
import TournamentStageForm from "~/components/tournament/TournamentStageForm.vue";
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
import TournamentBracketViewer from "./TournamentBracketViewer.vue";
</script>

<template>
  <h1 class="flex justify-between items-center mb-8">
    <div class="flex flex-col space-y-2">
      <h2 class="text-xl">Stage {{ stage.order }}</h2>
      <div class="flex items-center space-x-2">
        <Badge class="text-sm">{{
          stage.e_tournament_stage_type.description
        }}</Badge>
        <Badge variant="secondary" class="text-sm"
          >Teams: {{ stage.min_teams }} - {{ stage.max_teams }}</Badge
        >
      </div>
    </div>
    <DropdownMenu v-model:open="stageMenu">
      <DropdownMenuTrigger as-child>
        <Button variant="secondary" size="sm">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-[200px]">
        <DropdownMenuGroup>
          <DropdownMenuItem @click="editStage = true"> Edit </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            class="text-red-600"
            @click="deleteAlertDialog = true"
          >
            <Trash class="mr-2 h-4 w-4 inline" /> Delete
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </h1>

  <TournamentBracketViewer :rounds="rounds"></TournamentBracketViewer>

  <Sheet :open="editStage" @update:open="(open) => (editStage = open)">
    <SheetTrigger></SheetTrigger>
    <SheetContent>
      <SheetHeader>
        <SheetTitle>Editing Touranment</SheetTitle>
        <SheetDescription>
          <TournamentStageForm
            :stage="stage"
            :order="stage.order"
            @updated="editStage = false"
          ></TournamentStageForm>
        </SheetDescription>
      </SheetHeader>
    </SheetContent>
  </Sheet>

  <AlertDialog
    :open="deleteAlertDialog"
    @update:open="(open) => (deleteAlertDialog = open)"
  >
    <AlertDialogTrigger class="w-full"> </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
        <AlertDialogDescription>
          This action cannot be undone. This will permanently this stage.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction @click="deleteStage">Continue</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    stage: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      editStage: false,
      stageMenu: false,
      deleteAlertDialog: false,
    };
  },
  computed: {
    rounds() {
      const rounds = new Map();
      for (const bracket of this.stage?.brackets) {
        let matches = rounds.get(bracket.round) || [];

        matches.push(bracket);

        rounds.set(bracket.round, matches);
      }

      return rounds;
    },
  },
  methods: {
    async deleteStage() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_tournament_stages_by_pk: [
            {
              id: this.stage.id,
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
