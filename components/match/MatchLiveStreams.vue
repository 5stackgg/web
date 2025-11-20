<script setup lang="ts">
import {
  Trash2,
  GripVertical,
  ExternalLink,
  Edit,
  MoreVertical,
} from "lucide-vue-next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusCircle } from "lucide-vue-next";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { e_player_roles_enum } from "~/generated/zeus";
</script>

<template>
  <Card class="p-4">
    <CardHeader>
      <div class="flex items-center justify-between">
        <CardTitle>
          {{ $t("streams.streams_description") }}
        </CardTitle>
        <!-- Add Stream Button moved inline -->
        <Dialog v-model:open="isAddStreamModalOpen" v-if="canManageStreams">
          <DialogTrigger as-child>
            <Button size="sm">
              <PlusCircle class="mr-2 h-4 w-4" />
              {{ $t("streams.add_new") }}
            </Button>
          </DialogTrigger>
          <DialogContent class="sm:max-w-[425px]">
            {{ form.errors }}

            <DialogHeader>
              <DialogTitle>{{ $t("streams.add_new") }}</DialogTitle>
              <DialogDescription>
                {{ $t("streams.add_description") }}
              </DialogDescription>
            </DialogHeader>
            <form class="space-y-4" @submit.prevent="addStream">
              <FormField v-slot="{ componentField }" name="link">
                <FormItem>
                  <FormLabel>{{ $t("streams.link") }}</FormLabel>
                  <Input
                    v-bind="componentField"
                    placeholder="https://twitch.tv/username"
                  />
                </FormItem>
              </FormField>
              <FormField v-slot="{ componentField }" name="title">
                <FormItem>
                  <FormLabel>{{ $t("streams.title") }}</FormLabel>
                  <Input v-bind="componentField" placeholder="Stream Title" />
                </FormItem>
              </FormField>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  @click="isAddStreamModalOpen = false"
                >
                  {{ $t("common.cancel") }}
                </Button>
                <Button>
                  {{ $t("streams.add") }}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </CardHeader>
    <CardContent>
      <!-- Streams Table -->
      <div v-if="match.streams.length > 0">
        <div class="border rounded-lg relative">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-12"></TableHead>
                <TableHead>{{ $t("streams.title") }}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <!-- Top spacer removed to avoid visual white gap; moving row directly during drag -->

              <template
                v-for="(stream, index) in match.streams"
                :key="stream.id"
              >
                <!-- Spacer to preview insertion position (slot before each row) -->
                <tr v-if="isDragging && dragOverIndex === index" class="h-0">
                  <td colspan="4" class="p-0">
                    <div class="h-12"></div>
                  </td>
                </tr>
                <TableRow
                  :ref="(el) => setRowRef(el, index)"
                  class="cursor-move hover:bg-muted/50 transition-all duration-200"
                  :class="{
                    'opacity-0 pointer-events-none':
                      isDragging && draggedIndex === index,
                    'bg-blue-50':
                      !isDragging &&
                      dragOverIndex === index &&
                      draggedIndex !== index,
                  }"
                  @mousedown="startDrag(index, $event)"
                >
                  <TableCell class="w-12" v-if="canManageStreams">
                    <div
                      class="grip-handle cursor-grab active:cursor-grabbing p-1 -m-1"
                    >
                      <GripVertical
                        class="h-4 w-4 text-muted-foreground transition-colors"
                        :class="{ 'text-blue-500': draggedIndex === index }"
                      />
                    </div>
                  </TableCell>
                  <TableCell class="w-full">
                    {{ stream.title }}
                  </TableCell>
                  <TableCell class="flex items-center justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      @click="openStream(stream.link)"
                    >
                      <ExternalLink class="h-3 w-3" />
                    </Button>

                    <!-- Actions Dropdown -->
                    <DropdownMenu v-if="canManageStreams">
                      <DropdownMenuTrigger as-child>
                        <Button variant="ghost" size="icon">
                          <MoreVertical class="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent class="w-44">
                        <DropdownMenuItem @click="openEditModal(stream)">
                          <Edit class="mr-2 h-4 w-4" />
                          <span>{{ $t("streams.update") }}</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          class="text-destructive"
                          @click="deleteStream(stream.id)"
                        >
                          <Trash2 class="mr-2 h-4 w-4" />
                          <span>{{ $t("common.delete") }}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <!-- Edit Dialog (opened via dropdown) -->
                    <Dialog
                      v-model:open="isEditStreamModalOpen[stream.id]"
                      v-if="canManageStreams"
                    >
                      <DialogContent class="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>{{
                            $t("streams.edit_stream")
                          }}</DialogTitle>
                          <DialogDescription>
                            {{ $t("streams.edit_description") }}
                          </DialogDescription>
                        </DialogHeader>
                        <form
                          class="space-y-4"
                          @submit.prevent="updateStream(stream.id)"
                        >
                          <FormField v-slot="{ componentField }" name="link">
                            <FormItem>
                              <FormLabel>{{ $t("streams.link") }}</FormLabel>
                              <Input
                                v-bind="componentField"
                                :placeholder="stream.link"
                              />
                            </FormItem>
                          </FormField>
                          <FormField v-slot="{ componentField }" name="title">
                            <FormItem>
                              <FormLabel>{{ $t("streams.title") }}</FormLabel>
                              <Input
                                v-bind="componentField"
                                :placeholder="stream.title"
                              />
                            </FormItem>
                          </FormField>
                          <DialogFooter>
                            <Button
                              type="button"
                              variant="outline"
                              @click="isEditStreamModalOpen[stream.id] = false"
                            >
                              {{ $t("common.cancel") }}
                            </Button>
                            <Button type="submit">
                              {{ $t("streams.update") }}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              </template>
              <!-- Spacer to preview insertion at the very end (after last row) -->
              <tr
                v-if="isDragging && dragOverIndex === match.streams.length"
                class="h-0"
              >
                <td colspan="4" class="p-0">
                  <div class="h-12"></div>
                </td>
              </tr>
            </TableBody>
          </Table>
          <!-- Floating drag overlay following the cursor (moves actual row look) -->
          <div
            v-if="isDragging && match.streams && match.streams[draggedIndex]"
            class="pointer-events-none absolute left-0 right-0 z-50"
            :style="{ top: overlayY + 'px' }"
          >
            <div
              class="mx-0 bg-background/90 backdrop-blur border-2 border-dashed border-blue-400 rounded shadow-sm"
            >
              <div class="table w-full">
                <div class="table-row">
                  <div class="table-cell w-12 align-middle">
                    <div class="p-1 -m-1">
                      <GripVertical class="h-4 w-4 text-blue-500" />
                    </div>
                  </div>
                  <div class="table-cell align-middle">
                    <div class="flex items-center space-x-2 py-2">
                      <span class="font-medium">{{
                        match.streams[draggedIndex].title
                      }}</span>
                    </div>
                  </div>
                  <div class="table-cell w-24 align-middle">
                    <div class="h-0"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Add Stream Button -->
      <div class="flex justify-start">
        <Dialog v-model:open="isAddStreamModalOpen">
          <DialogContent class="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{{ $t("streams.add_new") }}</DialogTitle>
              <DialogDescription>
                {{ $t("streams.add_description") }}
              </DialogDescription>
            </DialogHeader>
            <form class="space-y-4" @submit.prevent="addStream">
              <FormField v-slot="{ componentField }" name="link">
                <FormItem>
                  <FormLabel>{{ $t("streams.link") }}</FormLabel>
                  <Input
                    v-bind="componentField"
                    placeholder="https://twitch.tv/username"
                  />
                </FormItem>
              </FormField>
              <FormField v-slot="{ componentField }" name="title">
                <FormItem>
                  <FormLabel>{{ $t("streams.title") }}</FormLabel>
                  <Input v-bind="componentField" placeholder="Stream Title" />
                </FormItem>
              </FormField>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  @click="isAddStreamModalOpen = false"
                >
                  {{ $t("common.cancel") }}
                </Button>
                <Button>
                  {{ $t("streams.add") }}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </CardContent>
  </Card>
