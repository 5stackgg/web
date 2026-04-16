<script lang="ts" setup>
import TeamSearch from "~/components/teams/TeamSearch.vue";
import MatchOptions from "~/components/MatchOptions.vue";
import {
  Info,
  Swords,
  PlayIcon,
  Lock,
  Unlock,
  Send,
  Handshake,
} from "lucide-vue-next";
import { e_lobby_access_enum } from "~/generated/zeus";
import { useI18n } from "vue-i18n";
import { computed } from "vue";

const { t } = useI18n();

const lobbyAccessOptions = computed(() => [
  {
    value: e_lobby_access_enum.Private,
    label: t("match_access.private"),
    description: t("match_access.invite_only_description"),
    icon: Lock,
  },
  {
    value: e_lobby_access_enum.Invite,
    label: t("match_access.invite"),
    description: t("match_access.invite_code_description"),
    icon: Send,
  },
  {
    value: e_lobby_access_enum.Friends,
    label: t("match_access.friends"),
    description: t("match_access.friends_only_description"),
    icon: Handshake,
  },
  {
    value: e_lobby_access_enum.Open,
    label: t("match_access.open"),
    description: t("match_access.open_description"),
    icon: Unlock,
  },
]);
</script>

<template>
  <form
    @submit.prevent="updateMatch"
    class="match-form mx-auto w-full max-w-4xl"
  >
    <MatchOptions :form="form" :match="match">
      <template #left>
        <!-- Match Lobby Access -->
        <FormField
          v-if="!isTournamentMatch"
          v-slot="{ value, handleChange }"
          name="lobby_access"
        >
          <FormItem class="match-form__access">
            <div class="match-form__access-header">
              <span class="match-form__access-tick"></span>
              <FormLabel class="match-form__access-label">
                Lobby Access
              </FormLabel>
              <span class="match-form__access-desc">
                {{ activeLobbyAccessDescription(value) }}
              </span>
            </div>
            <div class="match-form__access-grid">
              <button
                v-for="opt in lobbyAccessOptions"
                :key="opt.value"
                type="button"
                class="match-form__access-btn"
                :class="{
                  'match-form__access-btn--active': value === opt.value,
                }"
                @click="handleChange(opt.value)"
              >
                <component :is="opt.icon" class="w-4 h-4" />
                <span>{{ opt.label }}</span>
              </button>
            </div>
          </FormItem>
        </FormField>

        <!-- Pick Up Game toggle -->
        <FormField v-if="!match" v-slot="{ value, handleChange }" name="pug">
          <FormItem>
            <div
              class="match-form__pug-card"
              :class="{ 'match-form__pug-card--on': value }"
              @click="handleChange(!value)"
            >
              <div class="flex-1 space-y-1.5">
                <div class="flex items-center gap-2">
                  <span class="match-form__pug-chevron">◢</span>
                  <FormLabel
                    class="match-form__pug-label cursor-pointer"
                  >
                    {{ $t("pages.matches.create_page.pick_up_game") }}
                  </FormLabel>
                </div>
                <FormDescription class="match-form__pug-desc">
                  {{ $t("pages.matches.create_page.pick_up_game_description") }}
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  class="pointer-events-none flex-shrink-0"
                  :model-value="value"
                  @update:model-value="handleChange"
                />
              </FormControl>
            </div>
          </FormItem>
        </FormField>

        <!-- Team vs Team picker -->
        <div v-if="!form.values.pug" class="match-form__teams">
          <div class="match-form__teams-label">
            <span class="match-form__teams-tick"></span>
            Lineups
          </div>

          <div class="match-form__versus">
            <FormField
              v-slot="{ handleChange, componentField }"
              name="team_1"
            >
              <FormItem class="match-form__team match-form__team--left">
                <FormLabel class="match-form__team-label">
                  {{ $t("pages.matches.create_page.team_1") }}
                </FormLabel>
                <TeamSearch
                  :label="$t('pages.matches.create_page.search_team')"
                  @selected="
                    (team) => {
                      if (team.id == form.values.team_1) {
                        handleChange(undefined);
                        return;
                      }
                      handleChange(team.id);
                    }
                  "
                  v-model="componentField.modelValue"
                  class="w-full"
                ></TeamSearch>
                <FormMessage />
              </FormItem>
            </FormField>

            <div class="match-form__vs" aria-hidden="true">
              <Swords class="w-4 h-4" />
              <span>VS</span>
            </div>

            <FormField
              v-slot="{ handleChange, componentField }"
              name="team_2"
            >
              <FormItem class="match-form__team match-form__team--right">
                <FormLabel class="match-form__team-label">
                  {{ $t("pages.matches.create_page.team_2") }}
                </FormLabel>
                <TeamSearch
                  :label="$t('pages.matches.create_page.search_team')"
                  @selected="
                    (team) => {
                      if (team.id == form.values.team_2) {
                        handleChange(undefined);
                        return;
                      }
                      handleChange(team.id);
                    }
                  "
                  v-model="componentField.modelValue"
                  class="w-full"
                ></TeamSearch>
                <FormMessage />
              </FormItem>
            </FormField>
          </div>

          <div class="match-form__teams-note">
            <Info class="w-4 h-4 flex-shrink-0" />
            <span>
              {{ $t("pages.matches.create_page.intra_team_scrimmage") }}
            </span>
          </div>
        </div>
      </template>
    </MatchOptions>

    <div class="match-form__submit-row">
      <button type="submit" class="match-form__submit">
        <span class="match-form__submit-inner">
          <PlayIcon class="match-form__submit-icon w-5 h-5" />
          <span>
            <template v-if="match">
              {{ $t("pages.matches.create_page.update_button") }}
            </template>
            <template v-else>
              {{ $t("pages.matches.create_page.create_button") }}
            </template>
          </span>
        </span>
        <span class="match-form__submit-glow" aria-hidden="true"></span>
      </button>
    </div>
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { generateMutation } from "~/graphql/graphqlGen";
import {
  $,
  e_lobby_access_enum,
  e_map_pool_types_enum,
  e_player_roles_enum,
} from "~/generated/zeus";
import matchOptionsValidator from "~/utilities/match-options-validator";
import { toast } from "@/components/ui/toast";
import { toTypedSchema } from "@vee-validate/zod";
import {
  setupOptions,
  setupOptionsVariables,
  setupOptionsSetMutation,
} from "~/utilities/setupOptions";

