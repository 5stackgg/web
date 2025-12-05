<script setup lang="ts">
import { e_player_roles_enum } from "~/generated/zeus";
import { Switch } from "~/components/ui/switch";

definePageMeta({
  layout: "application-settings",
});
</script>

<template>
  <form @submit.prevent="updateSettings" class="grid gap-4">
    <div
      class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer"
      @click="toggleMatchmaking"
    >
      <div class="space-y-0.5">
        <h4 class="text-base font-medium">
          {{ $t("pages.settings.application.matchmaking.title") }}
        </h4>
        <p class="text-sm text-muted-foreground">
          {{ $t("pages.settings.application.matchmaking.description") }}
        </p>
      </div>
      <Switch
        :model-value="matchMakingAllowed"
        @update:model-value="toggleMatchmaking"
      />
    </div>

    <FormField v-slot="{ componentField }" name="auto_cancel_duration">
      <FormItem>
        <FormLabel class="text-lg font-semibold">{{
          $t("pages.settings.application.auto_cancel_duration")
        }}</FormLabel>
        <FormDescription>
          {{
            $t("pages.settings.application.auto_cancel_duration_description")
          }}
        </FormDescription>
        <FormControl>
          <Input v-bind="componentField" type="number" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="public.matchmaking_min_role">
      <FormItem>
        <FormLabel class="text-lg font-semibold">{{
          $t("pages.settings.application.matchmaking_min_role")
        }}</FormLabel>
        <FormDescription>
          {{
            $t("pages.settings.application.matchmaking_min_role_description")
          }}
        </FormDescription>
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

    <FormField v-slot="{ componentField }" name="public.max_acceptable_latency">
      <FormItem>
        <FormLabel class="text-lg font-semibold">{{
          $t("pages.settings.application.max_acceptable_latency")
        }}</FormLabel>
        <FormDescription>
          {{
            $t("pages.settings.application.max_acceptable_latency_description")
          }}
        </FormDescription>
        <FormControl>
          <Input v-bind="componentField" type="number" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField
      v-slot="{ componentField }"
      name="public.lineup_add_without_invite"
    >
      <FormItem>
        <FormLabel class="text-lg font-semibold">{{
          $t("pages.settings.application.lineup_add_without_invite")
        }}</FormLabel>
        <FormDescription>
          {{
            $t(
              "pages.settings.application.lineup_add_without_invite_description",
            )
          }}
        </FormDescription>
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

    <div
      class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer"
      @click="toggleDefaultModels"
    >
      <div class="space-y-0.5">
        <h4 class="text-base font-medium">
          {{ $t("pages.settings.application.default_models") }}
        </h4>
        <p class="text-sm text-muted-foreground">
          {{ $t("match.options.advanced.default_player_models.description") }}
        </p>
      </div>
      <Switch
        :model-value="defaultModelsEnabled"
        @update:model-value="toggleDefaultModels"
      />
    </div>

    <div class="flex justify-start">
      <Button
        type="submit"
        :disabled="Object.keys(form.errors).length > 0"
        class="my-3"
      >
        {{ $t("pages.settings.application.update") }}
      </Button>
    </div>
  </form>
</template>

<script lang="ts">
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";
import { toast } from "@/components/ui/toast";

export default {
  data() {
    return {
      roles: [
        { value: e_player_roles_enum.user, display: "User" },
        { value: e_player_roles_enum.verified_user, display: "Verified User" },
        { value: e_player_roles_enum.streamer, display: "Streamer" },
        {
          value: e_player_roles_enum.match_organizer,
          display: "Match Organizer",
        },
        {
          value: e_player_roles_enum.tournament_organizer,
          display: "Tournament Organizer",
        },
        { value: e_player_roles_enum.administrator, display: "Administrator" },
      ],
      lineupRoles: [
        { value: e_player_roles_enum.user, display: "User" },
        { value: e_player_roles_enum.verified_user, display: "Verified User" },
        { value: e_player_roles_enum.streamer, display: "Streamer" },
        {
          value: e_player_roles_enum.match_organizer,
          display: "Match Organizer",
        },
      ],
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            auto_cancel_duration: z.number().default(15),
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
            setting.name === "auto_cancel_duration"
          ) {
            (this.form.setFieldValue as any)(
              setting.name,
              Number(setting.value) || 100,
            );
          } else {
            (this.form.setFieldValue as any)(setting.name, setting.value || "");
          }
        }
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
    },
    async updateSettings() {
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
                  value: String((this.form.values as any).auto_cancel_duration),
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
    },
  },
  computed: {
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
  },
};
</script>
