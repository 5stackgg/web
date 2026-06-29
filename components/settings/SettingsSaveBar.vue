<script setup lang="ts">
import { Button } from "@/components/ui/button";

/**
 * Floating "command bar" that docks to the bottom-center of the viewport
 * whenever the user has unsaved settings changes — so the Update action is
 * always one glance away instead of buried at the bottom of a long form.
 *
 * Two modes:
 *  - vee-validate (`:form`): dirty detection does NOT trust `meta.dirty` (its
 *    baseline is established before the async settings load, so it reads dirty
 *    on a fresh page). Instead we snapshot the form values one tick after the
 *    settings store (re)loads — i.e. after the page's own watcher has applied
 *    them — and treat the form as changed only when the live values diverge.
 *    Discard reverts via `resetForm()` + re-snapshot.
 *  - manual (`:dirty` + `@discard`): the host owns the dirty signal and the
 *    revert. Used by pages that don't drive a vee-validate form (branding,
 *    game type configs).
 */
const props = defineProps<{
  form?: any;
  dirty?: boolean;
  submitting?: boolean;
  contained?: boolean;
  // Validation-gate mode (e.g. a create flow): show the bar regardless of
  // dirty state and only enable the action once `valid` is true.
  forceVisible?: boolean;
  valid?: boolean;
  title?: string;
  description?: string;
  actionLabel?: string;
  hideDiscard?: boolean;
}>();

const emit = defineEmits<{ (e: "save"): void; (e: "discard"): void }>();

const settingsStore = useApplicationSettingsStore();

const baseline = ref<string | null>(null);

function serialize() {
  return JSON.stringify(unref(props.form?.values) ?? {});
}

function takeSnapshot() {
  nextTick(() => {
    baseline.value = serialize();
  });
}

// Re-baseline whenever settings (re)load or a save lands — the page's watcher
// runs on the same tick to push values into the form, so defer to nextTick.
watch(
  () => settingsStore.settings,
  () => {
    if (props.form) takeSnapshot();
  },
  { immediate: true },
);

const dirty = computed(() => {
  if (!props.form) return !!props.dirty;
  if (baseline.value === null) return false;
  return serialize() !== baseline.value;
});

const hasErrors = computed(() => {
  if (!props.form) return false;
  const errs = unref(props.form?.errors) as Record<string, unknown> | undefined;
  return errs ? Object.keys(errs).length > 0 : false;
});

const visible = computed(() => props.forceVisible || dirty.value);

const canSave = computed(() => {
  if (props.submitting) return false;
  if (hasErrors.value) return false;
  // In gate mode (forceVisible, e.g. a create flow) the action is enabled only
  // once `valid` is true. In normal save mode `valid` is ignored — note an
  // absent boolean prop is coerced to `false` by Vue, so we must NOT gate on it
  // here or every save bar would be permanently disabled.
  if (props.forceVisible) return props.valid === true;
  return dirty.value;
});

function save() {
  if (!canSave.value) return;
  emit("save");
}

function discard() {
  if (props.form) {
    props.form?.resetForm?.();
    takeSnapshot();
  } else {
    emit("discard");
  }
}

function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
    if (!visible.value) return;
    e.preventDefault();
    save();
  }
}

const barRef = ref<HTMLElement | null>(null);

// The bar must NEVER steal focus when it appears — the user may be mid-keystroke
// in an editor/input that just turned the form dirty. If anything inside the bar
// grabs focus as it mounts, hand it straight back to where the user was.
function onBarEnter() {
  const prev = document.activeElement as HTMLElement | null;
  requestAnimationFrame(() => {
    const active = document.activeElement;
    if (
      barRef.value &&
      active instanceof HTMLElement &&
      barRef.value.contains(active)
    ) {
      if (prev && prev !== active && typeof prev.focus === "function") {
        prev.focus();
      } else {
        active.blur();
      }
    }
  });
}

