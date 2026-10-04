<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowRight, Crown, User, X } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import WatchSegmented from "~/components/watch/WatchSegmented.vue";
import { HOST_TYPES, formatLabel, snakeBoard } from "~/components/play/draftHost";

const emit = defineEmits<{ (event: "dismiss"): void }>();

// Every format with a draft to show: a duel has none.
const formats = HOST_TYPES.filter((option) => option.perSide > 1);
const formatOptions = formats.map((option) => ({
  key: option.type,
  label: formatLabel(option.type),
}));
const format = ref(formats[0].type);

const board = computed(() =>
  snakeBoard(formats.find((option) => option.type === format.value)!.perSide),
);

const steps = ["open", "join", "draft", "play"];
</script>

<template>
  <div
    class="relative flex flex-wrap gap-6 rounded-lg border border-border bg-muted/20 p-5 sm:p-6"
  >
    <Button
      variant="ghost"
      size="icon"
      class="absolute right-2 top-2 size-8 text-muted-foreground hover:text-foreground"
      :aria-label="$t('pages.play.draft_rooms.intro.dismiss')"
      @click="emit('dismiss')"
    >
      <X class="size-4" />
    </Button>

    <div
      class="flex min-w-0 flex-[1_1_360px] flex-col justify-center gap-5 pr-8"
    >
      <div>
        <h3
          class="m-0 mb-2.5 text-[28px] font-bold leading-[1.1] [text-wrap:balance]"
        >
          {{ $t("pages.play.draft_rooms.intro.title") }}
        </h3>
        <p
          class="m-0 max-w-[46ch] text-sm leading-relaxed text-muted-foreground [text-wrap:pretty]"
        >
          {{ $t("pages.play.draft_rooms.intro.body") }}
        </p>
      </div>

      <ol
        class="m-0 flex list-none flex-wrap items-center gap-x-3 gap-y-2 p-0 text-[13px] font-semibold"
      >
        <li
          v-for="(step, index) in steps"
          :key="step"
          class="flex items-center gap-3"
        >
          <span>
            <span class="mr-1.5 tabular-nums text-[hsl(var(--tac-amber))]">
              {{ index + 1 }}
            </span>
            {{ $t(`pages.play.draft_rooms.intro.steps.${step}`) }}
          </span>
          <ArrowRight
            v-if="index < steps.length - 1"
            class="size-3.5 text-muted-foreground/60"
          />
        </li>
      </ol>
    </div>

    <figure
      class="m-0 grid min-w-0 flex-[1_1_400px] content-start gap-3.5 rounded-md border border-border bg-background p-4"
      :aria-label="$t('pages.play.draft_rooms.intro.board_label')"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <WatchSegmented
          v-model="format"
          :options="formatOptions"
          :label="$t('pages.play.draft_rooms.format_label')"
        />
        <span class="text-xs text-muted-foreground">
          {{ $t("draft_games.draft_order.snake") }}
        </span>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div
          v-for="(slots, side) in board.teams"
          :key="side"
          class="grid content-start gap-1.5"
        >
          <div
            class="flex items-center gap-2.5 border-b border-border/60 px-0.5 pb-2"
          >
            <span
              class="relative grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
            >
              <User class="size-3.5" />
              <span
                class="absolute -bottom-1 -right-1 grid size-3.5 place-items-center rounded-sm bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))]"
              >
                <Crown class="size-2.5" />
              </span>
            </span>
            <b class="truncate text-[13.5px] font-bold">
              {{
                side === 1
                  ? $t("pages.play.draft_rooms.intro.you")
                  : $t("pages.play.draft_rooms.intro.captain")
              }}
            </b>
          </div>

          <div
            v-for="slot in slots"
            :key="slot.pick"
            class="flex h-9 items-center gap-2.5 rounded-md px-2.5"
            :class="{
              'border border-border bg-muted/45': slot.state === 'picked',
              'border border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.06)]':
                slot.state === 'picking',
              'border border-dashed border-muted-foreground/30':
                slot.state === 'open',
            }"
          >
            <span
              class="w-3.5 text-[11px] tabular-nums"
              :class="
                slot.state === 'picking'
                  ? 'text-[hsl(var(--tac-amber))]'
                  : 'text-muted-foreground'
              "
            >
              {{ slot.pick }}
            </span>
            <template v-if="slot.state === 'picked'">
              <span
                class="grid size-[22px] place-items-center rounded-full bg-muted text-muted-foreground"
              >
                <User class="size-3" />
              </span>
              <span class="h-1.5 w-14 rounded-sm bg-muted-foreground/30"></span>
            </template>
            <span
              v-else-if="slot.state === 'picking'"
              class="text-[12.5px] font-semibold text-[hsl(var(--tac-amber))]"
            >
              {{
                side === 1
                  ? $t("pages.play.draft_rooms.intro.your_pick")
                  : $t("pages.play.draft_rooms.intro.picking")
              }}
            </span>
          </div>
        </div>
      </div>

      <div class="grid gap-2 border-t border-border/60 pt-2.5">
        <span class="text-xs text-muted-foreground">
          {{ $t("pages.play.draft_rooms.intro.pool") }}
        </span>
        <div class="flex flex-wrap gap-1.5" aria-hidden="true">
          <span
            v-for="n in board.pool"
            :key="n"
            class="grid size-7 place-items-center rounded-full border border-border bg-muted/45 text-muted-foreground"
          >
            <User class="size-3.5" />
          </span>
        </div>
      </div>
    </figure>
  </div>
</template>
