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
      <div class="flex items-center space-x-2">
        <Badge class="text-sm">{{
          stage.e_tournament_stage_type.description
        }}</Badge>
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
          <DropdownMenuItem @click="editStage = true">{{
            $t("tournament.stage.edit")
          }}</DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            class="text-red-600"
            @click="deleteAlertDialog = true"
          >
            <Trash class="mr-2 h-4 w-4 inline" />
            {{ $t("tournament.stage.delete") }}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </h1>

  <!-- Loop through groups -->
  <div v-for="groupNumber in stage.groups" :key="groupNumber" class="mb-8">
    <h3 class="text-lg font-semibold mb-4" v-if="stage.groups > 1">
      {{
        $t("tournament.stage.group", { group: getGroupDisplay(groupNumber) })
      }}
    </h3>
    <TournamentBracketViewer
      :rounds="getRoundsForGroup(groupNumber)"
      :is-final-stage="isFinalStage"
    ></TournamentBracketViewer>
  </div>

  <Sheet :open="editStage" @update:open="(open) => (editStage = open)">
    <SheetTrigger></SheetTrigger>
    <SheetContent>
      <SheetHeader>
        <SheetTitle>{{ $t("tournament.stage.edit_title") }}</SheetTitle>
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
        <AlertDialogTitle>{{
          $t("tournament.stage.confirm_delete")
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("tournament.stage.delete_description") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
        <AlertDialogAction @click="deleteStage">{{
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
    stage: {
      type: Object,
      required: true,
    },
    isFinalStage: {
      type: Boolean,
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
    getRoundsForGroup() {
      return (groupNumber: number) => {
        const rounds = new Map();
        for (const match of this.stage?.brackets) {
          if (match.group == groupNumber) {
            const matches = rounds.get(match.round) || [];
            matches.push(match);
            rounds.set(match.round, matches);
          }
        }
        return rounds;
      };
    },
    getGroupDisplay() {
      return (groupNumber: number) => {
        // If we have 26 or fewer groups, use letters a-z
        if (this.stage.groups <= 26) {
          return String.fromCharCode(96 + groupNumber).toUpperCase();
        }
        // Otherwise use the original number
        return groupNumber;
      };
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
