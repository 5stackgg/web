<script lang="ts" setup></script>

<template>
  <Breadcrumb class="hidden md:flex capitalize">
    <BreadcrumbList>
      <BreadcrumbItem>
        <BreadcrumbLink as-child>
          <NuxtLink :to="{ name: 'play' }" class="breadcrumb-link"> dashboard </NuxtLink>
        </BreadcrumbLink>
      </BreadcrumbItem>

      <template v-for="(crumb, index) in crumbs" :key="index">
        <BreadcrumbSeparator />

        <BreadcrumbItem>
          <BreadcrumbLink as-child>
            <NuxtLink :to="crumb.to" class="breadcrumb-link">
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

export default {
  computed: {
    me() {
      return useAuthStore().me;
    },
    tournamentContext() {
      return useTournamentContext().value;
    },
    crumbs() {
      const segments = this.$route.path.split("/").filter((segment: string) => {
        return segment.trim() !== "";
      });

      const breadcrumbs: Array<{
        text: string;
        to: string;
      }> = [];
      let path = "";
      const isMatchRoute =
        segments[0] === "matches" || segments[0] === "manage-matches";

      // If this is a tournament match, show tournament breadcrumbs instead
      if (isMatchRoute && this.tournamentContext) {
        breadcrumbs.push({
          text: "Tournaments",
          to: "/tournaments",
        });
        breadcrumbs.push({
          text: this.tournamentContext.name,
          to: `/tournaments/${this.tournamentContext.id}`,
        });
        // Add the match ID segment as the last crumb
        const matchId = segments[segments.length - 1];
        breadcrumbs.push({
          text: matchId,
          to: this.$route.path,
        });
        return breadcrumbs;
      }

      segments.forEach((segment: string) => {
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

<style scoped lang="postcss">
.router-link-active,
.router-link-exact-active {
  background-color: transparent;
}

:deep(.breadcrumb-link) {
  @apply rounded-md px-2 py-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors;
}
</style>
