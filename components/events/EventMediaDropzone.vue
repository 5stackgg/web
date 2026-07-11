<script setup lang="ts">
import { ref } from "vue";
import { Upload } from "lucide-vue-next";
import { useEventMediaUpload } from "~/composables/useEventMediaUpload";
import { useEventMediaQueue } from "~/composables/useEventMediaQueue";

const props = defineProps<{ eventId: string }>();
const emit = defineEmits<{ (e: "added"): void }>();

const { accept } = useEventMediaUpload(() => props.eventId);
// Module-scoped queue shared with the panel's progress display.
const { enqueue } = useEventMediaQueue(props.eventId);

const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

function triggerFileInput() {
  fileInput.value?.click();
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files?.length) {
    enqueue(target.files);
    emit("added");
  }
  target.value = "";
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;
  if (event.dataTransfer?.files?.length) {
    enqueue(event.dataTransfer.files);
    emit("added");
  }
}
</script>

<template>
  <div
    class="cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors"
    :class="[
      isDragging
        ? 'border-primary bg-primary/5'
        : 'border-border hover:border-border/80 hover:bg-accent/30',
    ]"
    role="button"
    tabindex="0"
    @click="triggerFileInput"
    @keydown.enter.prevent="triggerFileInput"
    @keydown.space.prevent="triggerFileInput"
    @drop="handleDrop"
    @dragover.prevent
    @dragenter.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
  >
    <Upload
      class="mx-auto mb-2 h-8 w-8"
      :class="isDragging ? 'text-primary' : 'text-muted-foreground'"
    />
    <p class="mb-1 text-sm font-medium">
      <template v-if="isDragging">{{
        $t("event.media.drop_to_upload")
      }}</template>
      <template v-else>{{ $t("event.media.click_to_choose") }}</template>
    </p>
    <p class="text-xs text-muted-foreground">
      {{ $t("event.media.supported_types") }}
    </p>

    <input
      ref="fileInput"
      type="file"
      :accept="accept"
      multiple
      class="hidden"
      @change="handleFileSelect"
    />
  </div>
</template>