</template>

<script lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      dragOverIndex: null,
      draggedIndex: null,
      dragStartY: 0,
      dragStartX: 0,
      currentMouseY: 0,
      overlayY: 0,
      isDragging: false,
      lastDragOverIndex: null,
      rowRefs: [],
      isAddStreamModalOpen: false,
      isEditStreamModalOpen: {},
      currentEditingId: null,
      lastMovedStreamId: null,
      lastMovedNewIndex: null,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            link: z.string().url(),
            title: z.string(),
          }),
        ),
      }),
    };
  },
  computed: {
    canManageStreams() {
      return (
        useAuthStore().isRoleAbove(e_player_roles_enum.streamer) ||
        this.match.is_organizer
      );
    },
  },
  methods: {
    async addStream() {
      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }

      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            insert_match_streams_one: [
              {
                object: {
                  match_id: this.match.id,
                  link: this.form.values.link,
                  title: this.form.values.title,
                  priority: this.match.streams
                    ? this.match.streams.length + 1
                    : 1,
                },
              },
              {
                id: true,
                link: true,
                title: true,
                priority: true,
              },
            ],
          }),
        });

        // Close modal and reset form
        this.isAddStreamModalOpen = false;
        this.form.resetForm();
        toast({
          title: this.$t("streams.added_successfully"),
          description: this.$t("streams.stream_added_message"),
        });
      } catch (error) {
        toast({
          title: this.$t("common.error"),
          description: this.$t("streams.add_error"),
          variant: "destructive",
        });
      }
    },
    async updateStream(streamId) {
      const { valid } = await this.form.validate();
      if (!valid) return;

      try {
        // Find the original stream to get the current values if not changed
        const originalStream =
          this.match.streams.find((s) => s.id === streamId) || {};
        const linkToUpdate = this.form.values.link || originalStream.link;
        const titleToUpdate = this.form.values.title || originalStream.title;
        await this.$apollo.mutate({
          mutation: generateMutation({
            update_match_streams_by_pk: [
              {
                pk_columns: {
                  id: streamId,
                },
                _set: {
                  link: linkToUpdate,
                  title: titleToUpdate,
                },
              },
              {
                id: true,
                link: true,
                title: true,
                priority: true,
              },
            ],
          }),
        });

        // Close modal and reset form
        this.isEditStreamModalOpen[streamId] = false;
        this.currentEditingId = null;
        this.form.resetForm();
        toast({
          title: this.$t("streams.updated_successfully"),
          description: this.$t("streams.stream_updated_message"),
        });
      } catch (error) {
        toast({
          title: this.$t("common.error"),
          description: this.$t("streams.update_error"),
          variant: "destructive",
        });
      }
    },
    async deleteStream(streamId) {
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            delete_match_streams_by_pk: [
              {
                id: streamId,
              },
              {
                id: true,
                link: true,
                title: true,
                priority: true,
              },
            ],
          }),
        });
        toast({
          title: this.$t("streams.deleted_successfully"),
          description: this.$t("streams.stream_deleted_message"),
        });
      } catch (error) {
        toast({
          title: this.$t("common.error"),
          description: this.$t("streams.delete_error"),
          variant: "destructive",
        });
      }
    },
    openStream(link) {
      window.open(link, "_blank");
    },
    openEditModal(stream) {
      // ensure add modal is closed to avoid shared form conflicts
      this.isAddStreamModalOpen = false;
      this.currentEditingId = stream.id;
      this.form.setValues({
        link: stream.link,
        title: stream.title,
      });
      this.isEditStreamModalOpen[stream.id] = true;
    },
    setRowRef(el, index) {
      if (el) {
        // Handle both Vue component instances and DOM elements
        this.rowRefs[index] = el.$el || el;
      }
    },
    startDrag(index, event) {
      // Only start drag on the grip handle, not the entire row
      if (!event.target.closest(".grip-handle")) return;

      this.draggedIndex = index;
      this.dragOverIndex = null;
      this.dragStartY = event.clientY;
      this.dragStartX = event.clientX;
      this.isDragging = false; // Track if we've actually started dragging

      // Add drag class to body to prevent text selection
      document.body.classList.add("dragging");
      document.addEventListener("mousemove", this.handleDrag);
      document.addEventListener("mouseup", this.endDrag);

      // Prevent default to avoid text selection
      event.preventDefault();
      event.stopPropagation();
    },
    handleDrag(event) {
      if (this.draggedIndex === null) return;

      const currentY = event.clientY;
      const currentX = event.clientX;
      const deltaY = currentY - this.dragStartY;
      const deltaX = currentX - this.dragStartX;

      // Only start drag if moved more than 5 pixels (prevents accidental drags)
      if (Math.abs(deltaY) < 5 && Math.abs(deltaX) < 5) return;

      // Mark that we're actually dragging
      if (!this.isDragging) {
        this.isDragging = true;
      }

      // Track the current mouse position for drop detection
      this.currentMouseY = currentY;
      // Position overlay relative to table container
      const container = this.$el.querySelector(".border.rounded-lg");
      const tableRect = (container || this.$el).getBoundingClientRect();
      this.overlayY = currentY - tableRect.top - 20;

      // Compute target slot (0..streams.length) using row centers
      const targetSlot = this.getTargetSlot(currentY);
      if (targetSlot !== this.lastDragOverIndex) {
        this.dragOverIndex = targetSlot;
        this.lastDragOverIndex = targetSlot;
      }
    },
    endDrag() {
      if (this.draggedIndex !== null) {
        // Only reorder if we were actually dragging
        if (this.isDragging) {
          // Find the drop target based on final mouse position
          const targetSlot = this.getTargetSlot(this.currentMouseY);
          if (targetSlot !== null) {
            // Convert slot (0..n) to insertion index in the original array
            let insertIndex = targetSlot;
            if (insertIndex > this.draggedIndex) insertIndex -= 1;
            if (insertIndex < 0) insertIndex = 0;
            if (insertIndex > this.match.streams.length - 1)
              insertIndex = this.match.streams.length - 1;
            if (insertIndex !== this.draggedIndex) {
              this.updateVisualOrder(this.draggedIndex, insertIndex);
            }
          }
        }

        // Save the final order to the database
        this.saveStreamOrder();
        this.draggedIndex = null;
        this.dragOverIndex = null;
        this.lastDragOverIndex = null;
        this.isDragging = false;
        document.body.classList.remove("dragging");
        document.removeEventListener("mousemove", this.handleDrag);
        document.removeEventListener("mouseup", this.endDrag);
      }
    },
    getTargetIndex(clientY) {
      let closestIndex = null;
      let closestDistance = Infinity;

      // Early clamp using first and last row bounds
      const firstRow = this.rowRefs[0];
      const lastRow = this.rowRefs[this.rowRefs.length - 1];
      if (firstRow && lastRow) {
        const firstRect =
          firstRow.$el?.getBoundingClientRect?.() ||
          firstRow.getBoundingClientRect?.();
        const lastRect =
          lastRow.$el?.getBoundingClientRect?.() ||
          lastRow.getBoundingClientRect?.();
        if (firstRect && clientY < firstRect.top) return 0;
        if (lastRect && clientY > lastRect.bottom)
          return this.rowRefs.length - 1;
      }

      for (let i = 0; i < this.rowRefs.length; i++) {
        const row = this.rowRefs[i];
        if (!row) continue;

        const rect =
          row.$el?.getBoundingClientRect?.() || row.getBoundingClientRect?.();
        if (!rect) continue;

        // If mouse is within the row bounds, use it
        if (clientY >= rect.top && clientY <= rect.bottom) {
          return i;
        }

        // Otherwise, track the closest row center
        const rowCenter = rect.top + rect.height / 2;
        const distance = Math.abs(clientY - rowCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = i;
        }
      }

      return closestIndex;
    },
    // Returns an insertion slot between rows: 0..streams.length
    getTargetSlot(clientY) {
      if (!this.rowRefs.length) return 0;

      // Build an array of slot thresholds: before first, between rows, after last
      const slots = [];
      for (let i = 0; i < this.rowRefs.length; i++) {
        const row = this.rowRefs[i];
        const rect =
          row?.$el?.getBoundingClientRect?.() || row?.getBoundingClientRect?.();
        if (!rect) continue;
        slots.push({
          index: i,
          top: rect.top,
          bottom: rect.bottom,
          mid: rect.top + rect.height / 2,
        });
      }

      // Above first
      if (clientY < slots[0].mid) return 0;
      // Below last
      if (clientY > slots[slots.length - 1].mid)
        return this.match.streams.length;

      // Between: find first slot where clientY < mid of next
      for (let i = 0; i < slots.length - 1; i++) {
        const a = slots[i];
        const b = slots[i + 1];
        if (clientY >= a.mid && clientY <= b.mid) {
          return i + 1;
        }
      }

      // Fallback to closest mid
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < slots.length; i++) {
        const d = Math.abs(clientY - slots[i].mid);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return best;
    },
    updateVisualOrder(fromIndex, toIndex) {
      if (fromIndex === toIndex) return;

      // Create a copy of the streams array and update visual order
      const newStreams = [...this.match.streams];
      const [movedStream] = newStreams.splice(fromIndex, 1);
      newStreams.splice(toIndex, 0, movedStream);

      // Update the local streams array for visual feedback
      this.match.streams = newStreams;

      // Track last moved for single-row DB update
      this.lastMovedStreamId = movedStream?.id || null;
      this.lastMovedNewIndex = toIndex;
    },
    async saveStreamOrder() {
      if (!this.match.streams || this.match.streams.length === 0) return;

      // Only update the moved stream's priority - DB trigger handles the rest
      if (this.lastMovedStreamId != null && this.lastMovedNewIndex != null) {
        const newPriorityInt = Math.trunc(this.lastMovedNewIndex + 1);

        try {
          await this.$apollo.mutate({
            mutation: generateMutation({
              update_match_streams_by_pk: [
                {
                  pk_columns: {
                    id: this.lastMovedStreamId,
                  },
                  _set: {
                    priority: newPriorityInt,
                  },
                },
                {
                  id: true,
                  priority: true,
                },
              ],
            }),
          });
        } catch (error) {
          toast({
            title: this.$t("common.error"),
            description: this.$t("streams.priority_update_error"),
            variant: "destructive",
          });
        } finally {
          this.lastMovedStreamId = null;
          this.lastMovedNewIndex = null;
        }
      }
    },
  },
};
</script>

<style scoped>
.dragging {
  user-select: none;
  cursor: grabbing !important;
}

.dragging * {
  cursor: grabbing !important;
}

.grip-handle:hover {
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
}
</style>
