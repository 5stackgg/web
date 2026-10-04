<script setup lang="ts">
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "~/components/ui/sheet";

const open = defineModel<boolean>("open", { required: true });

const props = defineProps<{ index: number; total: number; title: string }>();

const emit = defineEmits<{ (e: "step", direction: -1 | 1): void }>();

function onKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowLeft" && props.index > 0) {
    event.preventDefault();
    emit("step", -1);
  } else if (event.key === "ArrowRight" && props.index < props.total - 1) {
    event.preventDefault();
    emit("step", 1);
  }
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent
      side="right"
      class="flex w-full flex-col gap-0 p-0 sm:max-w-[500px]"
      @keydown="onKeydown"
    >
      <SheetTitle class="sr-only">{{ title }}</SheetTitle>
      <SheetDescription class="sr-only">
        {{ $t("quick_look.title") }}
      </SheetDescription>
      <div
        class="flex h-14 shrink-0 items-center gap-1.5 border-b border-border pl-3 pr-14"
      >
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8"
          :disabled="index <= 0"
          :aria-label="$t('common.previous')"
          @click="emit('step', -1)"
        >
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <span
          class="min-w-16 text-center text-xs tabular-nums text-muted-foreground"
        >
          {{ $t("quick_look.position", { index: index + 1, total }) }}
        </span>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8"
          :disabled="index >= total - 1"
          :aria-label="$t('common.next')"
          @click="emit('step', 1)"
        >
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <slot />
      </div>
    </SheetContent>
  </Sheet>
</template>
