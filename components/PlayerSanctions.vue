<script lang="ts" setup>
import TimeAgo from "@/components/TimeAgo.vue";
import {
  ChevronDownIcon,
  Edit2,
  Trash2,
  Calendar as CalendarIcon,
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
import { fromDate, toCalendarDate } from "@internationalized/date";
</script>

<template>
  <div class="flex flex-col gap-2" v-if="sanctions && sanctions.length > 0">
    <Collapsible>
      <CollapsibleTrigger class="flex items-center gap-2 group">
        <Badge variant="destructive"
          >{{
            activeSanctions
              ? $t("player.sanctions.active_count", { count: activeSanctions })
              : $t("player.sanctions.past_count", { count: sanctions.length })
          }}
          {{ $t("player.sanctions.title") }}</Badge
        >
        <ChevronDownIcon
          class="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180"
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <Card class="mt-2">
          <CardContent class="pt-4">
            <div class="flex flex-col gap-4">
              <div
                v-for="sanction in sanctions"
                :key="sanction.id"
                class="flex flex-col gap-1"
              >
                <div class="flex justify-between items-start">
                  <div class="flex flex-col gap-1 flex-1">
                    <span class="font-medium capitalize">{{
                      sanction.type
                    }}</span>
                    <span class="text-sm text-muted-foreground">
                      {{ new Date(sanction.created_at).toLocaleString() }}
                    </span>
                  </div>
                  <div
                    v-if="canManageSanctions"
                    class="flex gap-2 items-center"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-8 w-8"
                      @click="openEditDialog(sanction)"
                      :title="$t('player.sanctions.edit')"
                    >
                      <Edit2 class="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-8 w-8 text-destructive"
                      @click="removeSanction(sanction)"
                      :title="$t('player.sanctions.remove')"
                    >
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p class="text-sm text-muted-foreground">
                  {{ sanction.reason }}
                </p>
                <div
                  v-if="sanction.remove_sanction_date"
                  class="text-sm flex gap-2 items-center"
                >
                  {{ $t("player.sanctions.expires") }}
                  <TimeAgo :date="sanction.remove_sanction_date" />
                </div>
                <Separator
                  class="my-2"
                  v-if="
                    sanctions.length > 1 &&
                    sanctions.indexOf(sanction) !== sanctions.length - 1
                  "
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>

    <!-- Edit Sanction Dialog -->
    <Dialog :open="editDialogOpen" @update:open="editDialogOpen = $event">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ $t("player.sanctions.edit_title") }}</DialogTitle>
          <DialogDescription>
            {{ $t("player.sanctions.edit_description") }}
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <Label>{{ $t("player.sanctions.expires") }}</Label>
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
                    {{ editDateDisplay || $t("player.sanctions.pick_date") }}
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
              <Button
                v-if="editDate || editTime"
                type="button"
                variant="ghost"
                size="icon"
                @click="clearEditDate"
                :title="$t('player.sanctions.clear_date')"
              >
                <Trash2 class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="editDialogOpen = false">
            {{ $t("common.cancel") }}
          </Button>
          <Button @click="updateSanctionEndTime">
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
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, e_player_roles_enum } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import { useAuthStore } from "~/stores/AuthStore";

export default {
  props: {
    playerId: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      sanctions: [] as any[],
      editDialogOpen: false,
      editingSanction: null as any,
      editDate: undefined as any,
      editTime: undefined as string | undefined,
      showDeleteDialog: false,
      sanctionToDelete: null as any,
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
        variables() {
          return {
            playerId: this.playerId,
          };
        },
        result({ data }: { data: any }) {
          this.sanctions = data.player_sanctions;
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
      return useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer);
    },
    editDateDisplay() {
      if (!this.editDate) return "";
      return this.editDate.toString();
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
    openEditDialog(sanction: any) {
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
      if (!this.editingSanction) return;

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
      }
    },
    removeSanction(sanction: any) {
      this.sanctionToDelete = sanction;
      this.showDeleteDialog = true;
    },
    async confirmRemoveSanction() {
      if (!this.sanctionToDelete) return;

      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            delete_player_sanctions_by_pk: [
              {
                id: this.sanctionToDelete.id,
                created_at: this.sanctionToDelete.created_at,
              },
              {
                id: true,
              },
            ],
          }),
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
      }
    },
  },
};
</script>
