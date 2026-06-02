<script setup lang="ts">
import { e_player_roles_enum } from "~/generated/zeus";
import { Switch } from "~/components/ui/switch";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import { TriangleAlert } from "lucide-vue-next";
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <form @submit.prevent="updateSettings" class="space-y-6">
        <SettingsSection
          id="matchmaking"
          :title="$t('pages.settings.application.matchmaking.title')"
          :description="
            $t('pages.settings.application.matchmaking.description')
          "
          clickable-header
          @header-click="toggleMatchmaking"
        >
          <template #action>
            <Switch
              :model-value="matchMakingAllowed"
              @update:model-value="toggleMatchmaking"
            />
          </template>

          <template v-if="matchMakingAllowed">
            <div class="space-y-3">
              <p class="text-sm text-muted-foreground">
                {{
                  $t(`pages.settings.application.matchmaking_type_description`)
                }}
              </p>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <template
                  v-for="match_type in ['competitive', 'wingman', 'duel']"
                >
                  <div
                    class="flex flex-row items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/40 transition-colors"
                    @click="toggleMatchmakingType(match_type)"
                  >
                    <h4 class="text-sm font-medium capitalize">
                      {{ match_type }}
                    </h4>
                    <Switch
                      :model-value="isMatchmakingTypeEnabled(match_type)"
                      @update:model-value="toggleMatchmakingType(match_type)"
                    />
                  </div>
                </template>
              </div>
            </div>

            <Separator />

            <FormField
              v-slot="{ componentField }"
              name="public.matchmaking_min_role"
            >
              <FormItem>
                <FormLabel>{{
                  $t("pages.settings.application.matchmaking_min_role")
                }}</FormLabel>
                <FormControl>
                  <Select v-bind="componentField">
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem
                          :value="role.value"
                          v-for="role in roles"
                          :key="role.value"
                        >
                          <span class="capitalize">{{ role.display }}</span>
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                v-slot="{ componentField }"
                name="public.max_acceptable_latency"
              >
                <FormItem>
                  <FormLabel>
                    {{
                      $t("pages.settings.application.max_acceptable_latency")
                    }}
                    <span class="text-muted-foreground font-normal">(ms)</span>
                  </FormLabel>
                  <FormDescription>{{
                    $t(
                      "pages.settings.application.max_acceptable_latency_description",
                    )
                  }}</FormDescription>
                  <FormControl>
                    <Input v-bind="componentField" type="number" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField
                v-slot="{ componentField }"
                name="auto_cancel_duration"
              >
                <FormItem>
                  <FormLabel>
                    {{ $t("pages.settings.application.auto_cancel_duration") }}
                    <span class="text-muted-foreground font-normal">(min)</span>
                  </FormLabel>
                  <FormDescription>{{
                    $t(
                      "pages.settings.application.auto_cancel_duration_description",
                    )
                  }}</FormDescription>
                  <FormControl>
                    <Input v-bind="componentField" type="number" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField v-slot="{ componentField }" name="live_match_timeout">
                <FormItem>
                  <FormLabel>
                    {{ $t("pages.settings.application.live_match_timeout") }}
                    <span class="text-muted-foreground font-normal">(min)</span>
                  </FormLabel>
                  <FormDescription>{{
                    $t(
                      "pages.settings.application.live_match_timeout_description",
                    )
                  }}</FormDescription>
                  <FormControl>
                    <Input v-bind="componentField" type="number" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>
          </template>
        </SettingsSection>

        <SettingsSection
          v-if="matchMakingAllowed"
          id="ranks"
          :title="$t('pages.settings.application.fivestack_ranks.title')"
          :description="
            $t('pages.settings.application.fivestack_ranks.description')
          "
        >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              class="flex flex-row items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/40 transition-colors"
              @click="toggleFivestackRanks('matches')"
            >
              <h4 class="text-sm font-medium">
                {{ $t("pages.settings.application.fivestack_ranks.matches") }}
              </h4>
              <Switch
                :model-value="fivestackRanksMatchesEnabled"
                @update:model-value="toggleFivestackRanks('matches')"
              />
            </div>
            <div
              class="flex flex-row items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/40 transition-colors"
              @click="toggleFivestackRanks('tournaments')"
            >
              <h4 class="text-sm font-medium">
                {{
                  $t("pages.settings.application.fivestack_ranks.tournaments")
                }}
              </h4>
              <Switch
                :model-value="fivestackRanksTournamentsEnabled"
                @update:model-value="toggleFivestackRanks('tournaments')"
              />
            </div>
          </div>

          <div
            class="flex items-start gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-300"
            role="alert"
          >
            <TriangleAlert class="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p class="font-medium">
                {{
                  $t("pages.settings.application.fivestack_ranks.warning_title")
                }}
              </p>
              <p class="text-yellow-300/90 mt-0.5">
                {{
                  $t(
                    "pages.settings.application.fivestack_ranks.warning_description",
                  )
                }}
              </p>
              <a
                href="https://blog.counter-strike.net/index.php/server_guidelines/"
                target="_blank"
                rel="noopener noreferrer"
                class="mt-1 inline-block underline text-yellow-200 hover:text-yellow-100"
              >
                {{
                  $t(
                    "pages.settings.application.fivestack_ranks.warning_link_label",
                  )
                }}
              </a>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          id="lineup"
          :title="$t('pages.settings.application.lineup_section')"
        >
          <FormField
            v-slot="{ componentField }"
            name="public.lineup_add_without_invite"
          >
            <FormItem>
              <FormLabel>{{
                $t("pages.settings.application.lineup_add_without_invite")
              }}</FormLabel>
              <FormControl>
                <Select v-bind="componentField">
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem
                        :value="role.value"
                        v-for="role in lineupRoles"
                        :key="role.value"
                      >
                        <span class="capitalize">{{ role.display }}</span>
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </SettingsSection>

        <SettingsSection
          id="default-models"
          :title="$t('pages.settings.application.default_models_section')"
          :description="
            $t('match.options.advanced.default_player_models.description')
          "
          clickable-header
          @header-click="toggleDefaultModels"
        >
          <template #action>
            <Switch
              :model-value="defaultModelsEnabled"
              @update:model-value="toggleDefaultModels"
            />
          </template>
        </SettingsSection>

        <div class="flex justify-start">
          <Button
            type="submit"
            :loading="submitting"
            :disabled="Object.keys(form.errors).length > 0 || !form.meta.dirty"
            class="my-3"
          >
            {{ $t("common.update") }}
          </Button>
        </div>
      </form>
    </PageTransition>
  </SettingsPage>
