<script lang="ts" setup></script>

<template>
  <Breadcrumb class="hidden md:flex capitalize">
    <BreadcrumbList>
      <BreadcrumbItem>
        <BreadcrumbLink as-child>
          <NuxtLink :to="{ name: 'play' }"> dashboard </NuxtLink>
        </BreadcrumbLink>
      </BreadcrumbItem>

      <template v-for="(crumb, index) in crumbs" :key="index">
        <BreadcrumbSeparator />

        <BreadcrumbItem>
          <BreadcrumbLink as-child>
            <NuxtLink :to="crumb.to">
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
    crumbs() {
      const segments = this.$route.path.split("/").filter((segment: string) => {
        return segment.trim() !== "";
      });

      const breadcrumbs: Array<{
        text: string;
        to: string;
      }> = [];
      let path = "";
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
</style>
