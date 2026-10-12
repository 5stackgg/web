<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { onClickOutside } from "@vueuse/core";
import { Check, Clapperboard, Link2, Share2, X } from "lucide-vue-next";
import Kbd from "~/components/ui/kbd/Kbd.vue";
import { formatClipTime } from "~/composables/useReplayShare";
import type { ClipRangeKind, ReplayShare } from "~/composables/useReplayShare";

/**
 * The transport's share button: copy a link to this moment, export a clip
 * of the stage. While a clip records, its progress sits next to the button.
 */
const props = defineProps<{ share: ReplayShare }>();
const { t } = useI18n();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
onClickOutside(root, () => (open.value = false));

function onKey(event: KeyboardEvent) {
  if (event.key === "Escape") {
    open.value = false;
  }
}
watch(open, (isOpen) => {
  if (isOpen) {
    window.addEventListener("keydown", onKey);
  } else {
    window.removeEventListener("keydown", onKey);
  }
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));

const ranges = computed(() =>
  (["round", "last", "marks"] as ClipRangeKind[]).map((kind) => ({
    kind,
    label: t(`match.replay.share.range_${kind}`),
    seconds: props.share.rangeSeconds(kind),
  })),
);

const progress = computed(() =>
  props.share.exportLength > 0
    ? Math.min(
        100,
        (props.share.exportElapsed / props.share.exportLength) * 100,
      )
    : 0,
);

function startExport(kind: ClipRangeKind) {
  open.value = false;
  void props.share.exportClip(kind);
}

const markTime = (which: "in" | "out") => {
  const seconds = props.share.markSeconds(which);
  return seconds === null ? "–" : formatClipTime(seconds);
};
</script>

<template>
  <div ref="root" class="rs">
    <div v-if="share.exporting" class="rs-rec" role="status">
      <span class="rs-dot" />
      <span class="rs-rec-label">
        {{
          share.exportHidden
            ? t("match.replay.share.hidden_paused")
            : `${formatClipTime(share.exportElapsed)} / ${formatClipTime(share.exportLength)}`
        }}
      </span>
      <span class="rs-track"><span :style="{ width: `${progress}%` }" /></span>
      <button
        type="button"
        class="rs-cancel"
        :aria-label="t('match.replay.share.cancel')"
        :title="t('match.replay.share.cancel')"
        @click="share.cancelExport()"
      >
        <X :size="14" />
      </button>
    </div>
    <button
      type="button"
      class="rs-btn"
      :class="{ on: open }"
      :aria-label="t('match.replay.share.share')"
      :title="t('match.replay.share.share')"
      :aria-expanded="open"
      @click="open = !open"
    >
      <Share2 :size="16" />
    </button>
    <div v-if="open" class="rs-pop">
      <button type="button" class="rs-item" @click="share.copyLink()">
        <Check v-if="share.copied" :size="14" class="rs-ok" />
        <Link2 v-else :size="14" />
        <span>{{
          share.copied
            ? t("match.replay.share.link_copied")
            : t("match.replay.share.copy_link")
        }}</span>
      </button>
      <template v-if="share.canExport">
        <div class="rs-head">
          <span>{{ t("match.replay.share.export_clip") }}</span>
          <span>{{ share.format }}</span>
        </div>
        <button
          v-for="range in ranges"
          :key="range.kind"
          type="button"
          class="rs-item"
          :disabled="range.seconds === null || share.exporting"
          @click="startExport(range.kind)"
        >
          <Clapperboard :size="14" />
          <span>{{ range.label }}</span>
          <span class="rs-time">{{
            range.seconds === null ? "–" : formatClipTime(range.seconds)
          }}</span>
        </button>
        <div class="rs-marks">
          <button
            type="button"
            class="rs-mark"
            :disabled="share.exporting"
            @click="share.setMark('in')"
          >
            <Kbd>I</Kbd>
            <span>{{ t("match.replay.share.mark_in") }}</span>
            <span class="rs-time">{{ markTime("in") }}</span>
          </button>
          <button
            type="button"
            class="rs-mark"
            :disabled="share.exporting"
            @click="share.setMark('out')"
          >
            <Kbd>O</Kbd>
            <span>{{ t("match.replay.share.mark_out") }}</span>
            <span class="rs-time">{{ markTime("out") }}</span>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.rs {
  position: relative;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
}
.rs-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 44px;
  color: #9fb0c0;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--line);
  border-radius: 6px;
  cursor: pointer;
}
.rs-btn:hover,
.rs-btn.on {
  border-color: var(--accent);
  color: #f0f6fc;
}
.rs-pop {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 272px;
  padding: 6px;
  background: rgba(12, 15, 20, 0.95);
  border: 1px solid var(--line);
  border-radius: 6px;
  backdrop-filter: blur(8px);
}
.rs-item,
.rs-mark {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  color: #c4d2df;
  font-family: inherit;
  font-size: 12px;
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
}
.rs-item:hover:not(:disabled),
.rs-mark:hover:not(:disabled) {
  color: #f0f6fc;
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--line);
}
.rs-item:disabled,
.rs-mark:disabled {
  color: #5d6876;
  cursor: default;
}
.rs-item > span:first-of-type,
.rs-mark > span:first-of-type {
  flex: 1;
}
.rs-ok {
  color: hsl(142, 70%, 55%);
}
.rs-time {
  color: #8a98a8;
  font-variant-numeric: tabular-nums;
}
.rs-head {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  padding: 7px 8px 3px;
  border-top: 1px solid var(--line);
  color: #6b7785;
  font-size: 9px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}
.rs-marks {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
}
.rs-mark {
  padding: 6px;
  font-size: 11px;
  white-space: nowrap;
}
.rs-rec {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 6px 0 12px;
  color: #d6e0ea;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  background: rgba(12, 15, 20, 0.6);
  border: 1px solid var(--line);
  border-radius: 6px;
}
.rs-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff5a4d;
}
.rs-rec-label {
  white-space: nowrap;
}
.rs-track {
  position: relative;
  width: 64px;
  height: 4px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}
.rs-track > span {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--accent);
}
.rs-cancel {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: #9fb0c0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
}
.rs-cancel:hover {
  color: #f0f6fc;
  border-color: var(--line);
}
</style>
