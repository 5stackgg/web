<script setup lang="ts">
import { e_player_roles_enum } from "~/generated/zeus";

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
        :checked="matchMakingAllowed"
        @update:checked="toggleMatchmaking"
      />
    </div>

    <FormField v-slot="{ componentField }" name="public.create_matches_role">
      <FormItem>
        <FormLabel class="text-lg font-semibold">{{
          $t("pages.settings.application.create_matches_role")
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
                  :value="role"
                  v-for="role in e_player_roles_enum"
                  :key="role"
                >
                  <span class="capitalize">{{ role.replace("_", " ") }}</span>
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField
      v-slot="{ componentField }"
      name="public.create_tournaments_role"
    >
      <FormItem>
        <FormLabel class="text-lg font-semibold">{{
          $t("pages.settings.application.create_tournaments_role")
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
                  :value="role"
                  v-for="role in e_player_roles_enum"
                  :key="role"
                >
                  <span class="capitalize">{{ role.replace("_", " ") }}</span>
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

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
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";
import { toast } from "@/components/ui/toast";

export default {
  data() {
    return {
      settings: [],
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            public: z.object({
              create_matches_role: z.string().default(e_player_roles_enum.user),
              create_tournaments_role: z
                .string()
                .default(e_player_roles_enum.user),
            }),
          }),
        ),
      }),
    };
  },
  apollo: {
    $subscribe: {
      servers: {
        query: typedGql("subscription")({
          settings: [
            {},
            {
              name: true,
              value: true,
            },
          ],
        }),
        result({ data }) {
          this.settings = data.settings;
          for (const setting of data.settings) {
            this.form.setFieldValue(setting.name, setting.value || "");
          }
        },
      },
    },
  },
  methods: {
    async toggleMatchmaking() {
      await this.$apollo.mutate({
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
    async updateSettings() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_settings: [
            {
              objects: [
                {
                  name: "public.create_matches_role",
                  value: this.form.values.public.create_matches_role,
                },
                {
                  name: "public.create_tournaments_role",
                  value: this.form.values.public.create_tournaments_role,
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
        title: "Updated Matchmaking Settings",
      });
    },
  },
  computed: {
    matchMakingAllowed() {
      const matchMakingSetting = this.settings.find(
        (setting) => setting.name === "public.matchmaking",
      );

      if (matchMakingSetting) {
        return matchMakingSetting.value === "true";
      }

      return true;
    },
  },
};
</script>
