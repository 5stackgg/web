<script lang="ts" setup>
import TimeAgo from "@/components/TimeAgo.vue";
import {
  Edit2,
  Trash2,
  Calendar as CalendarIcon,
  AlertTriangle,
  ExternalLink,
  Ban,
  MicOff,
  MessageSquareOff,
  VolumeX,
  Clock,
  Infinity as InfinityIcon,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
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
import { Calendar } from "~/components/ui/calendar";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import Pagination from "~/components/Pagination.vue";
import { fromDate, toCalendarDate } from "@internationalized/date";
</script>

<template>
  <div v-if="hasAnyData">
    <Sheet :open="sheetOpen" @update:open="sheetOpen = $event">
      <SheetTrigger as-child>
        <Button
          variant="ghost"
          size="sm"
          class="flex items-center gap-1.5 h-auto py-1 px-2 text-sm"
          :class="{
            'text-destructive hover:text-destructive': activeSanctions > 0,
          }"
        >
          <AlertTriangle class="h-3.5 w-3.5" />
          <span>{{ $t("player.sanctions.title") }}</span>
          <Badge
            v-if="activeSanctions > 0"
            variant="destructive"
            class="ml-0.5 h-4 px-1.5 text-xs"
          >
            {{ activeSanctions }}
          </Badge>
          <Badge
            v-else-if="sanctions.length > 0 || abandonedMatchesCount > 0"
            variant="secondary"
            class="ml-0.5 h-4 px-1.5 text-xs"
          >
            {{ totalCount }}
          </Badge>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{{ $t("player.sanctions.title") }}</SheetTitle>
        </SheetHeader>
        <Tabs default-value="sanctions" class="mt-6">
          <TabsList
            :class="[
              'grid w-full',
              abandonedMatchesCount > 0 ? 'grid-cols-2' : 'grid-cols-1',
            ]"
          >
            <TabsTrigger value="sanctions" class="flex items-center gap-2">
              {{ $t("player.sanctions.sanctions") }}
              <Badge
                v-if="sanctions.length > 0"
                variant="secondary"
                class="ml-1"
              >
                {{ sanctions.length }}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              v-if="abandonedMatchesCount > 0"
              value="abandoned"
              class="flex items-center gap-2"
            >
              {{ $t("player.sanctions.abandoned_matches") }}
              <Badge variant="secondary" class="ml-1">
                {{ abandonedMatchesCount }}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sanctions" class="mt-4">
            <div
              v-if="!sanctions || sanctions.length === 0"
              class="text-center py-8 text-muted-foreground"
            >
              {{ $t("player.sanctions.no_sanctions") }}
            </div>
            <div v-else class="flex flex-col gap-3">
              <div
                v-for="sanction in sanctions"
                :key="sanction.id"
                class="relative overflow-hidden rounded-lg border border-border bg-card/40"
                :class="{ 'opacity-70': isExpired(sanction) }"
              >
                <span
                  class="absolute inset-y-0 left-0 w-1"
                  :class="accentBarClass(sanction)"
                />
                <div class="p-4 pl-5 space-y-3">
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <Ban
                        v-if="sanction.type === 'ban'"
                        class="h-4 w-4 shrink-0"
                        :class="accentTextClass(sanction)"
                      />
                      <MicOff
                        v-else-if="sanction.type === 'mute'"
                        class="h-4 w-4 shrink-0"
                        :class="accentTextClass(sanction)"
                      />
                      <MessageSquareOff
                        v-else-if="sanction.type === 'gag'"
                        class="h-4 w-4 shrink-0"
                        :class="accentTextClass(sanction)"
                      />
                      <VolumeX
                        v-else
                        class="h-4 w-4 shrink-0"
                        :class="accentTextClass(sanction)"
                      />
                      <div class="min-w-0 space-y-0.5">
                        <div class="flex items-center gap-2">
                          <span
                            class="text-sm font-semibold uppercase tracking-wider"
                          >
                            {{ sanction.type }}
                          </span>
                          <span
                            class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                            :class="statusPillClass(sanction)"
                          >
                            {{
                              isExpired(sanction)
                                ? $t("player.sanctions.expired")
                                : $t("player.sanctions.active")
                            }}
                          </span>
                        </div>
                        <p
                          class="text-xs text-muted-foreground flex items-center gap-1"
                        >
                          {{ $t("player.sanctions.issued") }}
                          <TimeAgo :date="sanction.created_at" />
                        </p>
                      </div>
                    </div>
                    <div
                      v-if="canManageSanctions"
                      class="flex gap-1 items-center shrink-0"
                    >
                      <TooltipProvider v-if="!isExpired(sanction)">
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button
                              variant="ghost"
                              size="icon"
                              class="h-7 w-7"
                              @click="openEditDialog(sanction)"
                            >
                              <Edit2 class="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {{ $t("player.sanctions.edit") }}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button
                              variant="ghost"
                              size="icon"
                              class="h-7 w-7 text-destructive hover:text-destructive"
                              @click="removeSanction(sanction)"
                            >
                              <Trash2 class="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {{ $t("player.sanctions.remove") }}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  <p
                    v-if="sanction.reason"
                    class="text-sm text-muted-foreground leading-relaxed border-l-2 border-border/60 pl-3"
                  >
                    {{ sanction.reason }}
                  </p>

                  <div
                    class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs"
                  >
                    <span
                      v-if="!sanction.remove_sanction_date"
                      class="inline-flex items-center gap-1.5 text-muted-foreground"
                    >
                      <InfinityIcon class="h-3.5 w-3.5" />
                      {{ $t("player.sanctions.permanent") }}
                    </span>
                    <span
                      v-else
                      class="inline-flex items-center gap-1.5 text-muted-foreground"
                    >
                      <Clock class="h-3.5 w-3.5" />
                      {{
                        isExpired(sanction)
                          ? $t("player.sanctions.expired_on")
                          : $t("player.sanctions.expires")
                      }}
                      <TimeAgo :date="sanction.remove_sanction_date" />
                    </span>
                    <a
                      v-if="isAutoSteamBan(sanction)"
                      :href="steamProfileUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <ExternalLink class="h-3.5 w-3.5" />
                      {{ $t("player.sanctions.view_steam") }}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="abandoned"
            class="mt-4"
            v-if="abandonedMatchesCount > 0"
          >
            <div class="flex flex-col gap-2">
              <div
                v-for="(abandonedMatch, index) in displayedAbandonedMatches"
                :key="abandonedMatch.id"
              >
                <div class="flex items-center justify-between py-2">
                  <div class="flex flex-col gap-1 flex-1">
                    <NuxtLink
                      :to="{
                        name: 'matches-id',
                        params: { id: abandonedMatch.id },
                      }"
                      class="text-sm font-medium hover:underline text-primary"
                    >
                      {{ $t("player.sanctions.match") }}
                      {{ abandonedMatch.id.slice(0, 8) }}
                    </NuxtLink>
                    <div
                      class="text-xs text-muted-foreground flex items-center gap-2"
                    >
                      <TimeAgo :date="abandonedMatch.abandoned_at" />
                    </div>
                  </div>
                  <div
                    v-if="canManageSanctions"
                    class="flex gap-2 items-center"
                  >
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <Button
                            variant="ghost"
                            size="icon"
                            class="h-8 w-8 text-destructive"
                            @click="removeAbandonedMatch(abandonedMatch)"
                          >
                            <Trash2 class="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {{ $t("player.sanctions.remove_abandoned") }}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <Separator
                  v-if="index < displayedAbandonedMatches.length - 1"
                  class="my-1"
                />
              </div>
            </div>
            <div
              v-if="abandonedMatches.length > itemsPerPage"
              class="mt-4 flex justify-center"
            >
              <Pagination
                :page="abandonedMatchesPage"
                :items-per-page="itemsPerPage"
                :total="abandonedMatches.length"
                @update:page="abandonedMatchesPage = $event"
              />
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>

    <!-- Edit Sanction Dialog -->
    <Dialog :open="editDialogOpen" @update:open="editDialogOpen = $event">
      <DialogContent>
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Clock class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
            {{ $t("player.sanctions.edit_title") }}
          </DialogTitle>
          <DialogDescription>
            {{ $t("player.sanctions.edit_description") }}
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <Label
              class="text-xs uppercase tracking-wider text-muted-foreground"
            >
              {{ $t("player.sanctions.end_time") }}
            </Label>
            <div class="flex items-center gap-2">
              <Popover>
                <PopoverTrigger as-child>
                  <Button
                    variant="outline"
                    class="w-[180px] justify-start text-left font-normal"
                    :class="{
                      'text-muted-foreground': !editDate,
                    }"
                  >
                    <CalendarIcon class="mr-2 h-4 w-4" />
                    {{ editDateDisplay || $t("common.pick_date") }}
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-0">
                  <Calendar v-model="editDate" initial-focus />
                </PopoverContent>
              </Popover>
              <Input
                type="time"
                v-model="editTime"
                style="color-scheme: dark"
                class="w-[120px]"
              />
              <TooltipProvider v-if="editDate || editTime">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      @click="clearEditDate"
                    >
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {{ $t("player.sanctions.clear_date") }}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ $t("player.sanctions.end_time_hint") }}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="editDialogOpen = false">
            {{ $t("common.cancel") }}
          </Button>
          <Button :loading="updatingSanction" @click="updateSanctionEndTime">
            {{ $t("common.save") }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Sanction Alert Dialog -->
    <AlertDialog
      :open="showDeleteDialog"
      @update:open="showDeleteDialog = $event"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{
            $t("player.sanctions.confirm_remove")
          }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("player.sanctions.remove_description") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="showDeleteDialog = false">
            {{ $t("common.cancel") }}
          </AlertDialogCancel>
          <AlertDialogAction
            @click="
              confirmRemoveSanction();
              showDeleteDialog = false;
            "
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {{ $t("common.confirm") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Delete Abandoned Match Alert Dialog -->
    <AlertDialog
      :open="showDeleteAbandonedDialog"
      @update:open="showDeleteAbandonedDialog = $event"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{
            $t("player.sanctions.confirm_remove_abandoned")
          }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("player.sanctions.remove_abandoned_description") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="showDeleteAbandonedDialog = false">
            {{ $t("common.cancel") }}
          </AlertDialogCancel>
          <AlertDialogAction
            @click="
              confirmRemoveAbandonedMatch();
              showDeleteAbandonedDialog = false;
            "
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {{ $t("common.confirm") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, e_player_roles_enum, order_by } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import { useAuthStore } from "~/stores/AuthStore";
import gql from "graphql-tag";

export default {
  props: {
    playerId: {
      type: String,
      required: true,
    },
    serverId: {
      type: String,
      required: false,
      default: undefined,
    },
  },
  data() {
    return {
      sanctions: [] as any[],
      abandonedMatches: [] as any[],
      editDialogOpen: false,
      editingSanction: null as any,
      editDate: undefined as any,
      editTime: undefined as string | undefined,
      showDeleteDialog: false,
      sanctionToDelete: null as any,
      showDeleteAbandonedDialog: false,
      abandonedMatchToDelete: null as any,
      abandonedMatchesPage: 1,
      itemsPerPage: 20,
      sheetOpen: false,
      removingSanction: false,
      removingAbandonedMatch: false,
      updatingSanction: false,
    };
  },
  apollo: {
    $subscribe: {
      player_sanctions: {
        query: typedGql("subscription")({
          player_sanctions: [
            {
              where: {
                player_steam_id: {
                  _eq: $("playerId", "bigint!"),
                },
                deleted_at: {
                  _is_null: true,
                },
              },
            },
            {
              id: true,
              type: true,
              reason: true,
              created_at: true,
              remove_sanction_date: true,
            },
          ],
        }),
        variables: function (): { playerId: string } {
          return {
            playerId: (this as any).playerId,
          };
        },
        result: function ({ data }: { data: any }) {
          (this as any).sanctions = data.player_sanctions;
        },
      },
      abandoned_matches: {
        query: typedGql("subscription")({
          abandoned_matches: [
            {
              where: {
                steam_id: {
                  _eq: $("playerId", "bigint!"),
                },
              },
              order_by: [
                {
                  abandoned_at: order_by.desc,
                },
              ],
            },
            {
              id: true,
              steam_id: true,
              abandoned_at: true,
            },
          ],
        }),
        variables: function (): { playerId: string } {
          return {
            playerId: (this as any).playerId,
          };
        },
        result: function ({ data }: { data: any }) {
          (this as any).abandonedMatches = data.abandoned_matches;
        },
      },
    },
  },
  computed: {
    activeSanctions() {
      return this.sanctions.filter((sanction) => {
        if (sanction.remove_sanction_date) {
          return new Date(sanction.remove_sanction_date) > new Date();
        }
        return true;
      }).length;
    },
    canManageSanctions() {
      return useAuthStore().isRoleAbove(e_player_roles_enum.moderator);
    },
    steamProfileUrl() {
      return `https://steamcommunity.com/profiles/${this.playerId}`;
    },
    editDateDisplay() {
      if (!this.editDate) return "";
      return this.editDate.toString();
    },
    abandonedMatchesCount() {
      return this.abandonedMatches?.length || 0;
    },
    displayedAbandonedMatches() {
      if (!this.abandonedMatches || this.abandonedMatches.length === 0) {
        return [];
      }
      const start = (this.abandonedMatchesPage - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.abandonedMatches.slice(start, end);
    },
    hasAnyData() {
      return (
        (this.sanctions && this.sanctions.length > 0) ||
        (this.abandonedMatches && this.abandonedMatches.length > 0)
      );
    },
    totalCount() {
      return this.sanctions.length + this.abandonedMatchesCount;
    },
  },
  watch: {
    editTime() {
      this.updateEditDateTime();
    },
    editDate() {
      this.updateEditDateTime();
    },
  },
  methods: {
    isExpired(sanction: any) {
      return (
        !!sanction.remove_sanction_date &&
        new Date(sanction.remove_sanction_date) <= new Date()
      );
    },
    isAutoSteamBan(sanction: any) {
      return (
        sanction.type === "ban" &&
        typeof sanction.reason === "string" &&
        sanction.reason.startsWith("Auto: Steam")
      );
    },
    accentBarClass(sanction: any) {
      if (this.isExpired(sanction)) return "bg-muted-foreground/30";
      return sanction.type === "ban"
        ? "bg-destructive"
        : "bg-[hsl(var(--tac-amber))]";
    },
    accentTextClass(sanction: any) {
      if (this.isExpired(sanction)) return "text-muted-foreground";
      return sanction.type === "ban"
        ? "text-destructive"
        : "text-[hsl(var(--tac-amber))]";
    },
    statusPillClass(sanction: any) {
      return this.isExpired(sanction)
        ? "border-border text-muted-foreground"
        : "border-destructive/40 bg-destructive/10 text-destructive";
    },
    openEditDialog(sanction: any) {
      if (this.isExpired(sanction)) {
        return;
      }
      this.editingSanction = sanction;
      this.editDialogOpen = true;

      if (sanction.remove_sanction_date) {
        const date = new Date(sanction.remove_sanction_date);
        this.editDate = toCalendarDate(fromDate(date, "UTC"));
        this.editTime = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
      } else {
        this.editDate = undefined;
        this.editTime = undefined;
      }
    },
    clearEditDate() {
      this.editDate = undefined;
      this.editTime = undefined;
    },
    updateEditDateTime() {
      // This method can be used for validation if needed
    },
    async updateSanctionEndTime() {
      if (this.updatingSanction) {
        return;
      }
      if (!this.editingSanction) {
        return;
      }
      this.updatingSanction = true;

      let remove_sanction_date: Date | null = null;

      if (this.editDate && this.editTime) {
        const [hours, minutes] = this.editTime.split(":").map(Number);
        // this.editDate is already a CalendarDate object, so we can use it directly
        remove_sanction_date = new Date(
          Date.UTC(
            this.editDate.year,
            this.editDate.month - 1,
            this.editDate.day,
            hours,
            minutes,
          ),
        );
      }

      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            update_player_sanctions_by_pk: [
              {
                pk_columns: {
                  id: this.editingSanction.id,
                  created_at: this.editingSanction.created_at,
                },
                _set: {
                  remove_sanction_date,
                },
              },
              {
                id: true,
                remove_sanction_date: true,
              },
            ],
          }),
        });

        toast({
          title: this.$t("player.sanctions.updated"),
        });

        this.editDialogOpen = false;
        this.editingSanction = null;
        this.editDate = undefined;
        this.editTime = undefined;
      } catch (error) {
        console.error("Failed to update sanction:", error);
        toast({
          title: this.$t("player.sanctions.update_failed"),
          variant: "destructive",
        });
      } finally {
        this.updatingSanction = false;
      }
    },
    removeSanction(sanction: any) {
      this.sanctionToDelete = sanction;
      this.showDeleteDialog = true;
    },
    async confirmRemoveSanction() {
      if (this.removingSanction) {
        return;
      }
      if (!this.sanctionToDelete) {
        return;
      }
      this.removingSanction = true;

      try {
        await (this as any).$apollo.mutate({
          mutation: gql`
            mutation UnsanctionServerPlayer(
              $serverId: String
              $steam_id: String!
              $type: String!
            ) {
              unsanctionServerPlayer(
                serverId: $serverId
                steam_id: $steam_id
                type: $type
              ) {
                enforced
                message
              }
            }
          `,
          variables: {
            serverId: this.serverId ?? null,
            steam_id: this.playerId,
            type: this.sanctionToDelete.type,
          },
        });

        toast({
          title: this.$t("player.sanctions.removed"),
        });

        this.sanctionToDelete = null;
      } catch (error) {
        console.error("Failed to remove sanction:", error);
        toast({
          title: this.$t("player.sanctions.remove_failed"),
          variant: "destructive",
        });
      } finally {
        this.removingSanction = false;
      }
    },
    removeAbandonedMatch(abandonedMatch: any) {
      this.abandonedMatchToDelete = abandonedMatch;
      this.showDeleteAbandonedDialog = true;
    },
    async confirmRemoveAbandonedMatch() {
      if (this.removingAbandonedMatch) {
        return;
      }
      if (!this.abandonedMatchToDelete) {
        return;
      }
      this.removingAbandonedMatch = true;

      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            delete_abandoned_matches_by_pk: [
              {
                id: this.abandonedMatchToDelete.id,
              },
              {
                id: true,
              },
            ],
          }),
        });

        toast({
          title: this.$t("player.sanctions.abandoned_removed"),
        });

        this.abandonedMatchToDelete = null;
      } catch (error) {
        console.error("Failed to remove abandoned match:", error);
        toast({
          title: this.$t("player.sanctions.abandoned_remove_failed"),
          variant: "destructive",
        });
      } finally {
        this.removingAbandonedMatch = false;
      }
    },
  },
};
</script>
