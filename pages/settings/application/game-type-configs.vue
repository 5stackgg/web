<script setup lang="ts">
import PageHeading from "~/components/PageHeading.vue";
import GameTypeConfigRow from "~/components/game-type-configs/GameTypeConfigRow.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";

definePageMeta({
  layout: "application-settings",
});
</script>

<template>
  <PageTransition :delay="0">
    <PageHeading>
      <template #title>
        {{ $t("pages.settings.application.game_type_configs.title") }}
      </template>
      <template #description>
        {{ $t("pages.settings.application.game_type_configs.description") }}
      </template>
    </PageHeading>
  </PageTransition>

  <PageTransition :delay="100">
    <AnimatedCard variant="gradient" class="p-4">
      <!-- Loading skeleton -->
      <div v-if="loading" class="space-y-4">
        <Skeleton class="h-12 w-full" />
        <div class="space-y-3">
          <Skeleton class="h-16 w-full" />
          <Skeleton class="h-16 w-full" />
          <Skeleton class="h-16 w-full" />
          <Skeleton class="h-16 w-full" />
          <Skeleton class="h-16 w-full" />
          <Skeleton class="h-16 w-full" />
        </div>
      </div>

      <!-- Actual content -->
      <Table v-else>
        <TableHeader>
          <TableRow>
            <TableHead class="flex items-center justify-between m-4">
              <span>{{
                $t("pages.settings.application.game_type_configs.type")
              }}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <GameTypeConfigRow
            v-for="gameTypeConfig in gameTypeConfigs"
            :key="gameTypeConfig.type"
            :gameConfig="gameTypeConfig"
          />
        </TableBody>
      </Table>
    </AnimatedCard>
  </PageTransition>
</template>

<script lang="ts">
import { generateSubscription } from "~/graphql/graphqlGen";
import { defineComponent } from "vue";
import { e_game_cfg_types_enum } from "~/generated/zeus";
interface GameTypeConfig {
  type: string;
  cfg: string;
}

interface ComponentData {
  gameTypeConfigs: GameTypeConfig[];
  loading: boolean;
}

export default defineComponent<ComponentData>({
  apollo: {
    $subscribe: {
      gameTypeConfigs: {
        query: generateSubscription({
          match_type_cfgs: [
            {},
            {
              type: true,
              cfg: true,
            },
          ],
        }),
        result: async function ({
          data,
        }: {
          data: { match_type_cfgs: GameTypeConfig[] };
        }) {
          const gameConfigTypes = [
            e_game_cfg_types_enum.Lan,
            e_game_cfg_types_enum.Competitive,
            e_game_cfg_types_enum.Wingman,
            e_game_cfg_types_enum.Duel,
          ];

          for (const type of gameConfigTypes) {
            if (!data.match_type_cfgs.find((config) => config.type === type)) {
              data.match_type_cfgs.push({
                type,
                cfg: await this.getDefaultConfigs(type),
              });
            }
          }

          this.gameTypeConfigs = data.match_type_cfgs.sort((a, b) => {
            return (
              gameConfigTypes.indexOf(a.type) - gameConfigTypes.indexOf(b.type)
            );
          });

          this.loading = false;
        },
      },
    },
  },
  data(): ComponentData {
    return {
      gameTypeConfigs: [],
      loading: true,
    };
  },
  methods: {
    async getDefaultConfigs(type: e_match_types_enum) {
      return await $fetch(`/api/get-default-config?type=${type}`);
    },
  },
});
</script>
