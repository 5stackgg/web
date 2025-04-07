<script setup lang="ts">
import PageHeading from "~/components/PageHeading.vue";
import MyRecentMatches from "~/components/match/MyRecentMatches.vue";
import Separator from "~/components/ui/separator/Separator.vue";
import OtherMatches from "~/components/match/OtherMatches.vue";
import MyMatches from "~/components/match/MyMatches.vue";
import LastTenWins from "~/components/charts/LastTenWins.vue";
import LastTenLosses from "~/components/charts/LastTenLosses.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { PlusCircle } from "lucide-vue-next";
</script>

<template>
  <PageHeading>
    <template #title>{{ $t("pages.matches.title") }}</template>
    <template #description>{{ $t("pages.matches.description") }}</template>
    <template #actions>
      <div class="flex gap-4 items-center">
        <template v-if="!canCreateMatch">
          <FiveStackToolTip :size="16" class="text-red-600">{{
            $t("pages.matches.admin_disabled")
          }}</FiveStackToolTip>
        </template>
        <Button
          size="lg"
          :disabled="!canCreateMatch"
          @click="canCreateMatch && navigateTo('/matches/create')"
        >
          <PlusCircle class="w-4 h-4" />
          <span class="hidden md:inline ml-2">{{
            $t("pages.matches.create")
          }}</span>
        </Button>
      </div>
    </template>
  </PageHeading>

  <div class="hidden md:grid grid-cols-2 gap-4 my-4">
    <Card class="flex justify-center items-center p-4">
      <div class="text-center">
        <CardHeader class="p-4">
          <CardTitle class="text-xl font-bold text-center">
            {{ $t("pages.matches.last_ten_wins") }}
          </CardTitle>
        </CardHeader>
        <CardContent class="p-4">
          <LastTenWins />
        </CardContent>
      </div>
    </Card>
    <Card class="flex justify-center items-center p-4">
      <div class="text-center">
        <CardHeader class="p-4">
          <CardTitle class="text-xl font-bold text-center">
            {{ $t("pages.matches.last_ten_losses") }}
          </CardTitle>
        </CardHeader>
        <CardContent class="p-4">
          <LastTenLosses />
        </CardContent>
      </div>
    </Card>
  </div>

  <Separator class="my-4" />

  <MyRecentMatches></MyRecentMatches>

  <Separator class="my-4" />

  <Card class="p-4">
    <Tabs default-value="open">
      <TabsList>
        <TabsTrigger value="open">{{
          $t("pages.matches.my_match_history")
        }}</TabsTrigger>
        <TabsTrigger value="other">{{
          $t("pages.matches.other_matches")
        }}</TabsTrigger>
      </TabsList>

      <TabsContent value="open">
        <MyMatches> </MyMatches>
      </TabsContent>
      <TabsContent value="other">
        <OtherMatches></OtherMatches>
      </TabsContent>
    </Tabs>
  </Card>

  <div id="pagination"></div>
</template>

<script lang="ts">
export default {
  computed: {
    canCreateMatch() {
      return useApplicationSettingsStore().canCreateMatch;
    },
  },
};
</script>
