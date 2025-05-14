<script setup lang="ts">
import { e_player_roles_enum } from "~/generated/zeus";

definePageMeta({
  layout: "application-settings",
});
</script>

<template>
    <form @submit.prevent="updateSettings" class="grid gap-4">
    <FormField v-slot="{ componentField }" name="public.minimum_role_to_stream">
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
              minimum_role_to_stream: z.string().default(e_player_roles_enum.user),
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
    async updateSettings() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_settings: [
            {
              objects: [
                {
                  name: "public.minimum_role_to_stream",
                  value: this.form.values.public.minimum_role_to_stream,
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
        title: "Updated Streaming Settings",
      });
    },
  },
  computed: {
    settings() {
      return useApplicationSettingsStore().settings;
    },
  },
};
</script>
