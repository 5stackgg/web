<script lang="ts" setup>
import TournamentStage from "~/components/tournament/TournamentStage.vue";
import TournamentStageForm from "~/components/tournament/TournamentStageForm.vue";
import Separator from "../ui/separator/Separator.vue";
import { Card } from "~/components/ui/card";
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
        <TabsList class="stage-tabs__list">
          <TabsTrigger
            v-for="stageNumber in maxStageNumber"
            :key="stageNumber"
            :value="`stage-${stageNumber}`"
            class="stage-tabs__trigger"
          >
            <div class="stage-tabs__trigger-body">
              <div class="stage-tabs__trigger-number">
                {{
                  stageNumber.toString().padStart(2, "0")
                }}
              </div>
              <div class="stage-tabs__trigger-info">
                <span class="stage-tabs__trigger-name">{{
                  $t("tournament.stage.stage_tab", { stage: stageNumber })
                }}</span>
                <span
                  v-if="getFirstStageForTab(stageNumber)"
                  class="stage-tabs__trigger-meta"
                >
                  {{
                    getFirstStageForTab(stageNumber)?.e_tournament_stage_type
                      .description
                  }}
                  <template v-if="getBestOf(getFirstStageForTab(stageNumber))">
                    ·
                    <span class="stage-tabs__trigger-tag">
                      BO{{ getBestOf(getFirstStageForTab(stageNumber)) }}
                    </span>
                  </template>
                  <template v-if="getFirstStageForTab(stageNumber)?.max_teams">
                    ·
                    {{ getFirstStageForTab(stageNumber).max_teams }} teams
                  </template>
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
                  variant="ghost"
                  size="icon"
                  @click.stop
                  class="stage-tabs__menu-btn h-7 w-7 shrink-0"
                >
                  <MoreHorizontal class="h-4 w-4" />
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
          <TabsTrigger
            value="add-stage"
            class="stage-tabs__trigger stage-tabs__trigger--add"
            v-if="canEditStages"
          >
            <span class="stage-tabs__add-icon">+</span>
            <span class="stage-tabs__add-label">
              {{ $t("tournament.stage.add_another") }}
            </span>
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
          <Card
            class="bg-gradient-to-br from-muted/50 to-muted/30 border-border/50 p-4 max-w-2xl mx-auto"
          >
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
      <Card
        class="bg-gradient-to-br from-muted/50 to-muted/30 border-border/50 p-4 max-w-2xl mx-auto"
        v-if="tournament.stages.length === 0"
      >
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
      if (stage.default_best_of) {
        return stage.default_best_of;
      }
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

<style scoped>
.stage-tabs__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0;
  background: transparent;
  border: none;
  height: auto;
  width: 100%;
  justify-content: flex-start;
}

.stage-tabs__trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 2.25rem 0.75rem 0.85rem !important;
  min-width: 220px;
  min-height: 72px;
  height: auto !important;
  background: hsl(var(--card) / 0.45) !important;
  border: 1px solid hsl(var(--border)) !important;
  border-radius: 0.375rem !important;
  color: hsl(var(--muted-foreground)) !important;
  font-family: inherit;
  letter-spacing: 0;
  text-transform: none;
  text-align: left;
  transition:
    border-color 180ms ease,
    background 180ms ease,
    color 180ms ease;
}
.stage-tabs__trigger:hover {
  border-color: hsl(var(--tac-amber) / 0.35) !important;
  background: hsl(var(--card) / 0.7) !important;
}
.stage-tabs__trigger[data-state="active"] {
  border-color: hsl(var(--tac-amber) / 0.55) !important;
  background: hsl(var(--tac-amber) / 0.08) !important;
  color: hsl(var(--foreground)) !important;
  box-shadow: none !important;
}

.stage-tabs__trigger-body {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}
.stage-tabs__trigger-number {
  font-family: "Oxanium", monospace;
  font-size: 1.25rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--tac-amber) / 0.4);
  line-height: 1;
}
.stage-tabs__trigger[data-state="active"] .stage-tabs__trigger-number {
  color: hsl(var(--tac-amber));
}
.stage-tabs__trigger-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  text-align: left;
}
.stage-tabs__trigger-name {
  font-family: "Oxanium", sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.1;
}
.stage-tabs__trigger-meta {
  font-size: 0.72rem;
  color: hsl(var(--muted-foreground));
  display: inline-flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  align-items: center;
}
.stage-tabs__trigger-tag {
  font-family: "Oxanium", monospace;
  letter-spacing: 0.08em;
  color: hsl(var(--tac-amber));
}

.stage-tabs__trigger--add {
  min-width: 200px;
  min-height: 72px;
  font-family: "Oxanium", monospace;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  border-style: dashed !important;
  padding: 0.75rem 1rem !important;
  justify-content: center;
}
.stage-tabs__trigger--add:hover {
  color: hsl(var(--tac-amber)) !important;
  border-color: hsl(var(--tac-amber) / 0.5) !important;
}
.stage-tabs__add-icon {
  font-size: 1rem;
  font-weight: 400;
  line-height: 1;
  margin-right: 0.35rem;
}

.stage-tabs__menu-btn {
  position: absolute !important;
  top: 0.3rem;
  right: 0.3rem;
  opacity: 0.55;
  transition: opacity 160ms ease;
}
.stage-tabs__trigger:hover .stage-tabs__menu-btn,
.stage-tabs__trigger[data-state="active"] .stage-tabs__menu-btn {
  opacity: 1;
}
</style>
