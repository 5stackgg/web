<script lang="ts" setup></script>

<template>
  <Breadcrumb class="hidden md:flex capitalize">
    <BreadcrumbList>
      <BreadcrumbItem>
        <BreadcrumbLink as-child>
          <NuxtLink
            :to="{ name: 'play' }"
            class="inline-flex h-7 items-center rounded-md px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors [&.router-link-active]:bg-transparent [&.router-link-exact-active]:bg-transparent"
          >
            dashboard
          </NuxtLink>
        </BreadcrumbLink>
      </BreadcrumbItem>

      <template v-for="(crumb, index) in crumbs" :key="index">
        <BreadcrumbSeparator />

        <BreadcrumbItem>
          <BreadcrumbLink as-child>
            <NuxtLink
              :to="crumb.to"
              class="inline-flex h-7 items-center rounded-md px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors [&.router-link-active]:bg-transparent [&.router-link-exact-active]:bg-transparent"
            >
              {{ crumb.text.replace("-", " ") }}
            </NuxtLink>
          </BreadcrumbLink>
        </BreadcrumbItem>
      </template>
    </BreadcrumbList>
  </Breadcrumb>
</template>

<script lang="ts">
import { e_player_roles_enum } from "~/generated/zeus";
import { useTournamentContext } from "~/composables/useTournamentContext";
import { useMatchContext } from "~/composables/useMatchContext";
import { usePlayerContext } from "~/composables/usePlayerContext";
import { useTeamContext } from "~/composables/useTeamContext";

export default {
  computed: {
    me() {
      return useAuthStore().me;
    },
    crumbs() {
      const segments = this.$route.path.split("/").filter((segment: string) => {
        return segment.trim() !== "";
      });

      const tc = useTournamentContext();
      const mc = useMatchContext();
      const pc = usePlayerContext();
      const teamc = useTeamContext();
      const breadcrumbs: Array<{
        text: string;
        to: string;
      }> = [];

      // Tournament match: Dashboard > Tournaments > {name} > {match display}
      if (segments[0] === "matches" && segments[1] && mc.value?.tournament) {
        breadcrumbs.push({
          text: "tournaments",
          to: "/tournaments",
        });
        breadcrumbs.push({
          text: mc.value.tournament.name,
          to: `/tournaments/${mc.value.tournament.id}`,
        });
        breadcrumbs.push({
          text: mc.value.displayText,
          to: `/matches/${segments[1]}`,
        });
        return breadcrumbs;
      }

      let path = "";
      segments.forEach((segment: string, index: number) => {
        path += `/${segment}`;

        if (path === `/players/${this.me?.steam_id}`) {
          path = "/";
        }

        if (path === "/matches" || path.startsWith("/matches/")) {
          path = useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer)
            ? "/manage-matches"
            : "/play";
        }

        if (path.startsWith("/manage-matches/")) {
          path = path.replace("/manage-matches", "/matches");
        }

        // Wait for tournament name to resolve before showing the crumb
        if (segments[0] === "tournaments" && index === 1) {
          if (tc.value?.id !== segment) {
            return;
          }
          breadcrumbs.push({
            text: tc.value.name,
            to: path,
          });
          return;
        }

        // Wait for match display text to resolve before showing the crumb
        if (segments[0] === "matches" && index === 1) {
          if (mc.value?.id !== segment) {
            return;
          }
          breadcrumbs.push({
            text: mc.value.displayText,
            to: path,
          });
          return;
        }

        // Wait for player name to resolve before showing the crumb
        if (segments[0] === "players" && index === 1) {
          if (pc.value?.id !== segment) {
            return;
          }
          breadcrumbs.push({
            text: pc.value.name,
            to: path,
          });
          return;
        }

        // Wait for team name to resolve before showing the crumb
        if (segments[0] === "teams" && index === 1) {
          if (teamc.value?.id !== segment) {
            return;
          }
          breadcrumbs.push({
            text: teamc.value.name,
            to: path,
          });
          return;
        }

        breadcrumbs.push({
          text: segment,
          to: path,
        });
      });
      return breadcrumbs;
    },
  },
};
</script>
