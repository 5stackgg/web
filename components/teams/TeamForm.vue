<script setup lang="ts">
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { Card } from "~/components/ui/card";
</script>

<template>
  <form @submit.prevent="updateCreateTeam" class="grid gap-6">
    <Card class="bg-gradient-to-br from-muted/50 to-muted/30 border-border/50">
      <div class="p-6 space-y-6">
        <FormField v-slot="{ componentField }" name="team_name">
          <FormItem>
            <FormLabel>{{ $t("common.team_name") }}</FormLabel>
            <FormControl>
              <Input
                v-bind="componentField"
                :placeholder="$t('team.form.name_placeholder')"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="short_name">
          <FormItem>
            <FormLabel>{{ $t("team.form.short_name") }}</FormLabel>
            <FormControl>
              <Input
                v-bind="componentField"
                :placeholder="$t('team.form.short_name_placeholder')"
                maxlength="5"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField
          v-if="team && canUpdateOwner"
          v-slot="{ componentField }"
          name="owner_steam_id"
        >
          <FormItem>
            <FormLabel>{{ $t("team.form.owner") }}</FormLabel>
            <Select v-bind="componentField">
              <FormControl>
                <SelectTrigger>
                  <SelectValue :placeholder="$t('team.form.select_owner')" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    v-for="{ player } in team.roster"
                    :key="player.steam_id"
                    :value="player.steam_id"
                  >
                    <PlayerDisplay :player="player" />
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        </FormField>
      </div>
    </Card>

    <Button
      type="submit"
      :disabled="Object.keys(form.errors).length > 0"
      class="w-full"
    >
      {{ team ? $t("team.form.update") : $t("team.form.create") }}
    </Button>
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { generateMutation } from "~/graphql/graphqlGen";
import { e_player_roles_enum } from "~/generated/zeus";

export default {
  emits: ["updated"],
  props: {
    team: {
      type: Object,
      required: false,
    },
  },
  data() {
    return {
      owner: undefined,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            team_name: z.string().min(1),
            short_name: z.string().min(1).max(5),
          }),
        ),
      }),
    };
  },
  watch: {
    team: {
      immediate: true,
      handler(team) {
        if (team) {
          this.form.setValues({
            team_name: team.name,
            short_name: team.short_name,
          });
        }
      },
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    canUpdateOwner() {
      return (
        this.team.owner_steam_id === this.me?.steam_id ||
        this.me?.role === e_player_roles_enum.tournament_organizer
      );
    },
  },
  methods: {
    async updateCreateTeam() {
      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }

      if (this.team) {
        await this.$apollo.mutate({
          mutation: generateMutation({
            update_teams_by_pk: [
              {
                pk_columns: {
                  id: this.team.id,
                },
                _set: {
                  name: this.form.values.team_name,
                  short_name: this.form.values.short_name,
                  owner_steam_id: this.form.values.owner_steam_id,
                },
              },
              {
                __typename: true,
              },
            ],
          }),
        });
        this.$emit("updated");
        return;
      }

      const { data } = await this.$apollo.mutate({
        mutation: generateMutation({
          insert_teams_one: [
            {
              object: {
                name: this.form.values.team_name,
                short_name: this.form.values.short_name,
              },
            },
            {
              id: true,
            },
          ],
        }),
      });

      this.$router.push(`/teams/${data.insert_teams_one.id}`);
    },
  },
};
</script>
