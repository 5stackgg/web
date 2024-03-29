<template>
  <template v-if="team">
    <h1>
      <span
        :contentEditable="editingTeamName"
        @keydown.enter.prevent="updateTeamName"
        ref="team-name"
      >
        {{ team.name }}
      </span>
      [{{ team.short_name }}]
    </h1>
    <small @click="editTeamName">
      <template v-if="editingTeamName"> cancel </template>
      <template v-else> rename </template>
    </small>

    <div class="max-w-[85rem] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 mx-auto">
      <div class="grid md:grid-cols-2 gap-12">
        <div
          class="flex flex-col border rounded-xl p-4 sm:p-6 lg:p-10 dark:border-gray-700"
        >
          <template v-for="member of team.roster">
            <img
              class="inline-block h-[2.875rem] w-[2.875rem] rounded-lg"
              :src="member.player.avatar_url"
            />
            {{ member.player.name }}
            <small>[{{ member.player.steam_id }}]</small>
            <div
              @click="removeMember(member.player.steam_id)"
              class="cursor-pointer flex justify-center items-center w-7 h-7 text-sm font-semibold rounded-full border border-transparent text-gray-800 bg-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none dark:text-white dark:hover:bg-gray-700 dark:focus:outline-none dark:focus:ring-1 dark:focus:ring-gray-600"
            >
              <close-icon></close-icon>
            </div>
          </template>

          <template v-for="invite of team.invites">
            PENDING INVITES
            <img
                class="inline-block h-[2.875rem] w-[2.875rem] rounded-lg"
                :src="invite.player.avatar_url"
            />
            {{ invite.player.name }}
            <small>[{{ invite.player.steam_id }}]</small>
            <div
                @click="removeInvite(invite.id)"
                class="cursor-pointer flex justify-center items-center w-7 h-7 text-sm font-semibold rounded-full border border-transparent text-gray-800 bg-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none dark:text-white dark:hover:bg-gray-700 dark:focus:outline-none dark:focus:ring-1 dark:focus:ring-gray-600"
            >
              <close-icon></close-icon>
            </div>
          </template>

        </div>

        <div>
          <h1>Adding Members</h1>
          <form @submit.prevent>
            <five-stack-search-input
              placeholder="Find Player"
              v-model="form.member"
              :search="searchPlayers"
            ></five-stack-search-input>
          </form>
        </div>
      </div>
    </div>

    <hr />
    Recent Matches / Scheduled

    <hr />

    <matches-table :matches="team.matches"></matches-table>

    <confirm-dialog :confirm-action="deleteTeam">
      <div
        class="cursor-pointer flex justify-center items-center w-7 h-7 text-sm font-semibold rounded-full border border-transparent text-red-500 bg-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none dark:text-white dark:hover:bg-gray-700 dark:focus:outline-none dark:focus:ring-1 dark:focus:ring-gray-600"
      >
        Delete Team
        <close-icon></close-icon>
      </div>
    </confirm-dialog>
  </template>
</template>

<script lang="ts">
import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import Tab from "~/components/tabs/Tab.vue";
import FiveStackSearchInput from "~/components/forms/FiveStackSearchInput.vue";
import FiveStackCheckbox from "~/components/forms/FiveStackCheckbox.vue";
import FiveStackSelectInput from "~/components/forms/FiveStackSelectInput.vue";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import CloseIcon from "~/components/icons/CloseIcon.vue";
import ConfirmDialog from "~/components/ConfirmDialog.vue";
import { matchFields } from "~/graphql/matchesGraphql";

export default {
  components: {
    ConfirmDialog,
    CloseIcon,
    FiveStackSelectInput,
    FiveStackCheckbox,
    FiveStackSearchInput,
    Tab,
  },
  data() {
    return {
      team: undefined,
      editingTeamName: false,
      form: {
        member: undefined,
      },
    };
  },
  apollo: {
    $subscribe: {
      teams_by_pk: {
        query: typedGql("subscription")({
          teams_by_pk: [
            {
              id: $("teamId", "uuid!"),
            },
            {
              name: true,
              short_name: true,
              roster: [
                {},
                {
                  player: {
                    name: true,
                    steam_id: true,
                    avatar_url: true,
                  },
                },
              ],
              invites: [{}, {
                id: true,
                player: {
                  name: true,
                  steam_id: true,
                  avatar_url: true,
                }
              }],
              matches: [{}, matchFields],
            },
          ],
        }),
        variables: function () {
          return {
            teamId: this.$route.params.id,
          };
        },
        result: function ({ data }) {
          this.team = data.teams_by_pk;
        },
      },
    },
  },
  watch: {
    ["form.member"]: {
      handler(member) {
        if (member) {
          this.form.member = undefined;
          this.addMember(member.value.steam_id);
        }
      },
    },
  },
  methods: {
    async addMember(steam_id) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_team_invites_one: [
            {
              object: {
                steam_id,
                team_id: this.$route.params.id,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async removeInvite(inviteId) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_team_invites_by_pk: [
            {
              id: inviteId,
            },
            {
              id: true,
            },
          ],
        }),
      });
    },
    async removeMember(player_steam_id: string) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_team_roster_by_pk: [
            {
              player_steam_id,
              team_id: this.$route.params.id,
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async searchPlayers(query) {
      const { data } = await this.$apollo.query({
        query: generateQuery({
          players: [
            {
              where: {
                ...(/^[0-9]+$/.test(query)
                  ? {
                      steam_id: {
                        _eq: $("playerSteamIdQuery", "bigint"),
                      },
                    }
                  : {
                      name: {
                        _ilike: $("playerQuery", "String"),
                      },
                    }),
              },
            },
            {
              name: true,
              steam_id: true,
              avatar_url: true,
            },
          ],
        }),
        variables: {
          playerQuery: `%${query}%`,
          playerSteamIdQuery: query,
        },
      });

      return data.players
        .filter((player) => {
          return !this.team.roster.find((member) => {
            return member.player.steam_id === player.steam_id;
          });
        })
        .map((user) => {
          return {
            value: user,
            display: `<img class="inline-block h-[2.875rem] w-[2.875rem] rounded-lg" src="${user.avatar_url}"> ${user.name} <small>[${user.steam_id}]</small>`,
          };
        });
    },
    async deleteTeam() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_teams_by_pk: [
            {
              id: this.$route.params.id,
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      this.$router.push("/teams");
    },
    async editTeamName() {
      this.editingTeamName = !this.editingTeamName;
      if (this.editingTeamName) {
        const teamNameRef = this.$refs["team-name"];

        this.$nextTick(() => {
          teamNameRef.focus();
          const range = document.createRange();
          const selection = window.getSelection();

          range.setStart(
            teamNameRef.childNodes[0],
            teamNameRef.textContent.length,
          ); // Set the cursor at the end
          range.collapse(true); // Collapse the range to the end
          selection.removeAllRanges();
          selection.addRange(range);
        });
      }
    },
    async updateTeamName() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_teams_by_pk: [
            {
              pk_columns: {
                id: this.$route.params.id,
              },
              _set: {
                name: this.$refs["team-name"].innerHTML,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
      this.editingTeamName = false;
    },
  },
};
</script>
