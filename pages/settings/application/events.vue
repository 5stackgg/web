<script setup lang="ts">
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import { CalendarDays } from "lucide-vue-next";

definePageMeta({
  middleware: "admin",
});
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <div class="space-y-6">
        <SettingsSection
          id="events"
          :title="$t('pages.settings.application.events.section')"
          :description="$t('pages.settings.application.events.description')"
          clickable-header
          @header-click="toggleEnabled"
        >
          <template #action>
            <Switch
              :model-value="eventsEnabled"
              @update:model-value="toggleEnabled"
            />
          </template>

          <div v-if="eventsEnabled" class="flex justify-end">
            <NuxtLink to="/events/manage">
              <Button variant="outline" class="gap-2 shrink-0">
                <CalendarDays class="h-4 w-4" />
                {{ $t("pages.settings.application.events.manage") }}
              </Button>
            </NuxtLink>
          </div>
        </SettingsSection>

        <form
          v-if="eventsEnabled"
          class="space-y-6"
          @submit.prevent="updateSettings"
        >
          <SettingsSection
            id="permissions"
            :title="$t('pages.settings.application.events.permissions_section')"
            :description="
              $t('pages.settings.application.events.permissions_description')
            "
          >
            <FormField
              v-slot="{ componentField }"
              name="public.create_events_role"
            >
              <FormItem>
                <FormLabel>{{
                  $t("pages.settings.application.events.create_events_role")
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
          </SettingsSection>

          <SettingsSaveBar
            :form="form"
            :submitting="submitting"
            @save="updateSettings"
          />
        </form>
      </div>
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
              // The permission floor is match_organizer (lower roles have
              // no insert permission); the setting can only raise it.
              create_events_role: z
                .string()
                .default(e_player_roles_enum.match_organizer),
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
  methods: {
    async toggleEnabled() {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: {
                name: "public.events_enabled",
                value: this.eventsEnabled ? "false" : "true",
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
        title: this.$t("pages.settings.application.update_success") as string,
      });
    },
    async updateSettings() {
      if (this.submitting) {
        return;
      }
      this.submitting = true;
      try {
        const values = this.form.values as any;
        const role =
          typeof values.public?.create_events_role === "string" &&
          values.public.create_events_role.length > 0
            ? values.public.create_events_role
            : e_player_roles_enum.match_organizer;

        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            insert_settings_one: [
              {
                object: {
                  name: "public.create_events_role",
                  value: role,
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
          title: this.$t("pages.settings.application.update_success") as string,
        });
      } finally {
        this.submitting = false;
      }
    },
  },
  computed: {
    roles() {
      // match_organizer is the permission floor; only equal-or-higher roles
      // are meaningful values for create_events_role.
      return [
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
    settings() {
      return useApplicationSettingsStore().settings;
    },
    eventsEnabled() {
      return useApplicationSettingsStore().eventsEnabled;
    },
  },
};
</script>
