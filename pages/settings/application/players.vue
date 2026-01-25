<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
definePageMeta({
  layout: "application-settings",
});
</script>

<template>
  <PageTransition :delay="0">
    <form class="grid gap-6" @submit.prevent="updateSettings">
      <div
        class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer"
        @click="togglePlayerNameRegistration"
      >
        <div class="space-y-0.5">
          <h4 class="text-base font-medium">
            {{
              $t("pages.settings.application.players.force_name_registration")
            }}
          </h4>
          <p class="text-sm text-muted-foreground">
            {{
              $t(
                "pages.settings.application.players.force_name_registration_description",
              )
            }}
          </p>
        </div>
        <Switch
          :model-value="playerNameRegistration"
          @update:model-value="togglePlayerNameRegistration"
        />
      </div>

      <FormField v-slot="{ componentField }" name="public.create_matches_role">
        <FormItem>
          <FormLabel class="text-lg font-semibold">{{
            $t("pages.settings.application.create_matches_role")
          }}</FormLabel>
          <FormDescription>
            {{
              $t("pages.settings.application.create_matches_role_description")
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
                    <span>{{ role.display }}</span>
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
          <FormDescription>
            {{
              $t(
                "pages.settings.application.create_tournaments_role_description",
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

      <FormField
        v-slot="{ componentField }"
        name="public.dedicated_servers_min_role_to_connect"
      >
        <FormItem>
          <FormLabel class="text-lg font-semibold">{{
            $t(
              "pages.settings.application.dedicated_servers_min_role_to_connect",
            )
          }}</FormLabel>
          <FormDescription>
            {{
              $t(
                "pages.settings.application.dedicated_servers_min_role_to_connect_description",
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
  </PageTransition>
</template>

<script lang="ts">
import {
  e_player_roles_enum,
  settings_constraint,
  settings_update_column,
} from "~/generated/zeus";
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
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            public: z.object({
              player_name_registration: z.string().default("false"),
              create_matches_role: z.string().default(e_player_roles_enum.user),
              create_tournaments_role: z
                .string()
                .default(e_player_roles_enum.user),
              dedicated_servers_min_role_to_connect: z
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
          (this.form.setFieldValue as any)(setting.name, setting.value || "");
        }
      },
    },
  },
  methods: {
    async togglePlayerNameRegistration() {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: {
                name: "public.player_name_registration",
                value: this.playerNameRegistration ? "false" : "true",
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
                  name: "public.create_matches_role",
                  value: (this.form.values as any).public.create_matches_role,
                },
                {
                  name: "public.create_tournaments_role",
                  value: (this.form.values as any).public
                    .create_tournaments_role,
                },
                {
                  name: "public.dedicated_servers_min_role_to_connect",
                  value: (this.form.values as any).public
                    .dedicated_servers_min_role_to_connect,
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
        title: this.$t("pages.settings.application.update_success") as string,
      });
    },
  },
  computed: {
    settings() {
      return useApplicationSettingsStore().settings;
    },
    playerNameRegistration() {
      const playerNameRegistrationSetting = this.settings.find(
        (setting: { name: string; value: string | null }) =>
          setting.name === "public.player_name_registration",
      );

      if (playerNameRegistrationSetting) {
        return playerNameRegistrationSetting.value === "true";
      }

      return false;
    },
  },
};
</script>
