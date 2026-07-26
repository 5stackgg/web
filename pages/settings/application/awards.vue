<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <form class="space-y-6" @submit.prevent="updateSettings">
        <SettingsSection
          id="permissions"
          :title="$t('pages.settings.application.awards.permissions_section')"
          :description="
            $t('pages.settings.application.awards.permissions_description')
          "
        >
          <FormField
            v-slot="{ componentField }"
            name="public.create_awards_role"
          >
            <FormItem>
              <FormLabel>{{
                $t("pages.settings.application.awards.create_awards_role")
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
                        v-for="role in roles"
                        :key="role.value"
                        :value="role.value"
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
            name="public.grant_awards_role"
          >
            <FormItem>
              <FormLabel>{{
                $t("pages.settings.application.awards.grant_awards_role")
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
                        v-for="role in roles"
                        :key="role.value"
                        :value="role.value"
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

        <SettingsSaveBar
          :form="form"
          :submitting="submitting"
          @save="updateSettings"
        />
      </form>
    </PageTransition>
  </SettingsPage>
</template>

<script lang="ts">
import {
  e_player_roles_enum,
  settings_constraint,
  settings_update_column,
} from "~/generated/zeus";
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
            public: z.object({
              create_awards_role: z
                .string()
                .default(e_player_roles_enum.administrator),
              grant_awards_role: z
                .string()
                .default(e_player_roles_enum.administrator),
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
          if (setting.value == null || setting.value === "") {
            continue;
          }
          (this.form.setFieldValue as any)(setting.name, setting.value);
        }
        this.form.resetForm({ values: this.form.values });
      },
    },
  },
  computed: {
    settings() {
      return useApplicationSettingsStore().settings;
    },
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
          value: e_player_roles_enum.moderator,
          display: this.$t("roles.moderator"),
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
  },
  methods: {
    roleOrDefault(value: unknown): string {
      return typeof value === "string" && value.length > 0
        ? value
        : e_player_roles_enum.administrator;
    },
    async updateSettings() {
      if (this.submitting) {
        return;
      }
      this.submitting = true;
      try {
        const values = this.form.values as any;
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            insert_settings: [
              {
                objects: [
                  {
                    name: "public.create_awards_role",
                    value: this.roleOrDefault(
                      values.public?.create_awards_role,
                    ),
                  },
                  {
                    name: "public.grant_awards_role",
                    value: this.roleOrDefault(values.public?.grant_awards_role),
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
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>
