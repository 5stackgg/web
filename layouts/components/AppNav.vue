<template>
  <!-- ========== MAIN CONTENT ========== -->
  <!-- Sidebar Toggle -->
  <div
    class="sticky top-0 inset-x-0 z-20 bg-white border-y px-4 sm:px-6 md:px-8 lg:hidden dark:bg-gray-800 dark:border-gray-700"
  >
    <div class="flex items-center py-4">
      <!-- Navigation Toggle -->
      <button
        type="button"
        class="text-gray-500 hover:text-gray-600"
        data-hs-overlay="#application-sidebar"
        aria-controls="application-sidebar"
        aria-label="Toggle navigation"
      >
        <span class="sr-only">Toggle Navigation</span>
        <svg
          class="w-5 h-5"
          width="16"
          height="16"
          fill="currentColor"
          viewBox="0 0 16 16"
        >
          <path
            fill-rule="evenodd"
            d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"
          />
        </svg>
      </button>
      <!-- End Navigation Toggle -->

      <!-- Breadcrumb -->
      <ol
        class="ms-3 flex items-center whitespace-nowrap"
        aria-label="Breadcrumb"
      >
        <li class="flex items-center text-sm text-gray-800 dark:text-gray-400">
          Application Layout
          <svg
            class="flex-shrink-0 mx-3 overflow-visible h-2.5 w-2.5 text-gray-400 dark:text-gray-600"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M5 1L10.6869 7.16086C10.8637 7.35239 10.8637 7.64761 10.6869 7.83914L5 14"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </li>
        <li
          class="text-sm font-semibold text-gray-800 truncate dark:text-gray-400"
          aria-current="page"
        >
          Dashboard
        </li>
      </ol>
      <!-- End Breadcrumb -->
    </div>
  </div>
  <!-- End Sidebar Toggle -->

  <!-- Sidebar -->
  <div
    id="application-sidebar"
    class="hs-overlay hs-overlay-open:translate-x-0 -translate-x-full transition-all duration-300 transform hidden fixed top-0 start-0 bottom-0 z-[60] w-64 bg-white border-e border-gray-200 pt-7 pb-10 overflow-y-auto lg:block lg:translate-x-0 lg:end-auto lg:bottom-0 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-slate-700 dark:[&::-webkit-scrollbar-thumb]:bg-slate-500 dark:bg-gray-800 dark:border-gray-700"
  >
    <div class="px-6">
      <a
        class="flex-none text-xl font-semibold dark:text-white"
        href="#"
        aria-label="Brand"
      >
        <five-stack-logo style="max-width: 100%"></five-stack-logo>
      </a>
    </div>

    <nav
      class="hs-accordion-group p-6 w-full flex flex-col flex-wrap"
      data-hs-accordion-always-open
    >
      <ul class="space-y-1.5">
        <li>
          <NuxtLink to="/" class="nav-item"> Dashboard </NuxtLink>
        </li>

        <li>
          <NuxtLink to="/matches" class="nav-item"> Matches </NuxtLink>
        </li>

        <li>
          <NuxtLink to="/teams" class="nav-item"> Teams </NuxtLink>
        </li>

        <li>
          <NuxtLink to="/players" class="nav-item"> Players </NuxtLink>
        </li>

        <!--        <li>-->
        <!--          <NuxtLink to="/leagues" class="nav-item"> Leagues </NuxtLink>-->
        <!--        </li>-->

        <!--        <li>-->
        <!--          <NuxtLink to="/events" class="nav-item"> Events </NuxtLink>-->
        <!--        </li>-->

        <hr />

        <li>
          <NuxtLink to="/servers" class="nav-item"> Manage Servers </NuxtLink>
        </li>
      </ul>
    </nav>

    <div class="flex flex-col flex-grow">
      <five-stack-button @click="connectDiscord" v-if="!me.discord_id"
        >Connect Discord to use match creating bot</five-stack-button
      >
      <NuxtLink :to="`/players/${me.steam_id}`" class="nav-item">
        <div>
          <img
            class="inline-block h-[2.875rem] w-[2.875rem] rounded-lg"
            :src="me.player.avatar_url"
          />
          {{ me.player.name }} <small>[{{ me.steam_id }}]</small>
        </div>
      </NuxtLink>

      <template v-for="invite of invites">
        Team Invite for {{ invite.team.name }}

        <five-stack-button @click="acceptInvite(invite.id)"
          >Accept</five-stack-button
        >
        <five-stack-button @click="denyInvite(invite.id)"
          >DENY
        </five-stack-button>
      </template>
    </div>
  </div>
</template>
<script setup lang="ts">
import FiveStackLogo from "~/components/icons/FiveStackLogo.vue";
</script>

<script lang="ts">
import { useAuthStore } from "~/stores/AuthStore";
import { generateMutation } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";

export default {
  computed: {
    me() {
      return useAuthStore().me!;
    },
  },
  data() {
    return {
      invites: undefined,
    };
  },
  apollo: {
    $subscribe: {
      team_invites: {
        query: typedGql("subscription")({
          team_invites: [
            {
              where: {
                steam_id: {
                  _eq: $("steam_id", "bigint!"),
                },
              },
            },
            {
              id: true,
              team: {
                id: true,
                name: true,
              },
            },
          ],
        }),
        variables: function () {
          return {
            steam_id: this.me.steam_id,
          };
        },
        result: function ({ data }) {
          this.invites = data.team_invites;
        },
      },
    },
  },
  methods: {
    connectDiscord() {
      window.location = `https://api.5stack.gg/auth/discord?redirect=${encodeURIComponent(
        window.location.toString(),
      )}`;
    },
    async acceptInvite(inviteId) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          acceptTeamInvite: [
            {
              invite_id: inviteId,
            },
            {
              success: true,
            },
          ],
        }),
      });
    },
    async denyInvite(inviteId) {
      // TODO - lets make an action so it can remove them from the teams pending list
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
  },
};
</script>

<style lang="scss">
.nav-item {
  @apply flex items-center gap-x-3.5 py-2 px-2.5 text-sm text-slate-700 rounded-lg hover:bg-gray-100 dark:focus:outline-none dark:focus:ring-1 dark:focus:ring-gray-600 dark:hover:bg-gray-900 dark:text-slate-400 dark:hover:text-slate-300;
}

.router-link-active {
  @apply bg-gray-100 dark:bg-gray-900 dark:text-white;
}
</style>
