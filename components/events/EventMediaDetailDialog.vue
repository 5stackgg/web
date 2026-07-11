<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { Trash2, X } from "lucide-vue-next";
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
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import EventPlayerPicker from "~/components/events/EventPlayerPicker.vue";
import ClipPlayer from "~/components/clips/ClipPlayer.vue";
import EventAudioPlayer from "~/components/events/EventAudioPlayer.vue";
import { ExternalLink } from "lucide-vue-next";
import { generateMutation } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";
import { eventMediaUrl } from "~/composables/useEventMediaUpload";
import { useMediaPlayback } from "~/composables/useMediaPlayback";
import { parseExternalMedia } from "~/utilities/externalMedia";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const props = defineProps<{
  open: boolean;
  event: any;
  media: any | null;
  canEdit: boolean;
}>();

const emit = defineEmits<{
  (e: "update:open", v: boolean): void;
  (e: "delete", media: any): void;
}>();

const { client: apolloClient } = useApolloClient();
const { t } = useI18n();
const playback = useMediaPlayback();

const title = ref("");
const savingTitle = ref(false);

watch(
  () => [props.open, props.media?.id] as const,
  () => {
    title.value = props.media?.title ?? "";
  },
  { immediate: true },
);

const src = computed(() =>
  props.media?.filename
    ? eventMediaUrl(props.event.id, props.media.filename)
    : "",
);

const external = computed(() =>
  props.media?.external_url
    ? parseExternalMedia(props.media.external_url, useRequestURL().hostname)
    : null,
);

const taggedSteamIds = computed<string[]>(() =>
  (props.media?.players || []).map((row: any) => String(row.steam_id)),
);

const updateTitleMutation = generateMutation({
  update_event_media_by_pk: [
    {
      pk_columns: { id: $("id", "uuid!") },
      _set: { title: $("title", "String") },
    },
    { id: true },
  ],
});

const tagPlayerMutation = generateMutation({
  insert_event_media_players_one: [
    {
      object: {
        media_id: $("mediaId", "uuid!"),
        steam_id: $("steamId", "bigint!"),
      },
    },
    { media_id: true },
  ],
});

const untagPlayerMutation = generateMutation({
  delete_event_media_players_by_pk: [
    { media_id: $("mediaId", "uuid!"), steam_id: $("steamId", "bigint!") },
    { media_id: true },
  ],
});

// Auto-saves on blur / Enter; only mutates when the title actually changed
// (blur fires on every focus loss), and never while another save is running.
async function saveTitle() {
  if (!props.media) return;
  const next = title.value.trim();
  if (savingTitle.value || (props.media.title ?? "") === next) return;
  savingTitle.value = true;
  try {
    await apolloClient.mutate({
      mutation: updateTitleMutation,
      variables: { id: props.media.id, title: next || null },
    });
    toast({ title: t("event.media.saved") });
  } catch (error: any) {
    toast({ title: error?.message, variant: "destructive" });
  } finally {
    savingTitle.value = false;
  }
}

async function tagPlayer(player: { steam_id: string | number }) {
  if (!props.media) return;
  try {
    await apolloClient.mutate({
      mutation: tagPlayerMutation,
      variables: { mediaId: props.media.id, steamId: player.steam_id },
    });
  } catch (error: any) {
    toast({ title: error?.message, variant: "destructive" });
  }
}

async function untagPlayer(steamId: string | number) {
  if (!props.media) return;
  try {
    await apolloClient.mutate({
      mutation: untagPlayerMutation,
      variables: { mediaId: props.media.id, steamId },
    });
  } catch (error: any) {
    toast({ title: error?.message, variant: "destructive" });
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="max-w-4xl">
      <DialogHeader>
        <DialogTitle class="truncate pr-8">
          {{ media?.title || $t("event.media.details") }}
        </DialogTitle>
      </DialogHeader>

      <div v-if="media" class="grid gap-4">
        <div
          class="overflow-hidden rounded-md border border-border bg-black/60"
        >
          <template v-if="external">
            <div v-if="external.embedUrl" class="aspect-video w-full">
              <iframe
                :src="external.embedUrl"
                class="h-full w-full"
                frameborder="0"
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowfullscreen
              />
            </div>
            <a
              v-else
              :href="external.watchUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center justify-center gap-2 p-6 text-sm text-white/80 transition-colors hover:text-[hsl(var(--tac-amber))]"
            >
              <ExternalLink class="h-5 w-5" />
              {{ external.watchUrl }}
            </a>
          </template>
          <ClipPlayer
            v-else-if="media.mime_type?.startsWith('video/')"
            :src="src"
            :clip-key="media.id"
            :poster="
              media.thumbnail_filename
                ? eventMediaUrl(event.id, media.thumbnail_filename)
                : null
            "
            @play="playback.claim(`dialog-${media.id}`)"
          />
          <div
            v-else-if="media.mime_type?.startsWith('audio/')"
            class="min-h-[120px]"
          >
            <EventAudioPlayer
              :src="src"
              :title="media.title"
              :media-id="`dialog-${media.id}`"
            />
          </div>
          <img v-else :src="src" class="max-h-[60vh] w-full object-contain" />
        </div>

        <div v-if="canEdit" class="grid gap-2">
          <Label
            class="font-mono text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground"
            for="event-media-title"
          >
            {{ $t("event.media.title_label") }}
          </Label>
          <Input
            id="event-media-title"
            v-model="title"
            :placeholder="$t('event.media.title_placeholder')"
            @blur="saveTitle"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
          />
        </div>

        <div class="grid gap-2">
          <div :class="[tacticalSectionLabelClasses, '!mb-0']">
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("event.media.players_label") }}
          </div>

          <div
            v-if="(media.players?.length ?? 0) > 0"
            class="flex flex-wrap gap-2"
          >
            <span
              v-for="row in media.players"
              :key="row.steam_id"
              class="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-card/50 py-1 pl-1.5 pr-1"
            >
              <PlayerDisplay
                v-if="row.player"
                :player="row.player"
                size="xs"
                compact
                :show-flag="false"
                :show-role="false"
                :show-elo="false"
                :show-online="false"
                :tooltip="false"
                linkable
              />
              <button
                v-if="canEdit"
                type="button"
                class="rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
                :aria-label="$t('common.remove')"
                @click="untagPlayer(row.steam_id)"
              >
                <X class="h-3 w-3" />
              </button>
            </span>
          </div>
          <p v-else class="text-xs text-muted-foreground">
            {{ $t("event.media.no_players") }}
          </p>

          <EventPlayerPicker
            v-if="canEdit"
            :event-id="event.id"
            :exclude="taggedSteamIds"
            @selected="tagPlayer"
          />
        </div>

        <div
          v-if="canEdit"
          class="flex justify-end border-t border-border/60 pt-3"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="text-destructive"
            @click="emit('delete', media)"
          >
            <Trash2 class="mr-1.5 h-4 w-4" />
            {{ $t("event.media.delete") }}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
