<script setup lang="ts">
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import { Newspaper, PencilLine } from "lucide-vue-next";
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <div class="space-y-6">
        <SettingsSection
          id="news"
          :title="$t('pages.settings.application.news.section')"
          :description="$t('pages.settings.application.news.description')"
          clickable-header
          @header-click="toggleEnabled"
        >
          <template #action>
            <Switch
              :model-value="newsEnabled"
              @update:model-value="toggleEnabled"
            />
          </template>

          <div
            class="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-4 text-sm"
          >
            <Newspaper class="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
            <p class="text-muted-foreground">
              {{ $t("pages.settings.application.news.about") }}
            </p>
          </div>

          <div
            v-if="canPostNews"
            class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p class="text-sm text-muted-foreground">
              {{ $t("pages.settings.application.news.manage_description") }}
            </p>
            <NuxtLink to="/news/manage">
              <Button variant="outline" class="gap-2 shrink-0">
                <PencilLine class="h-4 w-4" />
                {{ $t("pages.settings.application.news.manage") }}
              </Button>
            </NuxtLink>
          </div>
        </SettingsSection>

        <form class="space-y-6" @submit.prevent="updateSettings">
          <SettingsSection
            id="label"
            :title="$t('pages.settings.application.news.label_section')"
            :description="
              $t('pages.settings.application.news.label_description')
            "
          >
            <FormField v-slot="{ componentField }" name="public.news_label">
              <FormItem>
                <FormLabel>{{
                  $t("pages.settings.application.news.label")
                }}</FormLabel>
                <FormControl>
                  <Input
                    v-bind="componentField"
                    :placeholder="$t('pages.settings.application.news.section')"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
          </SettingsSection>

          <SettingsSection
            id="permissions"
            :title="$t('pages.settings.application.news.permissions_section')"
            :description="
              $t('pages.settings.application.news.permissions_description')
            "
          >
            <FormField v-slot="{ componentField }" name="public.post_news_role">
              <FormItem>
                <FormLabel>{{
                  $t("pages.settings.application.news.post_news_role")
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
              news_label: z.string().optional(),
              post_news_role: z
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
  methods: {
    roleOrDefault(value: unknown): string {
      return typeof value === "string" && value.length > 0
        ? value
        : e_player_roles_enum.administrator;
    },
    async toggleEnabled() {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: {
                name: "public.news_enabled",
                value: this.newsEnabled ? "false" : "true",
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
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            insert_settings: [
              {
                objects: [
                  {
                    name: "public.news_label",
                    value: (values.public?.news_label ?? "").trim(),
                  },
                  {
                    name: "public.post_news_role",
                    value: this.roleOrDefault(values.public?.post_news_role),
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
    settings() {
      return useApplicationSettingsStore().settings;
    },
    newsEnabled() {
      return useApplicationSettingsStore().newsEnabled;
    },
    canPostNews() {
      return useApplicationSettingsStore().canPostNews;
    },
  },
};
</script>
