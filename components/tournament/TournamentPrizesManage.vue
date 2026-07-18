<script lang="ts">
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Trash2, Plus, GripVertical } from "lucide-vue-next";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $ } from "~/generated/zeus";
import { toast } from "@/components/ui/toast";

const FRAME_CLASSES =
  "relative overflow-hidden rounded-lg border border-border px-6 py-6 [background:linear-gradient(180deg,hsl(var(--card)_/_0.7)_0%,hsl(var(--card)_/_0.35)_100%)] [backdrop-filter:blur(6px)] before:pointer-events-none before:absolute before:left-2 before:top-2 before:h-[14px] before:w-[14px] before:border-l-2 before:border-t-2 before:border-[hsl(var(--tac-amber))] before:content-[''] after:pointer-events-none after:absolute after:bottom-2 after:right-2 after:h-[14px] after:w-[14px] after:border-b-2 after:border-r-2 after:border-[hsl(var(--tac-amber))] after:content-['']";

export default {
  components: { Input, Button, Trash2, Plus, GripVertical },
  props: {
    tournament: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      frameClasses: FRAME_CLASSES,
      drafts: [] as Array<{ id: string; place: string; prize: string }>,
      newPlace: "",
      newPrize: "",
      savingId: null as string | null,
      adding: false,
    };
  },
  computed: {
    isOrganizer() {
      return !!this.tournament.is_organizer;
    },
  },
  watch: {
    "tournament.prizes": {
      handler() {
        this.syncDrafts();
      },
      immediate: true,
      deep: true,
    },
  },
  methods: {
    syncDrafts() {
      this.drafts = (this.tournament.prizes || []).map((prize: any) => {
        return {
          id: prize.id,
          place: prize.place,
          prize: prize.prize,
        };
      });
    },
    draftDirty(draft: { id: string; place: string; prize: string }) {
      const existing = (this.tournament.prizes || []).find(
        (prize: any) => prize.id === draft.id,
      );
      if (!existing) {
        return false;
      }
      return existing.place !== draft.place || existing.prize !== draft.prize;
    },
    async saveDraft(draft: { id: string; place: string; prize: string }) {
      const place = draft.place.trim();
      const prize = draft.prize.trim();
      if (!place || !prize) {
        return;
      }
      this.savingId = draft.id;
      try {
        await this.$apollo.mutate({
          mutation: typedGql("mutation")({
            update_tournament_prizes_by_pk: [
              {
                pk_columns: { id: $("id", "uuid!") },
                _set: {
                  place: $("place", "String!"),
                  prize: $("prize", "String!"),
                },
              },
              { id: true },
            ],
          }),
          variables: { id: draft.id, place, prize },
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      } finally {
        this.savingId = null;
      }
    },
    async removePrize(id: string) {
      this.savingId = id;
      try {
        await this.$apollo.mutate({
          mutation: typedGql("mutation")({
            delete_tournament_prizes_by_pk: [
              { id: $("id", "uuid!") },
              { id: true },
            ],
          }),
          variables: { id },
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      } finally {
        this.savingId = null;
      }
    },
    async addPrize() {
      const place = this.newPlace.trim();
      const prize = this.newPrize.trim();
      if (!place || !prize) {
        return;
      }
      this.adding = true;
      try {
        // New prizes go to the bottom of the list; order is a plain sort index.
        const nextOrder = (this.tournament.prizes || []).length;
        await this.$apollo.mutate({
          mutation: typedGql("mutation")({
            insert_tournament_prizes_one: [
              {
                object: {
                  tournament_id: $("tournament_id", "uuid!"),
                  place: $("place", "String!"),
                  prize: $("prize", "String!"),
                  order: $("order", "Int!"),
                },
              },
              { id: true },
            ],
          }),
          variables: {
            tournament_id: this.tournament.id,
            place,
            prize,
            order: nextOrder,
          },
        });
        this.newPlace = "";
        this.newPrize = "";
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      } finally {
        this.adding = false;
      }
    },
  },
};
</script>

<template>
  <section :class="frameClasses">
    <header class="relative mb-6 flex flex-col gap-1">
      <div
        class="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground"
      >
        <span
          class="translate-y-[-1px] text-[0.7rem] text-[hsl(var(--tac-amber))]"
          >◢</span
        >
        {{ $t("tournament.prizes.manage_title") }}
      </div>
      <div
        class="font-mono text-[0.62rem] uppercase tracking-[0.3em] text-muted-foreground/70"
      >
        {{ $t("tournament.prizes.manage_hint") }}
      </div>
    </header>

    <div
      v-if="!isOrganizer"
      class="rounded-sm border border-dashed border-border px-4 py-6 text-center font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground"
    >
      {{ $t("tournament.prizes.organizer_access_required") }}
    </div>

    <template v-else>
      <div class="flex flex-col gap-2">
        <div
          v-for="draft in drafts"
          :key="draft.id"
          class="flex items-center gap-2 rounded-sm border border-border/60 bg-background/40 p-2"
        >
          <GripVertical class="h-4 w-4 shrink-0 text-muted-foreground/50" />
          <Input
            v-model="draft.place"
            :placeholder="$t('tournament.prizes.place_placeholder')"
            maxlength="40"
            class="h-8 w-28 font-mono text-xs"
          />
          <Input
            v-model="draft.prize"
            :placeholder="$t('tournament.prizes.prize_placeholder')"
            maxlength="120"
            class="h-8 flex-1 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            :disabled="savingId === draft.id || !draftDirty(draft)"
            @click="saveDraft(draft)"
          >
            {{
              savingId === draft.id ? $t("common.saving") : $t("common.save")
            }}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            class="h-8 w-8 text-destructive"
            :disabled="savingId === draft.id"
            @click="removePrize(draft.id)"
          >
            <Trash2 class="h-4 w-4" />
          </Button>
        </div>

        <div
          class="mt-2 flex items-center gap-2 rounded-sm border border-dashed border-border/60 bg-background/20 p-2"
        >
          <span class="w-4 shrink-0"></span>
          <Input
            v-model="newPlace"
            :placeholder="$t('tournament.prizes.place_placeholder')"
            maxlength="40"
            class="h-8 w-28 font-mono text-xs"
            @keyup.enter="addPrize"
          />
          <Input
            v-model="newPrize"
            :placeholder="$t('tournament.prizes.prize_placeholder')"
            maxlength="120"
            class="h-8 flex-1 text-xs"
            @keyup.enter="addPrize"
          />
          <Button
            size="sm"
            :disabled="adding || !newPlace.trim() || !newPrize.trim()"
            @click="addPrize"
          >
            <Plus class="mr-1 h-4 w-4" />
            {{ $t("tournament.prizes.add") }}
          </Button>
        </div>
      </div>
    </template>
  </section>
</template>
