<script lang="ts" setup>
import BooleanToText from "../BooleanToText.vue";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import MiniMapDisplay from "~/components/MinIMapDisplay.vue";
</script>

<template>
  <template v-if="options.map_veto">
    <div class="my-3">
      <div class="flex gap-4">
        <MiniMapDisplay
          v-for="map in options.map_pool.maps"
          :key="map.id"
          :map="map"
        />
      </div>
    </div>

    <template v-if="showDetailsByDefault">
      <Separator />
    </template>
  </template>

  <Collapsible v-model:open="showDetails">
    <CollapsibleTrigger as-child v-if="!showDetailsByDefault">
      <Button
        variant="ghost"
        size="sm"
        class="text-xs text-muted-foreground hover:text-foreground -ml-2 h-auto py-1"
      >
        {{ $t("match.options.advanced_settings") }}
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div class="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <!-- Game Settings -->
        <Card>
          <CardHeader class="pb-3">
            <CardTitle class="text-sm font-medium">Game Settings</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted-foreground">{{
                $t("match.options.max_rounds")
              }}</span>
              <span class="text-sm font-medium">{{ options.mr }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted-foreground">{{
                $t("match.options.tv_delay")
              }}</span>
              <span class="text-sm font-medium"
                >{{ options.tv_delay }} {{ $t("match.options.seconds") }}</span
              >
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted-foreground">{{
                $t("match.options.overtime")
              }}</span>
              <BooleanToText :value="options.overtime" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted-foreground">{{
                $t("match.options.knife_round")
              }}</span>
              <BooleanToText :value="options.knife_round" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted-foreground">{{
                $t("match.options.default_player_models")
              }}</span>
              <BooleanToText :value="options.default_models ?? false" />
            </div>
          </CardContent>
        </Card>

        <!-- Team Settings -->
        <Card>
          <CardHeader class="pb-3">
            <CardTitle class="text-sm font-medium">Team Settings</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted-foreground">{{
                $t("match.options.coaches")
              }}</span>
              <BooleanToText :value="options.coaches" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted-foreground">{{
                $t("match.options.substitutes")
              }}</span>
              <span class="text-sm font-medium">{{
                options.number_of_substitutes
              }}</span>
            </div>
          </CardContent>
        </Card>

        <!-- Veto Settings -->
        <Card>
          <CardHeader class="pb-3">
            <CardTitle class="text-sm font-medium">Veto Settings</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted-foreground">{{
                $t("match.options.map_veto_enabled")
              }}</span>
              <BooleanToText :value="options.map_veto" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted-foreground">{{
                $t("match.options.region_veto")
              }}</span>
              <BooleanToText :value="options.region_veto" />
            </div>
          </CardContent>
        </Card>

        <!-- Control Settings -->
        <Card>
          <CardHeader class="pb-3">
            <CardTitle class="text-sm font-medium">Control Settings</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted-foreground">{{
                $t("match.options.timeout_setting")
              }}</span>
              <span class="text-sm font-medium">{{
                options.timeout_setting
              }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted-foreground">{{
                $t("match.options.tech_timeout_setting")
              }}</span>
              <span class="text-sm font-medium">{{
                options.tech_timeout_setting
              }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted-foreground">{{
                $t("match.options.ready_setting")
              }}</span>
              <span class="text-sm font-medium">{{
                options.ready_setting
              }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted-foreground">{{
                $t("match.options.check_in_setting")
              }}</span>
              <span class="text-sm font-medium">{{
                options.check_in_setting
              }}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>

<script lang="ts">
export default {
  props: {
    options: {
      type: Object,
      required: true,
    },
    showDetailsByDefault: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      showDetails: this.showDetailsByDefault,
    };
  },
};
</script>
