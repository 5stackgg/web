<script lang="ts" setup>
import TournamentRound from "~/components/tournament/TournamentRound.vue";
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
</script>

<template>
  <h1>
    <div>
      Stage {{ stage.order }}
      <DropdownMenu v-model:open="stageMenu">
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="sm">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-[200px]">
          <DropdownMenuGroup>
            <DropdownMenuItem @click="editStage = true">
              Edit
            </DropdownMenuItem>

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
    </div>

    <Badge>{{ stage.e_tournament_stage_type.description }}</Badge>
    Min Teams {{ stage.min_teams }} Max Teams {{ stage.max_teams }}
  </h1>
  <div class="flex">
    <template v-for="round of Array.from(rounds.keys())">
      <TournamentRound :matches="rounds.get(round)"></TournamentRound>
    </template>
  </div>

  <Sheet :open="editStage" @update:open="(open) => (editStage = open)">
    <SheetTrigger></SheetTrigger>
    <SheetContent>
      <SheetHeader>
        <SheetTitle>Editing Team</SheetTitle>
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
