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
import {
  MoreHorizontal,
  Trash,
  Share2,
  ExternalLink,
  Rows3,
  ScrollText,
  Filter,
} from "lucide-vue-next";
import ShareBracketDialog from "~/components/tournament/ShareBracketDialog.vue";
import { ref } from "vue";
import { e_tournament_status_enum as StatusEnum } from "~/generated/zeus";

const shareDialogOpen = ref(false);
const viewMode = ref<"split" | "scroll">("split");
const hideFinishedRounds = ref(false);

const toggleViewMode = () => {
  viewMode.value = viewMode.value === "split" ? "scroll" : "split";
};

const toggleHideFinished = () => {
  hideFinishedRounds.value = !hideFinishedRounds.value;
};

const iconToggleClass = (active: boolean) =>
  [
    "inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
    active
      ? "border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]"
      : "border-border bg-card/40 text-muted-foreground hover:border-[hsl(var(--tac-amber)/0.45)] hover:text-foreground",
  ].join(" ");

const popoutBracket = (tournamentId: string) => {
  if (typeof window === "undefined") return;
  window.open(
    `${window.location.origin}/embed/tournaments/${tournamentId}/bracket?stage=current`,
    `tournament-bracket-${tournamentId}`,
    "width=1280,height=720,menubar=no,toolbar=no,location=no",
  );
};
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
        <div class="flex flex-wrap items-start gap-2 justify-between mb-2">
          <TabsList
            class="flex flex-wrap gap-2 p-0 bg-transparent border-none h-auto flex-1 justify-start"
          >
            <TabsTrigger
              v-for="stageNumber in maxStageNumber"
              :key="stageNumber"
              :value="`stage-${stageNumber}`"
              class="group/stg relative inline-flex items-center gap-2 !pl-[0.85rem] !pr-9 !py-3 min-w-[220px] min-h-[72px] !h-auto !bg-card/45 !border !border-border !rounded-md !text-muted-foreground font-[inherit] tracking-normal normal-case text-left [transition:border-color_180ms_ease,background_180ms_ease,color_180ms_ease] hover:!border-[hsl(var(--tac-amber)/0.35)] hover:!bg-card/70 data-[state=active]:!border-[hsl(var(--tac-amber)/0.55)] data-[state=active]:!bg-[hsl(var(--tac-amber)/0.08)] data-[state=active]:!text-foreground data-[state=active]:!shadow-none"
            >
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <div
                  class="font-mono text-xl font-bold tabular-nums leading-none text-[hsl(var(--tac-amber)/0.4)] group-data-[state=active]/stg:text-[hsl(var(--tac-amber))]"
                >
                  {{ stageNumber.toString().padStart(2, "0") }}
                </div>
                <div class="flex flex-col gap-[0.1rem] min-w-0 text-left">
                  <span
                    class="font-sans text-[0.85rem] font-semibold tracking-[0.04em] uppercase leading-[1.1]"
                    >{{
                      $t("tournament.stage.stage_tab", { stage: stageNumber })
                    }}</span
                  >
                  <span
                    v-if="getFirstStageForTab(stageNumber)"
                    class="text-[0.72rem] text-muted-foreground inline-flex gap-[0.3rem] flex-wrap items-center"
                  >
                    {{
                      getFirstStageForTab(stageNumber)?.e_tournament_stage_type
                        .description
                    }}
                    <template
                      v-if="getBestOf(getFirstStageForTab(stageNumber))"
                    >
                      ·
                      <span
                        class="font-mono tracking-[0.08em] text-[hsl(var(--tac-amber))]"
                      >
                        BO{{ getBestOf(getFirstStageForTab(stageNumber)) }}
                      </span>
                    </template>
                    <template
                      v-if="getFirstStageForTab(stageNumber)?.max_teams"
                    >
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
                    class="!absolute top-[0.3rem] right-[0.3rem] opacity-55 transition-opacity [transition-duration:160ms] group-hover/stg:opacity-100 group-data-[state=active]/stg:opacity-100 h-7 w-7 shrink-0"
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
              class="inline-flex items-center justify-center gap-2 min-w-[200px] min-h-[72px] !px-4 !py-3 !bg-card/45 !border !border-dashed !border-border !rounded-md !text-muted-foreground font-mono text-[0.72rem] font-bold tracking-[0.18em] uppercase [transition:border-color_180ms_ease,background_180ms_ease,color_180ms_ease] hover:!border-[hsl(var(--tac-amber)/0.5)] hover:!text-[hsl(var(--tac-amber))]"
              v-if="canEditStages"
            >
              <span class="text-base font-normal leading-none mr-[0.35rem]"
                >+</span
              >
              <span>
                {{ $t("tournament.stage.add_another") }}
              </span>
            </TabsTrigger>
          </TabsList>
          <div class="flex gap-1.5 mt-1 items-center">
            <button
              type="button"
              :class="iconToggleClass(viewMode === 'scroll')"
              @click="toggleViewMode"
              :title="
                viewMode === 'scroll'
                  ? $t('tournament.bracket.view_scroll')
                  : $t('tournament.bracket.view_split')
              "
            >
              <component
                :is="viewMode === 'scroll' ? ScrollText : Rows3"
                class="h-4 w-4"
              />
            </button>
            <button
              v-if="isTournamentLive"
              type="button"
              :class="iconToggleClass(hideFinishedRounds)"
              @click="toggleHideFinished"
              :title="$t('tournament.bracket.hide_finished')"
            >
              <Filter class="h-4 w-4" />
            </button>
            <div class="mx-1 h-6 w-px bg-border"></div>
            <button
              type="button"
              :class="iconToggleClass(false)"
              @click="popoutBracket(tournament.id)"
              :title="$t('tournament.bracket.popout_button')"
            >
              <ExternalLink class="h-4 w-4" />
            </button>
            <button
              type="button"
              :class="iconToggleClass(false)"
              @click="shareDialogOpen = true"
              :title="$t('tournament.bracket.share_button')"
            >
              <Share2 class="h-4 w-4" />
            </button>
          </div>
        </div>

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
                :view-mode="viewMode"
                :hide-finished-rounds="hideFinishedRounds"
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
        <div class="flex justify-end gap-1.5 items-center">
          <button
            type="button"
            :class="iconToggleClass(viewMode === 'scroll')"
            @click="toggleViewMode"
            :title="
              viewMode === 'scroll'
                ? $t('tournament.bracket.view_scroll')
                : $t('tournament.bracket.view_split')
            "
          >
            <component
              :is="viewMode === 'scroll' ? ScrollText : Rows3"
              class="h-4 w-4"
            />
          </button>
          <button
            v-if="isTournamentLive"
            type="button"
            :class="iconToggleClass(hideFinishedRounds)"
            @click="toggleHideFinished"
            :title="$t('tournament.bracket.hide_finished')"
          >
            <Filter class="h-4 w-4" />
          </button>
          <div class="mx-1 h-6 w-px bg-border"></div>
          <button
            type="button"
            :class="iconToggleClass(false)"
            @click="popoutBracket(tournament.id)"
            :title="$t('tournament.bracket.popout_button')"
          >
            <ExternalLink class="h-4 w-4" />
          </button>
          <button
            type="button"
            :class="iconToggleClass(false)"
            @click="shareDialogOpen = true"
            :title="$t('tournament.bracket.share_button')"
          >
            <Share2 class="h-4 w-4" />
          </button>
        </div>
        <div
          v-for="stage of tournament.stages.filter((s: any) => s.order === 1)"
          :key="stage.id"
          class="mb-4"
        >
          <TournamentStage
            :stage="stage"
            :tournament="tournament"
            :is-final-stage="true"
            :view-mode="viewMode"
            :hide-finished-rounds="hideFinishedRounds"
          ></TournamentStage>
        </div>
      </div>

      <ShareBracketDialog
        :open="shareDialogOpen"
        :tournament="tournament"
        @update:open="(v) => (shareDialogOpen = v)"
      />

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
    isTournamentLive() {
      return (
        this.tournament.status === e_tournament_status_enum.Live ||
        this.tournament.status === e_tournament_status_enum.Paused
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