</template>

<script lang="ts">
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { z } from "zod";
import { toast } from "@/components/ui/toast";

export default {
  data() {
    return {
      submitting: false,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            auto_cancel_duration: z.number().default(15),
            live_match_timeout: z.number().default(180),
            public: z.object({
              matchmaking_min_role: z
                .string()
                .default(e_player_roles_enum.user),
              max_acceptable_latency: z.number().default(100),
              lineup_add_without_invite: z
                .string()
                .default(e_player_roles_enum.user),
            }),
          }),
        ),
      }),
    };
  },
  watch: {
    settings: {
      immediate: true,
      handler(newVal: Array<{ name: string; value: string | null }>) {
        for (const setting of newVal) {
          if (
            setting.name === "public.max_acceptable_latency" ||
            setting.name === "auto_cancel_duration" ||
            setting.name === "live_match_timeout"
          ) {
            (this.form.setFieldValue as any)(
              setting.name,
              Number(setting.value) || 100,
            );
          } else {
            (this.form.setFieldValue as any)(setting.name, setting.value || "");
          }
        }
        this.form.resetForm({ values: this.form.values });
      },
    },
  },
  methods: {
    async toggleMatchmaking() {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: {
                name: "public.matchmaking",
                value: this.matchMakingAllowed ? "false" : "true",
              },
              on_conflict: {
                constraint: settings_constraint.settings_pkey,
                update_columns: [settings_update_column.value],
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      toast({
        title: this.$t("pages.settings.application.matchmaking.updated"),
      });
    },
    isMatchmakingTypeEnabled(match_type: e_match_types_enum) {
      const matchmakingTypeSetting = this.settings.find(
        (setting: { name: string; value: string | null }) =>
          setting.name === `public.matchmaking_${match_type}`,
      );
      return matchmakingTypeSetting?.value !== "false";
    },
    async toggleMatchmakingType(match_type: e_match_types_enum) {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: {
                name: `public.matchmaking_${match_type}`,
                value: this.isMatchmakingTypeEnabled(match_type)
                  ? "false"
                  : "true",
              },
              on_conflict: {
                constraint: settings_constraint.settings_pkey,
                update_columns: [settings_update_column.value],
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      toast({
        title: this.$t("pages.settings.application.matchmaking.updated"),
      });
    },
    async toggleFivestackRanks(scope: "matches" | "tournaments") {
      const settingName =
        scope === "tournaments"
          ? "fivestack_ranks_tournaments"
          : "fivestack_ranks_matches";
      const currentlyEnabled =
        scope === "tournaments"
          ? this.fivestackRanksTournamentsEnabled
          : this.fivestackRanksMatchesEnabled;

      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: {
                name: settingName,
                value: currentlyEnabled ? "false" : "true",
              },
              on_conflict: {
                constraint: settings_constraint.settings_pkey,
                update_columns: [settings_update_column.value],
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      toast({
        title: this.$t("pages.settings.application.matchmaking.updated"),
      });
    },
    async toggleDefaultModels() {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: {
                name: "public.default_models",
                value: this.defaultModelsEnabled ? "false" : "true",
              },
              on_conflict: {
                constraint: settings_constraint.settings_pkey,
                update_columns: [settings_update_column.value],
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      toast({
        title: this.$t("pages.settings.application.matchmaking.updated"),
      });
    },
    async updateSettings() {
      if (this.submitting) {
        return;
      }
      this.submitting = true;
      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            insert_settings: [
              {
                objects: [
                  {
                    name: "public.matchmaking_min_role",
                    value: (this.form.values as any).public.matchmaking_min_role,
                  },
                  {
                    name: "public.max_acceptable_latency",
                    value: String(
                      (this.form.values as any).public.max_acceptable_latency,
                    ),
                  },
                  {
                    name: "public.lineup_add_without_invite",
                    value: (this.form.values as any).public
                      .lineup_add_without_invite,
                  },
                  {
                    name: "auto_cancel_duration",
                    value: String(
                      (this.form.values as any).auto_cancel_duration,
                    ),
                  },
                  {
                    name: "live_match_timeout",
                    value: String((this.form.values as any).live_match_timeout),
                  },
                ],
                on_conflict: {
                  constraint: settings_constraint.settings_pkey,
                  update_columns: [settings_update_column.value],
                },
              },
              {
                __typename: true,
              },
            ],
          }),
        });

        toast({
          title: this.$t("pages.settings.application.matchmaking.updated"),
        });
      } finally {
        this.submitting = false;
      }
    },
  },
  computed: {
    roles() {
      return [
        { value: e_player_roles_enum.user, display: this.$t("roles.user") },
        {
          value: e_player_roles_enum.verified_user,
          display: this.$t("roles.verified_user"),
        },
        {
          value: e_player_roles_enum.streamer,
          display: this.$t("roles.streamer"),
        },
        {
          value: e_player_roles_enum.match_organizer,
          display: this.$t("roles.match_organizer"),
        },
        {
          value: e_player_roles_enum.tournament_organizer,
          display: this.$t("roles.tournament_organizer"),
        },
        {
          value: e_player_roles_enum.administrator,
          display: this.$t("roles.administrator"),
        },
      ];
    },
    lineupRoles() {
      return [
        { value: e_player_roles_enum.user, display: this.$t("roles.user") },
        {
          value: e_player_roles_enum.verified_user,
          display: this.$t("roles.verified_user"),
        },
        {
          value: e_player_roles_enum.streamer,
          display: this.$t("roles.streamer"),
        },
        {
          value: e_player_roles_enum.match_organizer,
          display: this.$t("roles.match_organizer"),
        },
      ];
    },
    settings() {
      return useApplicationSettingsStore().settings;
    },
    matchMakingAllowed() {
      const matchMakingSetting = this.settings.find(
        (setting: { name: string; value: string | null }) =>
          setting.name === "public.matchmaking",
      );

      if (matchMakingSetting) {
        return matchMakingSetting.value === "true";
      }

      return true;
    },
    defaultModelsEnabled() {
      const defaultModelsSetting = this.settings.find(
        (setting: { name: string; value: string | null }) =>
          setting.name === "public.default_models",
      );

      if (defaultModelsSetting) {
        return defaultModelsSetting.value === "true";
      }

      return false;
    },
    fivestackRanksMatchesEnabled() {
      const setting = this.settings.find(
        (setting: { name: string; value: string | null }) =>
          setting.name === "fivestack_ranks_matches",
      );
      return setting?.value === "true";
    },
    fivestackRanksTournamentsEnabled() {
      const setting = this.settings.find(
        (setting: { name: string; value: string | null }) =>
          setting.name === "fivestack_ranks_tournaments",
      );
      return setting?.value === "true";
    },
  },
};
</script>
