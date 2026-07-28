<script lang="ts" setup>
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import { tacticalSectionLabelClasses } from "~/utilities/tacticalClasses";
</script>

<template>
  <section v-if="partners.length > 0" class="flex flex-col gap-3">
    <div :class="[tacticalSectionLabelClasses, 'mb-0']">
      {{ $t("pages.players.queue_partners.title") }}
    </div>

    <div
      class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
      role="list"
    >
      <NuxtLink
        v-for="partner of partners"
        :key="partner.partner_steam_id"
        role="listitem"
        :to="{ name: 'players-id', params: { id: partner.partner_steam_id } }"
        class="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-card/40 px-3 py-2 transition-colors hover:border-[hsl(var(--tac-amber)/0.55)]"
      >
        <PlayerDisplay
          :player="partner.partner"
          :show-role="false"
          class="min-w-0"
        />

        <div class="shrink-0 text-right">
          <div
            class="font-mono text-sm font-semibold tabular-nums leading-none"
          >
            {{
              $t("pages.players.queue_partners.matches", {
                count: partner.matches_together,
              })
            }}
          </div>
          <div
            class="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            {{ winRate(partner) }}
            <template v-if="partner.last_played_at">
              &middot; <TimeAgo :date="partner.last_played_at" />
            </template>
          </div>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>

<script lang="ts">
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";

// Just what PlayerDisplay renders. The shared playerFields selector is 24
// columns wide (including the `elo` computed field) and pushes this query
// past the type checker's instantiation depth on a schema this size.
const partnerFields = {
  name: true,
  role: true,
  country: true,
  steam_id: true,
  avatar_url: true,
  custom_avatar_url: true,
} as const;

export default {
  props: {
    playerId: {
      type: String,
      required: true,
    },
    limit: {
      type: Number,
      default: 6,
    },
  },
  data() {
    return {
      rows: [] as Array<any>,
    };
  },
  computed: {
    // Most-played first, most-recent breaking ties (see the order_by note).
    partners(): Array<any> {
      return [...(this as any).rows].sort((a: any, b: any) => {
        if (b.matches_together !== a.matches_together) {
          return b.matches_together - a.matches_together;
        }
        return (
          new Date(b.last_played_at ?? 0).getTime() -
          new Date(a.last_played_at ?? 0).getTime()
        );
      });
    },
  },
  methods: {
    winRate(partner: any): string {
      if (!partner.matches_together) {
        return "—";
      }
      const pct = Math.round(
        (partner.wins_together / partner.matches_together) * 100,
      );
      return this.$t("pages.players.queue_partners.win_rate", { pct });
    },
  },
  apollo: {
    $subscribe: {
      v_player_queue_partners: {
        query: typedGql("subscription")({
          v_player_queue_partners: [
            {
              where: {
                steam_id: {
                  _eq: $("steamId", "bigint!"),
                },
              },
              // Single key: a second order_by entry also overruns the
              // instantiation budget. Recency is a tiebreak only, so it is
              // applied client-side in `partners`.
              order_by: [{ matches_together: order_by.desc }],
              limit: $("limit", "Int!"),
            },
            {
              partner_steam_id: true,
              matches_together: true,
              wins_together: true,
              last_played_at: true,
              partner: partnerFields,
            },
          ],
        }),
        variables: function (): { steamId: string; limit: number } {
          return {
            steamId: (this as any).playerId,
            limit: (this as any).limit,
          };
        },
        skip: function () {
          return !(this as any).playerId;
        },
        result: function ({ data }: { data: any }) {
          (this as any).rows = data?.v_player_queue_partners ?? [];
        },
      },
    },
  },
};
</script>
