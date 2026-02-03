<script setup lang="ts">
import { e_player_roles_enum } from "~/generated/zeus";
import { Switch } from "@/components/ui/switch";
import { ExternalLink } from "lucide-vue-next";

definePageMeta({
  layout: "application-settings",
});
</script>

<template>
  <PageTransition :delay="0">
    <form @submit.prevent="updateSettings" class="grid gap-4">
      <FormField
        v-slot="{ componentField }"
        name="public.minimum_role_to_spectate"
      >
        <FormItem>
          <FormLabel class="text-lg font-semibold">{{
            $t("pages.settings.application.streaming.minimum_role_to_spectate")
          }}</FormLabel>
          <FormDescription>
            {{
              $t(
                "pages.settings.application.streaming.minimum_role_to_spectate_description",
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
        name="public.minimum_role_to_stream"
      >
        <FormItem>
          <FormLabel class="text-lg font-semibold">{{
            $t("pages.settings.application.streaming.minimum_role_to_stream")
          }}</FormLabel>
          <FormDescription>
            {{
              $t(
                "pages.settings.application.streaming.minimum_role_to_stream_description",
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

      <div
        class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer"
        @click="togglePlaycast"
      >
        <div class="space-y-0.5">
          <h4 class="text-base font-medium">
            {{ $t("pages.settings.application.streaming.playcast") }}
          </h4>
          <p class="text-sm text-muted-foreground">
            {{
              $t("pages.settings.application.streaming.playcast_description")
            }}
          </p>
          <a
            href="https://developer.valvesoftware.com/wiki/Counter-Strike:_Global_Offensive_Broadcast"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors mt-1"
            @click.stop
          >
            {{ $t("pages.settings.application.streaming.playcast_learn_more") }}
            <ExternalLink class="w-3.5 h-3.5" />
          </a>
        </div>
        <Switch
          :model-value="playcastEnabled"
          @update:model-value="togglePlaycast"
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
  </PageTransition>
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
    // TODO - we reuse this list alot , lets move it to a shared location
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
              minimum_role_to_stream: z
                .string()
                .default(e_player_roles_enum.verified_user),
              minimum_role_to_spectate: z
                .string()
                .default(e_player_roles_enum.streamer),
            }),
          }),
        ),
      }),
    };
  },
  watch: {
    settings: {
      immediate: true,
      handler(newVal) {
        for (const setting of newVal) {
          this.form.setFieldValue(setting.name, setting.value);
        }
      },
    },
  },
  methods: {
    async togglePlaycast() {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: {
                name: "use_playcast",
                value: this.playcastEnabled ? "false" : "true",
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
      const roleToStream =
        this.form.values.public?.minimum_role_to_stream ??
        e_player_roles_enum.verified_user;
      const roleToSpectate =
        this.form.values.public?.minimum_role_to_spectate ??
        e_player_roles_enum.streamer;

      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_settings: [
            {
              objects: [
                {
                  name: "public.minimum_role_to_stream",
                  value: roleToStream,
                },
                {
                  name: "public.minimum_role_to_spectate",
                  value: roleToSpectate,
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
        title: this.$t("pages.settings.application.streaming.updated"),
      });
    },
  },
  computed: {
    settings() {
      return useApplicationSettingsStore().settings;
    },
    playcastEnabled() {
      const playcastSetting = this.settings.find(
        (setting: { name: string; value: string | null }) =>
          setting.name === "use_playcast",
      );

      if (playcastSetting) {
        return playcastSetting.value === "true";
      }

      return false;
    },
  },
};
</script>
