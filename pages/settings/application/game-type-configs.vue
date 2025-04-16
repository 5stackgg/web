<script setup lang="ts">
import PageHeading from "~/components/PageHeading.vue";
import GameTypeConfigRow from "~/components/game-type-configs/GameTypeConfigRow.vue";

definePageMeta({
  layout: "application-settings",
});
</script>

<template>
  <PageHeading>
    <template #title>
      {{ $t("pages.settings.application.game_type_configs.title") }}
    </template>
    <template #description>
      {{ $t("pages.settings.application.game_type_configs.description") }}
    </template>
  </PageHeading>

  <Card class="p-4">
    <Table>
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
  </Card>

  <Card>
    <CardHeader>
      <CardTitle>
        {{ $t("pages.settings.application.game_type_configs.base_config") }}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <pre>{{ baseConfig }}{{ liveConfig }}</pre>
    </CardContent>
  </Card>
</template>

<script lang="ts">
import { generateSubscription } from "~/graphql/graphqlGen";
import { defineComponent } from "vue";
import { e_match_types_enum } from "~/generated/zeus";
interface GameTypeConfig {
  type: string;
  cfg: string;
}

interface ComponentData {
  baseConfig: string;
  liveConfig: string;
  gameTypeConfigs: GameTypeConfig[];
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
          for (const type of [
            e_match_types_enum.Competitive,
            e_match_types_enum.Wingman,
            e_match_types_enum.Duel,
          ]) {
            if (!data.match_type_cfgs.find((config) => config.type === type)) {
              data.match_type_cfgs.push({
                type,
                cfg: await this.getDefaultConfigs(type),
              });
            }
          }

          this.gameTypeConfigs = data.match_type_cfgs;
        },
      },
    },
  },
  created() {
    void this.getBaseConfig();
  },
  data(): ComponentData {
    return {
      baseConfig: "",
      liveConfig: "",
      gameTypeConfigs: [],
    };
  },
  methods: {
    async getDefaultConfigs(type: e_match_types_enum) {
      return await $fetch(`/api/get-default-config?type=${type}`);
    },
    async getBaseConfig() {
      this.baseConfig = await $fetch(`/api/get-default-config?type=base`);
      this.liveConfig = await $fetch(`/api/get-default-config?type=live`);
    },
  },
});
</script>
