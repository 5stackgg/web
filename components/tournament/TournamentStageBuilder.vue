<script lang="ts" setup>
import TournamentStage from "~/components/tournament/TournamentStage.vue";
import TournamentStageForm from "~/components/tournament/TournamentStageForm.vue";
import Separator from "../ui/separator/Separator.vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { e_tournament_status_enum } from "~/generated/zeus";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
</script>

<template>
  <div class="space-y-6">
    <!-- Display stages organized by stage number in tabs -->
    <div v-if="tournament.stages.length > 0">
      <!-- Show tabs only if multiple stages OR user is organizer -->
      <Tabs v-if="shouldShowTabs" default-value="stage-1" class="w-full">
        <TabsList
          :style="{ gridTemplateColumns: `repeat(${maxStageNumber}, 1fr)` }"
        >
          <TabsTrigger
            v-for="stageNumber in maxStageNumber"
            :key="stageNumber"
            :value="`stage-${stageNumber}`"
            class="text-sm w-full [&>span]:!flex [&>span]:!items-center [&>span]:!justify-between [&>span]:!w-full [&>span]:gap-2 [&>span]:!whitespace-normal"
          >
            <div class="flex flex-col items-start">
              <span>{{
                $t("tournament.stage.stage_tab", { stage: stageNumber })
              }}</span>
              <span
                v-if="getFirstStageForTab(stageNumber)"
                class="text-xs text-muted-foreground"
              >
                {{
                  getFirstStageForTab(stageNumber)?.e_tournament_stage_type
                    .description
                }}
              </span>
            </div>
            <DropdownMenu
              v-if="
                tournament.is_organizer &&
                tournament.status === e_tournament_status_enum.Setup &&
                getFirstStageForTab(stageNumber)
              "
              v-model:open="stageMenus[stageNumber]"
              @click.stop
            >
              <DropdownMenuTrigger as-child @click.stop>
                <Button
                  variant="secondary"
                  size="sm"
                  @click.stop
                  class="h-8 shrink-0"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-[200px]">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    @click="
                      editStageDialogs[stageNumber] = true;
                      stageMenus[stageNumber] = false;
                    "
                  >
                    {{ $t("tournament.stage.edit") }}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    class="text-red-600"
                    @click="
                      deleteAlertDialogs[stageNumber] = true;
                      stageMenus[stageNumber] = false;
                    "
                  >
                    <Trash class="mr-2 h-4 w-4 inline" />
                    {{ $t("tournament.stage.delete") }}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </TabsTrigger>
          <TabsTrigger
            value="add-stage"
            class="text-sm"
            v-if="
              tournament.is_organizer &&
              tournament.status === e_tournament_status_enum.Setup
            "
          >
            {{ $t("tournament.stage.add_another") }}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          v-for="stageNumber in maxStageNumber"
          :key="stageNumber"
          :value="`stage-${stageNumber}`"
          class="mt-6"
        >
          <div class="space-y-6">
            <div
              v-for="stage of tournament.stages.filter(
                (s: any) => s.order === stageNumber,
              )"
              :key="stage.id"
              class="mb-4"
            >
              <TournamentStage
                :stage="stage"
                :is-final-stage="stageNumber === maxStageNumber"
              ></TournamentStage>
              <Separator
                v-if="
                  tournament.stages.filter((s: any) => s.order === stageNumber)
                    .length > 1
                "
                class="my-4"
              ></Separator>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="add-stage" class="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {{ $t("tournament.stage.add_another") }}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TournamentStageForm
                :order="tournament.stages.length + 1"
              ></TournamentStageForm>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <!-- Show stages directly without tabs if single stage and not organizer -->
      <div v-else class="space-y-6">
        <div
          v-for="stage of tournament.stages.filter((s: any) => s.order === 1)"
          :key="stage.id"
          class="mb-4"
        >
          <TournamentStage
            :stage="stage"
            :is-final-stage="true"
          ></TournamentStage>
        </div>
      </div>

      <!-- Edit Stage Sheets -->
      <Sheet
        v-for="stageNumber in maxStageNumber"
        :key="`edit-${stageNumber}`"
        :open="editStageDialogs[stageNumber]"
        @update:open="(open) => (editStageDialogs[stageNumber] = open)"
      >
        <SheetTrigger></SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{{ $t("tournament.stage.edit_title") }}</SheetTitle>
            <SheetDescription>
              <TournamentStageForm
                v-if="getFirstStageForTab(stageNumber)"
                :stage="getFirstStageForTab(stageNumber)"
                :order="stageNumber"
                @updated="editStageDialogs[stageNumber] = false"
              ></TournamentStageForm>
            </SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>

      <!-- Delete Stage Dialogs -->
      <AlertDialog
        v-for="stageNumber in maxStageNumber"
        :key="`delete-${stageNumber}`"
        :open="deleteAlertDialogs[stageNumber]"
        @update:open="(open) => (deleteAlertDialogs[stageNumber] = open)"
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
            <AlertDialogAction
              @click="
                deleteStage(getFirstStageForTab(stageNumber));
                deleteAlertDialogs[stageNumber] = false;
              "
            >
              {{ $t("common.confirm") }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

    <template v-if="tournament.is_organizer">
      <div v-if="tournament.stages.length === 0" class="text-center p-8">
        <h2 class="text-2xl font-bold mb-4">
          {{ $t("tournament.stage.no_stages") }}
        </h2>
        <p class="text-gray-600 mb-6">
          {{ $t("tournament.stage.start_building") }}
        </p>
      </div>

      <Card class="p-4 max-w-md mx-auto" v-if="tournament.stages.length === 0">
        <h2 class="text-xl font-semibold mb-4">
          {{ $t("tournament.stage.add_first") }}
        </h2>
        <TournamentStageForm
          :order="tournament.stages.length + 1"
        ></TournamentStageForm>
      </Card>
    </template>
    <template v-else>
      <div v-if="tournament.stages.length === 0" class="text-center p-8">
        <h2 class="text-2xl font-bold mb-4">
          {{ $t("tournament.stage.not_setup") }}
        </h2>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    tournament: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      stageMenus: {} as Record<number, boolean>,
      editStageDialogs: {} as Record<number, boolean>,
      deleteAlertDialogs: {} as Record<number, boolean>,
    };
  },
  computed: {
    maxStageNumber() {
      if (!this.tournament.stages?.length) return 0;
      return Math.max(...this.tournament.stages.map((s: any) => s.order || 1));
    },
    shouldShowTabs() {
      return (
        this.maxStageNumber > 1 ||
        (this.tournament.is_organizer &&
          this.tournament.status === e_tournament_status_enum.Setup)
      );
    },
  },
  methods: {
    getFirstStageForTab(stageNumber: number) {
      const stages = this.tournament.stages.filter(
        (s: any) => s.order === stageNumber,
      );
      return stages.length > 0 ? stages[0] : null;
    },
    async deleteStage(stage: any) {
      if (!stage) return;
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_tournament_stages_by_pk: [
            {
              id: stage.id,
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
