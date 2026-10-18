<script lang="ts" setup>
import { AlertCircle } from "lucide-vue-next";
import { toast } from "@/components/ui/toast";
import { generateMutation } from "~/graphql/graphqlGen";
import { useApolloClient } from "@vue/apollo-composable";

const { client } = useApolloClient();
const { t } = useI18n();
async function updateServices() {
  await client.mutate({
    mutation: generateMutation({ updateServices: { success: true } }),
  });
  toast({ title: t("layouts.system_update.updating") });
}
</script>

<template>
  <div v-if="updates.length > 0" class="relative flex items-center">
    <AlertDialog>
      <AlertDialogTrigger>
        <Button variant="ghost" size="icon" class="flex items-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                ><AlertCircle class="h-4 w-4 animate-pulse text-orange-500"
              /></TooltipTrigger>
              <TooltipContent>{{
                $t("layouts.system_update.title")
              }}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent class="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle class="text-2xl font-bold">{{
            $t("layouts.system_update.title")
          }}</AlertDialogTitle>
          <AlertDialogDescription>
            <div class="flex flex-col space-y-4">
              <p>{{ $t("layouts.system_update.description") }}</p>
              <ul class="space-y-3">
                <li
                  v-for="update in updates"
                  :key="update.service + '-' + (update.pod || '')"
                  class="space-y-1"
                >
                  <span class="font-medium">{{
                    update.plugin
                      ? update.plugin + " (" + update.service + ")"
                      : update.service
                  }}</span>
                  <div
                    class="break-all text-xs text-muted-foreground"
                    v-if="update.currentVersion"
                  >
                    {{
                      $t("pages.settings.application.updates.installed_build")
                    }}: {{ update.currentImage || "" }}
                    {{ update.currentVersion }}
                  </div>
                  <div
                    class="break-all text-xs text-muted-foreground"
                    v-if="update.newVersion"
                  >
                    {{
                      $t("pages.settings.application.updates.selected_build")
                    }}:
                    {{
                      update.targetImage ||
                      (update.repository
                        ? update.repository + "@" + update.ref
                        : "")
                    }}
                    {{ update.newVersion }}
                  </div>
                </li>
              </ul>
              <p v-if="hasPanelUpdate">
                {{ $t("pages.settings.application.updates.apply_description") }}
              </p>
              <NuxtLink
                to="/settings/application/updates"
                class="text-primary underline"
              >
                {{ $t("pages.settings.application.updates.title") }}
              </NuxtLink>
              <p>{{ $t("layouts.system_update.note") }}</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter class="space-x-2">
          <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
          <AlertDialogAction v-if="hasServiceUpdate" @click="updateServices">{{
            $t("common.update")
          }}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script lang="ts">
export default {
  computed: {
    updates() {
      const value = useApplicationSettingsStore().settings?.find(
        ({ name }) => name === "updates",
      )?.value;
      if (!value) return [];
      try {
        const rows = JSON.parse(value);
        return Array.isArray(rows)
          ? rows.filter((row) => row && typeof row.service === "string")
          : [];
      } catch {
        return [];
      }
    },
    hasServiceUpdate() {
      return this.updates.some((update) => update.service !== "panel");
    },
    hasPanelUpdate() {
      return this.updates.some((update) => update.service === "panel");
    },
  },
};
</script>
