<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Card } from "~/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
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

definePageMeta({
  layout: "application-settings",
});

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
      title: "Player refresh queued successfully",
    });
  } catch (error: any) {
    toast({
      title: "Failed to refresh players",
      description: error?.message || "An error occurred",
      variant: "destructive",
    });
  } finally {
    refreshing.value = false;
  }
}
</script>

<template>
  <PageTransition :delay="0">
    <div>
      <Card variant="gradient" class="p-6 mb-6">
        <h3 class="text-lg font-semibold">Refresh All Players</h3>
        <p class="text-sm text-muted-foreground mt-1">
          Re-sync all player data in the search index. Use this if player information (like ELO) appears outdated or missing.
        </p>
        <div class="mt-4">
          <Button :disabled="refreshing" @click="showRefreshDialog = true">
            {{ refreshing ? "Refreshing..." : "Refresh All Players" }}
          </Button>
        </div>
      </Card>

      <AlertDialog v-model:open="showRefreshDialog">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refresh All Players?</AlertDialogTitle>
            <AlertDialogDescription>
              This will queue a job to re-sync all player data in the Typesense search index.
              This may take a few minutes depending on the number of players.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction @click="doRefreshAllPlayers">
              Refresh All Players
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    <form class="grid gap-6" @submit.prevent="updateSettings">
      <Card variant="gradient" class="cursor-pointer" @click="togglePlayerNameRegistration">
        <div class="flex flex-row items-center justify-between p-4">
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
      </Card>

      <Card variant="gradient">
        <div class="p-6 space-y-6">
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
        </div>
      </Card>

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
    </div>
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