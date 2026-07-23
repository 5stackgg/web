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
import { Badge } from "~/components/ui/badge";
import {
  MoreVertical,
  Pencil,
  Trash2,
  Share2,
  ExternalLink,
  Rows3,
  ScrollText,
  Filter,
  ZoomIn,
  ZoomOut,
  Scan,
  Maximize,
  Minimize,
  Plus,
} from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import ManageSection from "~/components/common/ManageSection.vue";
import ShareBracketDialog from "~/components/tournament/ShareBracketDialog.vue";
import BracketFullscreenBar from "~/components/tournament/BracketFullscreenBar.vue";
import { ref } from "vue";
import { e_tournament_status_enum as StatusEnum } from "~/generated/zeus";
import { useBracketView } from "~/composables/useBracketView";

const shareDialogOpen = ref(false);
const viewMode = ref<"split" | "scroll">("split");
const hideFinishedRounds = ref(false);

const {
  MIN_ZOOM,
  MAX_ZOOM,
  autoFit,
  manualZoom,
  isFullscreen,
  fullscreenTarget,
  groupLabel,
  bracketScope,
  zoomIn,
  zoomOut,
  resetZoom,
  toggleFullscreen,
} = useBracketView();

const bracketViewport = ref<HTMLElement | null>(null);

const handleToggleFullscreen = () => {
  fullscreenTarget.value = bracketViewport.value;
  toggleFullscreen();
};

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
        <!-- The stage strip scrolls horizontally rather than wrapping, so the
             trailing "+" always stays inline with the last stage no matter how
             many stages exist. -->
        <div class="mb-2 flex flex-wrap items-start gap-2">
          <TabsList
            class="flex min-w-0 flex-1 flex-nowrap gap-2 overflow-x-auto p-0 pb-1 bg-transparent border-none h-auto justify-start [scrollbar-width:thin]"
          >
            <TabsTrigger
              v-for="stageNumber in maxStageNumber"
              :key="stageNumber"
              :value="`stage-${stageNumber}`"
              class="group/stg relative inline-flex items-center gap-2 !pl-[0.85rem] !pr-3 !py-3 min-w-[200px] min-h-[72px] shrink-0 !h-auto !bg-card/45 !border !border-border !rounded-md !text-muted-foreground font-[inherit] tracking-normal normal-case text-left [transition:border-color_180ms_ease,background_180ms_ease,color_180ms_ease] hover:!border-[hsl(var(--tac-amber)/0.35)] hover:!bg-card/70 data-[state=active]:!border-[hsl(var(--tac-amber)/0.55)] data-[state=active]:!bg-[hsl(var(--tac-amber)/0.08)] data-[state=active]:!text-foreground data-[state=active]:!shadow-none"
            >
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <div
                  class="font-mono text-xl font-bold tabular-nums leading-none text-[hsl(var(--tac-amber)/0.4)] group-data-[state=active]/stg:text-[hsl(var(--tac-amber))]"
                >
                  {{ stageNumber.toString().padStart(2, "0") }}
                </div>
                <div class="flex flex-col gap-[0.1rem] min-w-0 text-left">
                  <span
                    class="block truncate pr-7 font-sans text-[0.85rem] font-semibold tracking-[0.04em] uppercase leading-[1.1]"
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
                      {{
                        $t("tournament.stage.teams_count", {
                          count: getFirstStageForTab(stageNumber).max_teams,
                        })
                      }}
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
                    <MoreVertical class="h-4 w-4" />
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
                      <Pencil />
                      {{ $t("tournament.stage.edit") }}
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      class="text-destructive focus:text-destructive"
                      @click="openDeleteDialog(stageNumber)"
                    >
                      <Trash2 />
                      {{ $t("tournament.stage.delete") }}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </TabsTrigger>
            <!-- Add sits as a compact postfix rather than a full-size tile: at
                 tile size it carried the same weight as a real stage and wrapped
                 onto its own row. -->
            <template v-if="canEditStages">
              <span
                aria-hidden="true"
                class="mx-0.5 h-[56px] w-px shrink-0 self-center border-l border-dashed border-border/70"
              ></span>
              <FiveStackToolTip as-child :delay-duration="120" side="top">
                <template #trigger>
                  <TabsTrigger
                    value="add-stage"
                    :aria-label="$t('tournament.stage.add_another')"
                    class="inline-flex h-[72px] min-h-[72px] w-[56px] shrink-0 items-center justify-center !p-0 !bg-card/45 !border !border-dashed !border-border !rounded-md !text-muted-foreground [transition:border-color_180ms_ease,background_180ms_ease,color_180ms_ease] hover:!border-[hsl(var(--tac-amber)/0.5)] hover:!bg-[hsl(var(--tac-amber)/0.08)] hover:!text-[hsl(var(--tac-amber))] data-[state=active]:!border-[hsl(var(--tac-amber)/0.55)] data-[state=active]:!bg-[hsl(var(--tac-amber)/0.08)] data-[state=active]:!text-[hsl(var(--tac-amber))]"
                  >
                    <Plus class="h-5 w-5" />
                  </TabsTrigger>
                </template>
                {{ $t("tournament.stage.add_another") }}
              </FiveStackToolTip>
            </template>
          </TabsList>
          <div class="ml-auto flex gap-1.5 mt-1 items-center">
            <template v-if="viewMode === 'split'">
              <button
                type="button"
                class="disabled:opacity-40 disabled:cursor-not-allowed"
                :class="iconToggleClass(false)"
                @click="zoomOut"
                :disabled="!autoFit && manualZoom <= MIN_ZOOM"
                :title="$t('ui.tooltips.zoom_out_scroll')"
              >
                <ZoomOut class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="disabled:opacity-40 disabled:cursor-not-allowed"
                :class="iconToggleClass(false)"
                @click="zoomIn"
                :disabled="!autoFit && manualZoom >= MAX_ZOOM"
                :title="$t('ui.tooltips.zoom_in_scroll')"
              >
                <ZoomIn class="h-4 w-4" />
              </button>
              <button
                type="button"
                :class="iconToggleClass(autoFit)"
                @click="resetZoom"
                :title="$t('tournament.bracket.fit_to_view')"
              >
                <Scan class="h-4 w-4" />
              </button>
              <Badge
                variant="outline"
                class="h-9 min-w-[2.5rem] select-none justify-center rounded-md px-2.5 font-mono text-[0.72rem] font-semibold tabular-nums"
                :class="
                  autoFit
                    ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
                    : 'border-border bg-card/40 text-muted-foreground'
                "
              >
                {{
                  autoFit
                    ? $t("tournament.bracket.zoom_fit")
                    : Math.round(manualZoom * 100) + "%"
                }}
              </Badge>
              <div class="mx-1 h-6 w-px bg-border"></div>
            </template>
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
              :class="iconToggleClass(isFullscreen)"
              @click="handleToggleFullscreen"
              :title="
                isFullscreen
                  ? $t('common.exit_fullscreen')
                  : $t('common.enter_fullscreen')
              "
            >
              <component
                :is="isFullscreen ? Minimize : Maximize"
                class="h-4 w-4"
              />
            </button>
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

        <div
          ref="bracketViewport"
          :class="
            isFullscreen
              ? 'relative h-screen w-screen overflow-auto bg-background'
              : ''
          "
        >
          <div
            v-if="isFullscreen"
            class="pointer-events-none fixed inset-0 z-0 [background-image:repeating-linear-gradient(3deg,transparent_0,transparent_3px,hsl(var(--tac-amber)_/_0.04)_3px,hsl(var(--tac-amber)_/_0.04)_4px)]"
            aria-hidden="true"
          ></div>

          <BracketFullscreenBar
            v-if="isFullscreen"
            :tournament-name="tournament.name"
            :stage-number="activeStageNumber"
            :stage-type="
              activeStage?.e_tournament_stage_type?.description ||
              activeStage?.type
            "
            :group-label="groupLabel"
            :bracket-scope="bracketScope"
          />

          <div :class="isFullscreen ? 'relative z-10 px-6 pb-6' : ''">
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
                      tournament.stages.filter(
                        (s: any) => s.order === stageNumber,
                      ).length > 1
                    "
                    class="my-4"
                  ></Separator>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="add-stage" class="mt-6">
              <ManageSection
                class="mx-auto max-w-2xl"
                :label="$t('tournament.stage.add_another')"
              >
                <TournamentStageForm
                  :order="tournament.stages.length + 1"
                  :tournament-id="tournament.id"
                  :tournament="tournament"
                  @updated="handleStageCreated"
                ></TournamentStageForm>
              </ManageSection>
            </TabsContent>
          </div>

          <button
            v-if="isFullscreen"
            type="button"
            class="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-md border border-[hsl(var(--tac-amber)/0.55)] bg-background/90 px-4 py-2.5 font-mono text-[0.72rem] font-bold uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))] shadow-xl backdrop-blur-md transition-colors hover:bg-[hsl(var(--tac-amber)/0.12)]"
            @click="handleToggleFullscreen"
          >
            <Minimize class="h-4 w-4" />
            {{ $t("common.exit_fullscreen") }}
          </button>
        </div>
      </Tabs>

      <!-- Show stages directly without tabs if single stage and not organizer -->
      <div v-else class="space-y-6">
        <div class="flex justify-end gap-1.5 items-center">
          <template v-if="viewMode === 'split'">
            <button
              type="button"
              class="disabled:opacity-40 disabled:cursor-not-allowed"
              :class="iconToggleClass(false)"
              @click="zoomOut"
              :disabled="!autoFit && manualZoom <= MIN_ZOOM"
              :title="$t('ui.tooltips.zoom_out_scroll')"
            >
              <ZoomOut class="h-4 w-4" />
            </button>
            <button
              type="button"
              class="disabled:opacity-40 disabled:cursor-not-allowed"
              :class="iconToggleClass(false)"
              @click="zoomIn"
              :disabled="!autoFit && manualZoom >= MAX_ZOOM"
              :title="$t('ui.tooltips.zoom_in_scroll')"
            >
              <ZoomIn class="h-4 w-4" />
            </button>
            <button
              type="button"
              :class="iconToggleClass(autoFit)"
              @click="resetZoom"
              :title="$t('tournament.bracket.fit_to_view')"
            >
              <Scan class="h-4 w-4" />
            </button>
            <Badge
              variant="outline"
              class="h-9 min-w-[2.5rem] select-none justify-center rounded-md px-2.5 font-mono text-[0.72rem] font-semibold tabular-nums"
              :class="
                autoFit
                  ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
                  : 'border-border bg-card/40 text-muted-foreground'
              "
            >
              {{
                autoFit
                  ? $t("tournament.bracket.zoom_fit")
                  : Math.round(manualZoom * 100) + "%"
              }}
            </Badge>
            <div class="mx-1 h-6 w-px bg-border"></div>
          </template>
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
            :class="iconToggleClass(isFullscreen)"
            @click="handleToggleFullscreen"
            :title="
              isFullscreen
                ? $t('common.exit_fullscreen')
                : $t('common.enter_fullscreen')
            "
          >
            <component
              :is="isFullscreen ? Minimize : Maximize"
              class="h-4 w-4"
            />
          </button>
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
          ref="bracketViewport"
          :class="
            isFullscreen
              ? 'relative h-screen w-screen overflow-auto bg-background'
              : ''
          "
        >
          <div
            v-if="isFullscreen"
            class="pointer-events-none fixed inset-0 z-0 [background-image:repeating-linear-gradient(3deg,transparent_0,transparent_3px,hsl(var(--tac-amber)_/_0.04)_3px,hsl(var(--tac-amber)_/_0.04)_4px)]"
            aria-hidden="true"
          ></div>

          <BracketFullscreenBar
            v-if="isFullscreen"
            :tournament-name="tournament.name"
            :stage-number="1"
            :stage-type="
              firstStage?.e_tournament_stage_type?.description ||
              firstStage?.type
            "
            :group-label="groupLabel"
            :bracket-scope="bracketScope"
          />

          <div :class="isFullscreen ? 'relative z-10 px-6 pb-6' : ''">
            <div
              v-for="stage of tournament.stages.filter(
                (s: any) => s.order === 1,
              )"
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

          <button
            v-if="isFullscreen"
            type="button"
            class="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-md border border-[hsl(var(--tac-amber)/0.55)] bg-background/90 px-4 py-2.5 font-mono text-[0.72rem] font-bold uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))] shadow-xl backdrop-blur-md transition-colors hover:bg-[hsl(var(--tac-amber)/0.12)]"
            @click="handleToggleFullscreen"
          >
            <Minimize class="h-4 w-4" />
            {{ $t("common.exit_fullscreen") }}
          </button>
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
          class="flex flex-col gap-0 w-full sm:max-w-2xl lg:max-w-4xl"
        >
          <SheetHeader>
            <SheetTitle>{{ $t("tournament.stage.edit_title") }}</SheetTitle>
            <SheetDescription class="sr-only">
              {{ $t("tournament.stage.edit_title") }}
            </SheetDescription>
          </SheetHeader>
          <div class="-mx-4 mt-4 flex-1 overflow-y-auto px-4">
            <TournamentStageForm
              v-if="getFirstStageForTab(stageNumber)"
              :stage="getFirstStageForTab(stageNumber)"
              :order="stageNumber"
              :tournament="tournament"
              @updated="editStageDialogs[stageNumber] = false"
            ></TournamentStageForm>
          </div>
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
    activeStageNumber() {
      const parsed = parseInt(String(this.activeTab).replace("stage-", ""), 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    },
    activeStage() {
      return this.getFirstStageForTab(this.activeStageNumber);
    },
    firstStage() {
      return this.getFirstStageForTab(1);
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
