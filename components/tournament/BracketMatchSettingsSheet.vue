<script setup lang="ts">
import MatchForm from "~/components/match/MatchForm.vue";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
</script>

<template>
  <Sheet :open="open" @update:open="(value) => $emit('update:open', value)">
    <SheetContent side="right" class="w-full overflow-y-auto sm:max-w-3xl">
      <SheetHeader class="text-left">
        <SheetTitle>{{ $t("tournament.page.match_settings") }}</SheetTitle>
        <SheetDescription v-if="description">
          {{ description }}
        </SheetDescription>
      </SheetHeader>
      <MatchForm
        v-if="match"
        :match="match"
        contained
        class="mt-6 !max-w-none"
      />
    </SheetContent>
  </Sheet>
</template>

<script lang="ts">
import { $ } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import { matchOptionsFields } from "~/graphql/matchOptionsFields";
import { toast } from "@/components/ui/toast";

export default {
  emits: ["update:open"],
  props: {
    open: {
      type: Boolean,
      required: true,
    },
    matchId: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
  },
  provide() {
    return {
      refetchMatchStatic: () => this.load(),
    };
  },
  data() {
    return {
      match: null as Record<string, any> | null,
    };
  },
  watch: {
    matchId: {
      immediate: true,
      handler() {
        this.match = null;
        this.load();
      },
    },
    open(open: boolean) {
      if (open) {
        this.match = null;
        this.load();
      }
    },
  },
  methods: {
    async load() {
      const matchId = this.matchId;
      try {
        const { data } = await this.$apollo.query({
          fetchPolicy: "network-only",
          variables: { matchId },
          query: generateQuery({
            matches_by_pk: [
              { id: $("matchId", "uuid!") },
              {
                id: true,
                status: true,
                is_tournament_match: true,
                lineup_1: { id: true, team_id: true },
                lineup_2: { id: true, team_id: true },
                options: matchOptionsFields,
              },
            ],
          }),
        });
        if (matchId === this.matchId) {
          this.match = data?.matches_by_pk ?? null;
        }
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      }
    },
  },
};
</script>
