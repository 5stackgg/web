<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Pencil, Trash2 } from "lucide-vue-next";
import { toast } from "@/components/ui/toast";
import EventMediaTile from "~/components/events/EventMediaTile.vue";
import EventMediaDetailDialog from "~/components/events/EventMediaDetailDialog.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";

// Self-contained media card matching the highlights look: the clip fills the
// frame, title + tagged players overlay the bottom on a gradient, and edit /
// delete live top-right for anyone who can manage it. Owns its own detail
// dialog + delete so both the overview rail and the media tab reuse it.
const props = defineProps<{
  event: { id: string; is_organizer?: boolean };
  item: {
    id: string;
    filename: string;
    mime_type: string;
    title?: string | null;
    thumbnail_filename?: string | null;
    uploader_steam_id: string;
    uploader?: { name?: string } | null;
    players?: any[];
  };
}>();

const { t } = useI18n();
const me = computed(() => useAuthStore().me);

const canEdit = computed(
  () =>
    props.event.is_organizer === true ||
    String(props.item.uploader_steam_id) === String(me.value?.steam_id),
);

const detailOpen = ref(false);
const deleting = ref(false);

async function deleteMedia() {
  deleting.value = true;
  try {
    const apiDomain = useRuntimeConfig().public.apiDomain;
    const response = await fetch(
      `https://${apiDomain}/events/media/${props.event.id}/${props.item.id}`,
      { method: "DELETE", credentials: "include" },
    );
    if (!response.ok) {
      throw new Error(
        (await response.text()) || `${response.status} ${response.statusText}`,
      );
    }
    detailOpen.value = false;
    toast({ title: t("event.media.deleted") });
  } catch (error: any) {
    toast({ title: error?.message, variant: "destructive" });
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div
    class="group relative aspect-video w-full overflow-hidden rounded-md border border-border/70 bg-black transition-[border-color] duration-150 hover:border-[hsl(var(--tac-amber)/0.45)]"
  >
    <EventMediaTile :event="event" :item="item" />

    <!-- top-right manage controls -->
    <div
      v-if="canEdit"
      class="absolute right-2 top-2 z-[3] flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
    >
      <button
        type="button"
        class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/90 hover:text-[hsl(var(--tac-amber))]"
        :title="$t('event.media.details')"
        @click.stop="detailOpen = true"
      >
        <Pencil class="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/90 hover:text-destructive disabled:opacity-50"
        :title="$t('event.media.delete')"
        :disabled="deleting"
        @click.stop="deleteMedia"
      >
        <Trash2 class="h-3.5 w-3.5" />
      </button>
    </div>

    <!-- bottom gradient with title + tagged players -->
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2 pt-6"
    >
      <p class="truncate text-xs font-semibold text-white">
        {{ item.title || $t("event.media.untitled") }}
      </p>
      <div
        v-if="item.players?.length"
        class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5"
      >
        <PlayerDisplay
          v-for="row in item.players.slice(0, 3)"
          :key="row.steam_id"
          :player="row.player || { steam_id: row.steam_id }"
          size="xs"
          compact
          :show-flag="false"
          :show-role="false"
          :show-elo="false"
          :show-online="false"
          :tooltip="false"
          :linkable="false"
        />
        <span
          v-if="item.players.length > 3"
          class="font-mono text-[0.58rem] text-white/70"
        >
          +{{ item.players.length - 3 }}
        </span>
      </div>
      <p
        v-else-if="item.uploader?.name"
        class="mt-0.5 truncate font-mono text-[0.58rem] uppercase tracking-[0.14em] text-white/60"
      >
        {{ item.uploader.name }}
      </p>
    </div>

    <EventMediaDetailDialog
      v-model:open="detailOpen"
      :event="event"
      :media="item"
      :can-edit="canEdit"
      @delete="deleteMedia"
    />
  </div>
</template>
