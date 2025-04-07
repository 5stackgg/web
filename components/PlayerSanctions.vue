<script lang="ts" setup>
import TimeAgo from "@/components/TimeAgo.vue";
import { ChevronDownIcon } from "lucide-vue-next";
</script>

<template>
  <div class="flex flex-col gap-2" v-if="sanctions && sanctions.length > 0">
    <Collapsible>
      <CollapsibleTrigger class="flex items-center gap-2">
        <Badge variant="destructive"
          >{{
            activeSanctions
              ? $t("player.sanctions.active_count", { count: activeSanctions })
              : $t("player.sanctions.past_count", { count: sanctions.length })
          }}
          {{ $t("player.sanctions.title") }}</Badge
        >
        <ChevronDownIcon class="h-4 w-4" />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <Card class="mt-2">
          <CardContent class="pt-4">
            <div class="flex flex-col gap-4">
              <div
                v-for="sanction in sanctions"
                :key="sanction.created_at"
                class="flex flex-col gap-1"
              >
                <div class="flex justify-between">
                  <span class="font-medium capitalize">{{
                    sanction.type
                  }}</span>
                  <span class="text-sm text-muted-foreground">
                    {{ new Date(sanction.created_at).toLocaleString() }}
                  </span>
                </div>
                <p class="text-sm text-muted-foreground">
                  {{ sanction.reason }}
                </p>
                <div
                  v-if="sanction.remove_sanction_date"
                  class="text-sm flex gap-2 items-center"
                >
                  {{ $t("player.sanctions.expires") }}
                  <TimeAgo :date="sanction.remove_sanction_date" />
                </div>
                <Separator
                  class="my-2"
                  v-if="
                    sanctions.length > 1 &&
                    sanctions.indexOf(sanction) !== sanctions.length - 1
                  "
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $ } from "~/generated/zeus";

export default {
  props: {
    playerId: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      sanctions: [] as any[],
    };
  },
  apollo: {
    $subscribe: {
      player_sanctions: {
        query: typedGql("subscription")({
          player_sanctions: [
            {
              where: {
                player_steam_id: {
                  _eq: $("playerId", "bigint!"),
                },
              },
            },
            {
              type: true,
              reason: true,
              created_at: true,
              remove_sanction_date: true,
            },
          ],
        }),
        variables() {
          return {
            playerId: this.playerId,
          };
        },
        result({ data }: { data: any }) {
          this.sanctions = data.player_sanctions;
        },
      },
    },
  },
  computed: {
    activeSanctions() {
      return this.sanctions.filter((sanction) => {
        if (sanction.remove_sanction_date) {
          return new Date(sanction.remove_sanction_date) > new Date();
        }
        return true;
      }).length;
    },
  },
};
</script>
