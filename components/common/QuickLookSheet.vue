<script setup lang="ts">
import { ref, watch } from "vue";
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

// Stepping slides the next item in from the side it came from, and starts it
// at the top rather than wherever the last one was scrolled to.
const direction = ref<-1 | 1>(1);
const scroller = ref<HTMLElement | null>(null);
watch(
  () => props.index,
  (next, previous) => {
    direction.value = next >= previous ? 1 : -1;
    scroller.value?.scrollTo({ top: 0 });
  },
);

const enterActive =
  "transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";
const leaveActive =
  "absolute inset-x-0 top-0 transition-[opacity,transform] [transition-duration:110ms] ease-in motion-reduce:transition-none";

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
      <div
        ref="scroller"
        class="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
      >
        <Transition
          :enter-active-class="enterActive"
          :leave-active-class="leaveActive"
          :enter-from-class="
            direction > 0 ? 'translate-x-4 opacity-0' : '-translate-x-4 opacity-0'
          "
          :leave-to-class="
            direction > 0 ? '-translate-x-2 opacity-0' : 'translate-x-2 opacity-0'
          "
        >
          <div :key="index">
            <slot />
          </div>
        </Transition>
      </div>
    </SheetContent>
  </Sheet>
</template>
