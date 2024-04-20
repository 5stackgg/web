<script lang="ts" setup>

</script>

<template>
  <Breadcrumb class="hidden md:flex">
    <BreadcrumbList>
      <BreadcrumbItem>
        <BreadcrumbLink as-child>
          <NuxtLink to="/" class="crumb"> dashboard </NuxtLink>
        </BreadcrumbLink>
      </BreadcrumbItem>

      <template v-for="(crumb, index) in crumbs" :key="index">
        <BreadcrumbSeparator />

        <BreadcrumbItem>
          <BreadcrumbLink as-child>
            <NuxtLink :to="crumb.to" class="crumb"> {{ crumb.text }} </NuxtLink>
          </BreadcrumbLink>
        </BreadcrumbItem>
      </template>
    </BreadcrumbList>
  </Breadcrumb>
</template>

<script lang="ts">
export default {
  computed: {
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