// Show ⌘S on Apple platforms, Ctrl+S everywhere else — the handler already
// accepts either modifier.
const isApple = ref(false);
const saveShortcut = computed(() => (isApple.value ? "⌘S" : "Ctrl+S"));

onMounted(() => {
  if (props.form) takeSnapshot();
  isApple.value = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
  window.addEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <Teleport to="body" :disabled="contained">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-8"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-8"
      @enter="onBarEnter"
    >
      <div
        v-if="visible"
        ref="barRef"
        class="pointer-events-none flex justify-center"
        :class="
          contained
            ? 'sticky inset-x-0 bottom-0 z-20 px-1 pb-1 pt-2'
            : 'fixed inset-x-0 bottom-0 z-50 px-4 pt-2'
        "
        :style="
          contained
            ? undefined
            : {
                paddingBottom:
                  'calc(var(--main-bottom-dock-height, 0px) + max(1rem, env(safe-area-inset-bottom)))',
              }
        "
      >
        <div
          class="save-bar pointer-events-auto flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 backdrop-blur-xl sm:gap-4 sm:px-4"
          :class="[
            contained ? '' : 'max-w-xl',
            hasErrors
              ? 'border-destructive/40 shadow-[0_0_0_1px_hsl(var(--destructive)/0.15),0_18px_40px_-12px_hsl(var(--destructive)/0.4),0_8px_24px_-8px_rgba(0,0,0,0.6)]'
              : 'border-[hsl(var(--tac-amber)/0.4)] shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.15),0_18px_40px_-12px_hsl(var(--tac-amber)/0.5),0_8px_24px_-8px_rgba(0,0,0,0.6)]',
          ]"
        >
          <!-- live status indicator -->
          <span
            class="relative ml-1 flex h-2.5 w-2.5 shrink-0 items-center justify-center"
          >
            <span
              v-if="!hasErrors"
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--tac-amber))] opacity-60"
            />
            <span
              class="relative inline-flex h-2.5 w-2.5 rounded-full"
              :class="
                hasErrors
                  ? 'bg-destructive shadow-[0_0_8px_hsl(var(--destructive)/0.8)]'
                  : 'bg-[hsl(var(--tac-amber))] shadow-[0_0_8px_hsl(var(--tac-amber)/0.85)]'
              "
            />
          </span>

          <!-- status text -->
          <div class="flex min-w-0 flex-1 flex-col leading-tight">
            <span
              class="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-foreground"
            >
              {{
                hasErrors
                  ? $t("common.save_bar.has_errors")
                  : title || $t("common.save_bar.unsaved_changes")
              }}
            </span>
            <span class="truncate text-xs text-muted-foreground">
              {{
                hasErrors
                  ? $t("common.save_bar.resolve_errors")
                  : description || $t("common.save_bar.review_and_save")
              }}
            </span>
          </div>

          <span class="h-8 w-px shrink-0 bg-border/70" />

          <!-- actions -->
          <Button
            v-if="!hideDiscard"
            type="button"
            variant="ghost"
            size="sm"
            class="shrink-0 text-muted-foreground hover:text-foreground"
            @click="discard"
          >
            {{ $t("common.discard") }}
          </Button>
          <Button
            type="button"
            size="sm"
            class="tac-amber-cta shrink-0"
            :loading="submitting"
            :disabled="!canSave"
            @click="save"
          >
            <span class="flex items-center gap-2">
              {{ actionLabel || $t("common.save_changes") }}
              <kbd
                class="hidden rounded border border-black/25 bg-black/10 px-1 py-px font-mono text-[0.65rem] leading-none sm:inline"
                >{{ saveShortcut }}</kbd
              >
            </span>
          </Button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.save-bar {
  background-color: hsl(var(--background) / 0.82);
  /* faint amber wash bleeding up from the bar's accent edge */
  background-image: radial-gradient(
    120% 140% at 50% 130%,
    hsl(var(--tac-amber) / 0.08),
    transparent 70%
  );
}
</style>