export default {
  props: {
    match: {
      type: Object,
      required: false,
    },
  },
  data() {
    return {
      form: useForm({
        keepValuesOnUnmount: true,
        validationSchema: toTypedSchema(
          matchOptionsValidator(
            this,
            {
              pug: z.boolean().default(true),
              team_1: z.string().optional(),
              team_2: z.string().optional(),
              lobby_access: z
                .nativeEnum(e_lobby_access_enum)
                .default(e_lobby_access_enum.Private),
            },
            useApplicationSettingsStore().settings,
          ),
        ),
        initialValues: {
          lobby_access: e_lobby_access_enum.Private,
        },
      }),
    };
  },
  watch: {
    match: {
      immediate: true,
      deep: true,
      handler(match) {
        if (!match) {
          return;
        }
        const matchOptions = match.options;

        setupOptions(this.form, matchOptions);

        for (const key in this.form.values) {
          switch (key) {
            case "pug":
              if (match.lineup_1.team_id || match.lineup_2.team_id) {
                this.form.setFieldValue(key, false);
              }
              break;
            case "team_1":
              if (match.lineup_1.team_id) {
                this.form.setFieldValue(key, match.lineup_1.team_id);
              }
              break;
            case "team_2":
              if (match.lineup_2.team_id) {
                this.form.setFieldValue(key, match.lineup_2.team_id);
              }
              break;
            case "map_pool":
              // do nothing, custom map pool will handle this.
              break;
            case "custom_map_pool":
              if (matchOptions.map_pool.type === e_map_pool_types_enum.Custom) {
                this.form.setFieldValue(key, true);
                this.form.setFieldValue(
                  "map_pool",
                  matchOptions.map_pool.maps.map((map) => map.id),
                );
              }
              break;
          }
        }
      },
    },
  },
  computed: {
    canSetVetoSettings() {
      return useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer);
    },
    isTournamentMatch() {
      return !!this.match?.is_tournament_match;
    },
  },
  methods: {
    activeLobbyAccessDescription(value: e_lobby_access_enum | undefined) {
      switch (value) {
        case e_lobby_access_enum.Invite:
          return this.$t("match_access.invite_code_description");
        case e_lobby_access_enum.Friends:
          return this.$t("match_access.friends_only_description");
        case e_lobby_access_enum.Open:
          return this.$t("match_access.open_description");
        case e_lobby_access_enum.Private:
        default:
          return this.$t("match_access.invite_only_description");
      }
    },
    async updateMatch() {
      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }

      if (!this.match) {
        this.createMatch();
        return;
      }

      const form = this.form.values;

      const matchLineup1 = this.match.lineup_1;
      const matchLineup2 = this.match.lineup_2;

      if (
        (form.team_1 === null && matchLineup1.team_1 !== undefined) ||
        form.team_1 != matchLineup1.team_id
      ) {
        await this.$apollo.mutate({
          mutation: generateMutation({
            update_match_lineups_by_pk: [
              {
                pk_columns: {
                  id: matchLineup1.id,
                },
                _set: {
                  team_id: form.team_1,
                },
              },
              {
                id: true,
              },
            ],
          }),
        });
      }

      if (
        (form.team_2 === null && matchLineup2.team_2 !== undefined) ||
        form.team_2 != matchLineup2.team_id
      ) {
        await this.$apollo.mutate({
          mutation: generateMutation({
            update_match_lineups_by_pk: [
              {
                pk_columns: {
                  id: matchLineup2.id,
                },
                _set: {
                  team_id: form.team_2,
                },
              },
              {
                id: true,
              },
            ],
          }),
        });
      }

      let mapPoolId = form.map_pool_id;

      if (
        this.match.options.map_pool.type === e_map_pool_types_enum.Custom &&
        !form.custom_map_pool
      ) {
        mapPoolId = form.map_pool_id;
      }

      if (form.custom_map_pool) {
        if (!mapPoolId) {
          const { data } = await this.$apollo.mutate({
            mutation: generateMutation({
              insert_map_pools_one: [
                {
                  object: {
                    type: e_map_pool_types_enum.Custom,
                    maps: {
                      data: form?.map_pool?.map((map_id) => {
                        return {
                          id: map_id,
                        };
                      }),
                    },
                  },
                },
                {
                  id: true,
                },
              ],
            }),
          });
          mapPoolId = data.insert_map_pools_one.id;
        } else {
          await this.$apollo.mutate({
            mutation: generateMutation({
              delete__map_pool: [
                {
                  where: {
                    map_pool_id: {
                      _eq: mapPoolId,
                    },
                  },
                },
                {
                  affected_rows: true,
                },
              ],
            }),
          });

          await this.$apollo.mutate({
            mutation: generateMutation({
              insert__map_pool: [
                {
                  objects: form?.map_pool?.map((map_id) => {
                    return {
                      map_id: map_id,
                      map_pool_id: mapPoolId,
                    };
                  }),
                },
                {
                  affected_rows: true,
                },
              ],
            }),
          });
        }
      }

      await this.$apollo.mutate({
        variables: setupOptionsVariables(form, {
          mapPoolId: mapPoolId,
          matchOptionsId: this.match.options.id,
        }),
        mutation: generateMutation({
          update_match_options_by_pk: [
            {
              pk_columns: {
                id: $("id", "uuid!"),
              },
              _set: setupOptionsSetMutation(!!mapPoolId),
            },
            {
              id: true,
            },
          ],
        }),
      });

      toast({
        title: this.$t("pages.matches.match_updated"),
      });
    },
    async createMatch() {
      const form = this.form.values;

      const { data } = await this.$apollo.mutate({
        variables: setupOptionsVariables(form, {
          mapPoolId: form.map_pool_id,
        }),
        mutation: generateMutation({
          insert_matches_one: [
            {
              object: {
                lineup_1: {
                  data: {
                    ...(this.form.values.team_1
                      ? { team_id: this.form.values.team_1 }
                      : {}),
                  },
                },
                ...(this.form.values.team_2
                  ? {
                      lineup_2: {
                        data: {
                          team_id: this.form.values.team_2,
                        },
                      },
                    }
                  : {}),
                options: {
                  data: setupOptionsSetMutation(!!form.map_pool_id),
                },
              },
            },
            {
              id: true,
            },
          ],
        }),
      });

      this.$router.push(`/matches/${data.insert_matches_one.id}`);
    },
  },
};
</script>

