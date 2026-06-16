<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { LucideRefreshCw } from "lucide-vue-next";
import { toast } from "@/components/ui/toast";
import { useI18n } from "vue-i18n";
import { generateMutation } from "~/graphql/graphqlGen";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


const { t } = useI18n();
const showRefreshDialog = ref(false);
const refreshing = ref(false);

async function doRefreshAllPlayers() {
  refreshing.value = true;
  showRefreshDialog.value = false;

  try {
    await useNuxtApp().$apollo.defaultClient.mutate({
      mutation: generateMutation({
        refreshAllPlayers: {
          success: true,
        },
      }),
    });

    toast({
      title: t("pages.settings.application.players.refresh_queued"),
    });
  } catch (error: any) {
    toast({
      title: t("pages.settings.application.players.refresh_failed"),
      description:
        error?.message ||
        t("pages.settings.application.players.error_occurred"),
      variant: "destructive",
    });
  } finally {
    refreshing.value = false;
  }
}
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <div class="space-y-6">
        <SettingsSection
          id="refresh"
          :title="$t('pages.settings.application.players.refresh_all_title')"
          :description="
            $t('pages.settings.application.players.refresh_all_description')
          "
        >
          <template #action>
            <Button
              type="button"
              size="sm"
              variant="outline"
              :disabled="refreshing"
              class="flex items-center gap-2"
              @click="showRefreshDialog = true"
            >
              <Spinner v-if="refreshing" class="h-4 w-4" />
              <LucideRefreshCw v-else class="h-4 w-4" />
              {{
                refreshing
                  ? $t("pages.settings.application.players.refreshing")
                  : $t("pages.settings.application.players.refresh_button")
              }}
            </Button>
          </template>
        </SettingsSection>

        <AlertDialog v-model:open="showRefreshDialog">
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {{
                  $t("pages.settings.application.players.refresh_dialog_title")
                }}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {{
                  $t(
                    "pages.settings.application.players.refresh_dialog_description",
                  )
                }}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {{ $t("common.cancel") }}
              </AlertDialogCancel>
              <AlertDialogAction @click="doRefreshAllPlayers">
                {{ $t("pages.settings.application.players.refresh_button") }}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <form class="space-y-6" @submit.prevent="updateSettings">
          <SettingsSection
            id="registration"
            :title="
              $t('pages.settings.application.players.force_name_registration')
            "
            :description="
              $t(
                'pages.settings.application.players.force_name_registration_description',
              )
            "
            clickable-header
            @header-click="togglePlayerNameRegistration"
          >
            <template #action>
              <Switch
                :model-value="playerNameRegistration"
                @update:model-value="togglePlayerNameRegistration"
              />
            </template>
          </SettingsSection>

          <SettingsSection
            id="permissions"
            :title="
              $t('pages.settings.application.players.permissions_section')
            "
          >
            <FormField
              v-slot="{ componentField }"
              name="public.create_matches_role"
            >
              <FormItem>
                <FormLabel>{{
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
                <FormLabel>{{
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
              name="dedicated_servers_min_role_to_connect"
            >
              <FormItem>
                <FormLabel>{{
                  $t(
                    "pages.settings.application.dedicated_servers_min_role_to_connect",
                  )
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
            dedicated_servers_min_role_to_connect: z
              .string()
              .default(e_player_roles_enum.user),
            public: z.object({
              player_name_registration: z.string().default("false"),
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
        : e_player_roles_enum.user;
    },
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
                    name: "public.create_matches_role",
                    value: this.roleOrDefault(
                      values.public?.create_matches_role,
                    ),
                  },
                  {
                    name: "public.create_tournaments_role",
                    value: this.roleOrDefault(
                      values.public?.create_tournaments_role,
                    ),
                  },
                  {
                    name: "dedicated_servers_min_role_to_connect",
                    value: this.roleOrDefault(
                      values.dedicated_servers_min_role_to_connect,
                    ),
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
