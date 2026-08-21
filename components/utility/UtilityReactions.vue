<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { ArrowBigDown, ArrowBigUp, Heart } from "lucide-vue-next";
import type { UtilityLineup } from "~/types/utility";

const props = withDefaults(
  defineProps<{
    lineup: Pick<
      UtilityLineup,
      "id" | "upvotes" | "downvotes" | "my_vote" | "favorites" | "is_favorited"
    >;
    // Signed out, the counts still read fine -- they just stop being buttons.
    canReact?: boolean;
    // The detail surfaces have room to offer the other direction; a card in a
    // 400px column does not, and a downvote is not a thing you reach for while
    // scanning a list.
    showDownvote?: boolean;
    size?: "sm" | "md";
  }>(),
  {
    canReact: false,
    showDownvote: false,
    size: "sm",
  },
);

const emit = defineEmits<{
  (e: "vote", id: string, value: 1 | -1): void;
  (e: "favorite", id: string): void;
}>();

const { t } = useI18n();

// Read through normalisers, never off the row. A card rendered somewhere that
// does not select the viewer's own columns would otherwise show undefined as
// "not voted" and then compute NaN the moment you click it.
const myVote = computed(() => Number(props.lineup.my_vote ?? 0));
const isFavorited = computed(() => props.lineup.is_favorited === true);
const favoriteCount = computed(() => Number(props.lineup.favorites ?? 0));

const score = computed(
  () => Number(props.lineup.upvotes ?? 0) - Number(props.lineup.downvotes ?? 0),
);

const voteTitle = computed(() =>
  myVote.value === 1
    ? t("pages.utility.card.unvote")
    : t("pages.utility.card.upvote"),
);

const downvoteTitle = computed(() =>
  myVote.value === -1
    ? t("pages.utility.card.unvote")
    : t("pages.utility.card.downvote"),
);

const favoriteTitle = computed(() =>
  isFavorited.value
    ? t("pages.utility.card.unfavorite")
    : t("pages.utility.card.favorite"),
);

// The whole control is one row of hit targets, so they are sized as targets
// rather than as text. 1.75rem clears the 24px minimum without making the
// cluster taller than the author line it sits beside.
const glyph = computed(() => (props.size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"));
const digits = computed(() =>
  props.size === "md" ? "text-xs" : "text-[0.7rem]",
);
</script>

<template>
  <div
    class="flex shrink-0 items-center gap-1 font-mono tabular-nums"
    :class="digits"
  >
    <button
      type="button"
      :disabled="!canReact"
      class="inline-flex h-7 items-center gap-1.5 rounded px-1.5 transition-colors disabled:cursor-default disabled:opacity-60"
      :class="
        myVote === 1
          ? 'text-[hsl(var(--tac-amber))]'
          : 'text-muted-foreground enabled:hover:bg-muted/50 enabled:hover:text-foreground'
      "
      :title="voteTitle"
      @click.stop="emit('vote', lineup.id, 1)"
    >
      <ArrowBigUp
        :class="[glyph, myVote === 1 ? 'fill-current' : '']"
        class="transition-transform"
      />
      {{ score }}
    </button>

    <button
      v-if="showDownvote"
      type="button"
      :disabled="!canReact"
      class="inline-flex h-7 items-center justify-center rounded px-1.5 transition-colors disabled:cursor-default disabled:opacity-60"
      :class="
        myVote === -1
          ? 'text-destructive'
          : 'text-muted-foreground enabled:hover:bg-muted/50 enabled:hover:text-foreground'
      "
      :title="downvoteTitle"
      @click.stop="emit('vote', lineup.id, -1)"
    >
      <ArrowBigDown
        :class="[glyph, myVote === -1 ? 'fill-current' : '']"
        class="transition-transform"
      />
    </button>

    <button
      type="button"
      :disabled="!canReact"
      class="inline-flex h-7 items-center gap-1.5 rounded px-1.5 transition-colors disabled:cursor-default disabled:opacity-60"
      :class="
        isFavorited
          ? 'text-destructive'
          : 'text-muted-foreground enabled:hover:bg-muted/50 enabled:hover:text-foreground'
      "
      :title="favoriteTitle"
      @click.stop="emit('favorite', lineup.id)"
    >
      <Heart
        :class="[glyph, isFavorited ? 'fill-current' : '']"
        class="transition-transform"
      />
      {{ favoriteCount }}
    </button>
  </div>
</template>
