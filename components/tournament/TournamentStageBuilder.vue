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
} from "~/components/ui/sheet";
</script>

<template>
  <div class="space-y-6">
    <!-- Display stages organized by stage number in tabs -->
    <div v-if="tournament.stages.length > 0">
      <!-- Show tabs only if multiple stages OR user is organizer -->
      <Tabs
        v-if="shouldShowTabs"
        v-model="activeTab"
        default-value="stage-1"
        class="w-full"
      >
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
              <div
                v-if="getFirstStageForTab(stageNumber)"
                class="text-xs text-muted-foreground flex gap-2 mt-0.5"
              >
                <span v-if="getBestOf(getFirstStageForTab(stageNumber))">
                  BO{{ getBestOf(getFirstStageForTab(stageNumber)) }}
                </span>
                <span v-if="getFirstStageForTab(stageNumber)?.max_teams">
                  {{ getFirstStageForTab(stageNumber).max_teams }} teams
                </span>
              </div>
            </div>
            <DropdownMenu
              v-if="canEditStages && getFirstStageForTab(stageNumber)"
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
                    @click="openDeleteDialog(stageNumber)"
                  >
                    <Trash class="mr-2 h-4 w-4 inline" />
                    {{ $t("tournament.stage.delete") }}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </TabsTrigger>
          <TabsTrigger value="add-stage" class="text-sm" v-if="canEditStages">
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
                :tournament="tournament"
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
          <Card class="p-4 max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>
                {{ $t("tournament.stage.add_another") }}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TournamentStageForm
                :order="tournament.stages.length + 1"
                :tournament-id="tournament.id"
                :tournament="tournament"
                @updated="handleStageCreated"
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
            :tournament="tournament"
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
        <SheetContent
          side="right"
          class="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>{{ $t("tournament.stage.edit_title") }}</SheetTitle>
            <SheetDescription>
              <TournamentStageForm
                v-if="getFirstStageForTab(stageNumber)"
                :stage="getFirstStageForTab(stageNumber)"
                :order="stageNumber"
                :tournament-id="tournament.id"
                :tournament="tournament"
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
        :open="!!deleteAlertDialogs[stageNumber]"
        @update:open="(open) => (deleteAlertDialogs[stageNumber] = open)"
      >
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
            <AlertDialogCancel @click="deleteAlertDialogs[stageNumber] = false">
              {{ $t("common.cancel") }}
            </AlertDialogCancel>
            <AlertDialogAction
              @click="confirmDeleteStage(stageNumber)"
              class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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

      <Card class="p-4 max-w-2xl mx-auto" v-if="tournament.stages.length === 0">
        <h2 class="text-xl font-semibold mb-4">
          {{ $t("tournament.stage.add_first") }}
        </h2>
        <TournamentStageForm
          :tournament="tournament"
          :order="tournament.stages.length + 1"
          @updated="handleStageCreated"
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
import { toast } from "@/components/ui/toast";

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
      activeTab: "stage-1",
    };
  },
  computed: {
    maxStageNumber() {
      if (!this.tournament.stages?.length) return 0;
      return Math.max(...this.tournament.stages.map((s: any) => s.order || 1));
    },
    shouldShowTabs() {
      return this.maxStageNumber > 1 || this.canEditStages;
    },
    canEditStages() {
      return (
        this.tournament.is_organizer &&
        this.tournament.status !== e_tournament_status_enum.Live &&
        this.tournament.status !== e_tournament_status_enum.Finished
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
    getBestOf(stage: any) {
      if (!stage) return null;
      // Get best_of from stage options, or fall back to tournament defaults
      if (stage.options?.best_of) {
        return stage.options.best_of;
      }
      if (this.tournament?.options?.best_of) {
        return this.tournament.options.best_of;
      }
      return null;
    },
    openDeleteDialog(stageNumber: number) {
      this.stageMenus[stageNumber] = false;
      this.deleteAlertDialogs[stageNumber] = true;
    },
    async confirmDeleteStage(stageNumber: number) {
      const stage = this.getFirstStageForTab(stageNumber);
      if (!stage) {
        this.deleteAlertDialogs[stageNumber] = false;
        return;
      }

      try {
        await this.deleteStage(stage);
        toast({
          title: this.$t("tournament.stage.deleted"),
        });
        this.deleteAlertDialogs[stageNumber] = false;
        // Switch to the first stage tab after deletion
        this.activeTab = "stage-1";
      } catch (error) {
        console.error("Failed to delete stage:", error);
        toast({
          title: this.$t("tournament.stage.delete_failed"),
          variant: "destructive",
        });
        // Keep dialog open on error so user can try again
      }
    },
    async deleteStage(stage: any) {
      if (!stage) return;
      await (this as any).$apollo.mutate({
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
    handleStageCreated(order?: number) {
      // Switch to the newly created stage tab if order is provided
      if (order) {
        this.activeTab = `stage-${order}`;
      }
    },
  },
};
</script>
