<script setup lang="ts">
definePageMeta({
  layout: "settings",
});
</script>

<template>
  <div>
    <h3 class="text-lg font-medium">Application Settings</h3>
    <p class="text-sm text-muted-foreground">
      Settings that effect the application.
    </p>
  </div>
  <Separator />

  <div
    class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer"
    @click="toggleMatchmaking"
  >
    <div class="space-y-0.5">
      <h4 class="text-base font-medium">Matchmaking</h4>
      <p class="text-sm text-muted-foreground">
        Matchmaking allows players to join a queue and be matched with other
        players.
      </p>
    </div>
    <Switch :checked="matchMakingAllowed" @update:checked="toggleMatchmaking" />
  </div>

  <form @submit.prevent="updateSettings" class="grid gap-4">
    <div class="flex flex-col space-y-3 rounded-lg border p-4">
      <FormField v-slot="{ componentField }" name="public.create_matches_role">
        <FormItem>
          <FormLabel class="text-lg font-semibold"
            >Minimum Role Allowed to Create Matches</FormLabel
          >
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
    </div>

    <div class="flex flex-col space-y-3 rounded-lg border p-4">
      <FormField
        v-slot="{ componentField }"
        name="public.create_tournaments_role"
      >
        <FormItem>
          <FormLabel class="text-lg font-semibold"
            >Minimum Role Allowed to Create Tournaments</FormLabel
          >
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
    </div>

    <FormField v-slot="{ componentField }" name="discord_invite_link">
      <FormItem>
        <FormLabel>Discord Invite Link</FormLabel>
        <Input v-bind="componentField"></Input>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="discord_support_webhook">
      <FormItem>
        <FormLabel>Discord Webhook</FormLabel>
        <FormDescription
          >We use this discord webhook to send notifications that require action
          from a player. Ex. match issues, bugs, etc.</FormDescription
        >
        <Input v-bind="componentField"></Input>
        <FormMessage />
      </FormItem>
    </FormField>

    <div class="flex justify-start">
      <Button
        type="submit"
        :disabled="Object.keys(form.errors).length > 0"
        class="my-3"
      >
        Update
      </Button>
    </div>
  </form>
</template>

<script lang="ts">
import {
  e_player_roles_enum,
  settings_constraint,
  settings_update_column,
} from "~/generated/zeus";
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
            discord_invite_link: z.string().optional(),
            discord_support_webhook: z.string().optional(),
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
            this.form.setFieldValue(setting.name, setting.value);
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
                  name: "discord_invite_link",
                  value: this.form.values.discord_invite_link,
                },
                {
                  name: "discord_support_webhook",
                  value: this.form.values.discord_support_webhook,
                },
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
        title: "Updated Application Settings",
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
