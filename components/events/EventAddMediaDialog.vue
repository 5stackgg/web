<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { toast } from "@/components/ui/toast";
import EventMediaDropzone from "~/components/events/EventMediaDropzone.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const props = defineProps<{
  open: boolean;
  eventId: string;
}>();

const emit = defineEmits<{ (e: "update:open", v: boolean): void }>();

const { t } = useI18n();

const url = ref("");
const title = ref("");

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      url.value = "";
      title.value = "";
    }
  },
);

const isValid = computed(() => {
  try {
    const parsed = new URL(url.value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
});

function close() {
  emit("update:open", false);
}

async function submitLink() {
  if (!isValid.value) {
    toast({ title: t("event.media.link_invalid"), variant: "destructive" });
    return;
  }
  try {
    const apiDomain = useRuntimeConfig().public.apiDomain;
    const response = await fetch(
      `https://${apiDomain}/events/media/${props.eventId}/link`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.value.trim(),
          title: title.value.trim() || undefined,
        }),
      },
    );
    if (!response.ok) {
      throw new Error(
        (await response.text()) || `${response.status} ${response.statusText}`,
      );
    }
    toast({ title: t("event.media.link_added") });
    close();
  } catch (error: any) {
    toast({ title: error?.message, variant: "destructive" });
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ $t("event.media.add_title") }}</DialogTitle>
      </DialogHeader>

      <div class="grid gap-5">
        <!-- Upload -->
        <div class="grid gap-2">
          <div :class="[tacticalSectionLabelClasses, '!mb-0']">
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("event.media.upload_section") }}
          </div>
          <EventMediaDropzone :event-id="eventId" @added="close" />
        </div>

        <!-- External link -->
        <div class="grid gap-2">
          <div :class="[tacticalSectionLabelClasses, '!mb-0']">
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("event.media.link_section") }}
          </div>
          <p class="text-xs text-muted-foreground">
            {{ $t("event.media.add_link_description") }}
          </p>
          <div class="grid gap-2">
            <Label for="event-link-url">{{
              $t("event.media.link_url_label")
            }}</Label>
            <Input
              id="event-link-url"
              v-model="url"
              type="url"
              :placeholder="$t('event.media.link_url_placeholder')"
              @keydown.enter.prevent="submitLink"
            />
          </div>
          <div class="grid gap-2">
            <Label for="event-link-title">{{
              $t("event.media.title_label")
            }}</Label>
            <Input
              id="event-link-title"
              v-model="title"
              :placeholder="$t('event.media.link_title_placeholder')"
              @keydown.enter.prevent="submitLink"
            />
          </div>
          <div class="flex justify-end">
            <Button :disabled="!isValid" @click="submitLink">
              {{ $t("event.media.link_add") }}
            </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