<style scoped>
/* ── Lobby Access ──────────────────────────── */
.match-form__access {
  padding: 1rem 1.25rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  background: hsl(var(--card) / 0.55);
  backdrop-filter: blur(6px);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.match-form__access-header {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}
.match-form__access-tick {
  width: 10px;
  height: 2px;
  background: hsl(var(--tac-amber));
}
.match-form__access-label {
  font-family: "Oxanium", monospace;
  font-size: 0.7rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}
.match-form__access-desc {
  margin-left: auto;
  font-size: 0.78rem;
  color: hsl(var(--muted-foreground));
}
.match-form__access-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.4rem;
}
@media (max-width: 640px) {
  .match-form__access-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
.match-form__access-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.6rem 0.65rem;
  font-family: "Oxanium", sans-serif;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  background: hsl(var(--muted) / 0.3);
  border: 1px solid hsl(var(--border));
  color: hsl(var(--muted-foreground));
  transition:
    color 140ms ease,
    background 140ms ease,
    border-color 140ms ease;
  cursor: pointer;
  clip-path: polygon(
    6px 0,
    100% 0,
    100% calc(100% - 6px),
    calc(100% - 6px) 100%,
    0 100%,
    0 6px
  );
}
.match-form__access-btn:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 0.5);
}
.match-form__access-btn--active {
  color: hsl(0 0% 8%);
  background: linear-gradient(
    135deg,
    hsl(36 100% 65%) 0%,
    hsl(var(--tac-amber)) 100%
  );
  border-color: hsl(var(--tac-amber));
  box-shadow:
    0 0 0 1px hsl(var(--tac-amber) / 0.4),
    0 6px 16px -6px hsl(var(--tac-amber) / 0.5);
}
.match-form__access-btn--active:hover {
  color: hsl(0 0% 8%);
  background: linear-gradient(
    135deg,
    hsl(36 100% 68%) 0%,
    hsl(var(--tac-amber)) 100%
  );
}

/* ── PUG toggle ────────────────────────────── */
.match-form__pug-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  background: hsl(var(--card) / 0.6);
  backdrop-filter: blur(6px);
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background 160ms ease;
}
.match-form__pug-card:hover {
  border-color: hsl(var(--tac-amber) / 0.4);
  background: hsl(var(--card) / 0.8);
}
.match-form__pug-card--on {
  border-color: hsl(var(--tac-amber) / 0.55);
  background: hsl(var(--tac-amber) / 0.06);
}
.match-form__pug-chevron {
  color: hsl(var(--tac-amber));
  font-size: 0.7rem;
}
.match-form__pug-label {
  font-family: "Oxanium", sans-serif;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.match-form__pug-desc {
  font-size: 0.82rem;
  color: hsl(var(--muted-foreground));
}

/* ── Teams VS picker ───────────────────────── */
.match-form__teams {
  position: relative;
  padding: 1.25rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  background: linear-gradient(
    180deg,
    hsl(var(--card) / 0.55) 0%,
    hsl(var(--card) / 0.25) 100%
  );
  backdrop-filter: blur(6px);
}
.match-form__teams-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-family: "Oxanium", monospace;
  font-size: 0.68rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
  margin-bottom: 0.85rem;
}
.match-form__teams-tick {
  width: 10px;
  height: 2px;
  background: hsl(var(--tac-amber));
}

.match-form__versus {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 1rem;
  align-items: end;
}

.match-form__team {
  min-width: 0;
}
.match-form__team-label {
  font-family: "Oxanium", monospace;
  font-size: 0.65rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}

.match-form__vs {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.85rem;
  margin-bottom: 0.125rem;
  font-family: "Oxanium", sans-serif;
  font-weight: 700;
  font-size: 0.85rem;
  letter-spacing: 0.22em;
  color: hsl(var(--tac-amber));
  background: hsl(var(--tac-amber) / 0.12);
  border: 1px solid hsl(var(--tac-amber) / 0.4);
  clip-path: polygon(
    0 0,
    calc(100% - 8px) 0,
    100% 8px,
    100% 100%,
    8px 100%,
    0 calc(100% - 8px)
  );
}

.match-form__teams-note {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding-top: 0.85rem;
  border-top: 1px solid hsl(var(--border));
  font-size: 0.78rem;
  font-style: italic;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 640px) {
  .match-form__versus {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  .match-form__vs {
    justify-self: center;
  }
}

/* ── Tactical Submit button ────────────────── */
.match-form__submit-row {
  margin-top: 2rem;
  display: flex;
  justify-content: center;
}

.match-form__submit {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  padding: 1rem 3rem;
  font-family: "Oxanium", sans-serif;
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: hsl(0 0% 8%);
  background: linear-gradient(
    135deg,
    hsl(36 100% 65%) 0%,
    hsl(var(--tac-amber)) 50%,
    hsl(28 90% 52%) 100%
  );
  border: 1px solid hsl(var(--tac-amber));
  clip-path: polygon(
    14px 0,
    100% 0,
    100% calc(100% - 14px),
    calc(100% - 14px) 100%,
    0 100%,
    0 14px
  );
  box-shadow:
    0 0 0 1px hsl(var(--tac-amber) / 0.4),
    0 8px 24px -6px hsl(var(--tac-amber) / 0.6);
  transition:
    transform 200ms cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 200ms ease;
  cursor: pointer;
  overflow: hidden;
}
.match-form__submit:hover {
  transform: translateY(-1px);
  box-shadow:
    0 0 0 1px hsl(var(--tac-amber) / 0.6),
    0 14px 36px -6px hsl(var(--tac-amber) / 0.8),
    0 0 28px hsl(var(--tac-amber) / 0.35);
}
.match-form__submit:active {
  transform: translateY(0);
}
.match-form__submit-inner {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
}
.match-form__submit-icon {
  fill: currentColor;
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
}
.match-form__submit:hover .match-form__submit-icon {
  transform: translateX(2px) scale(1.08);
}
.match-form__submit-glow {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    hsl(0 0% 100% / 0.35) 50%,
    transparent 100%
  );
  transform: translateX(-100%);
  transition: transform 700ms cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  z-index: 0;
}
.match-form__submit:hover .match-form__submit-glow {
  transform: translateX(100%);
}
</style>
