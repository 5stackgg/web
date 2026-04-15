<script lang="ts" setup>
import { AlertCircle } from "lucide-vue-next";
</script>

<template>
  <div v-if="updates.length > 0" class="relative flex items-center">
    <AlertDialog>
      <AlertDialogTrigger>
        <Button variant="ghost" size="icon" class="flex items-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <AlertCircle class="h-4 w-4 animate-pulse text-orange-500" />
              </TooltipTrigger>
              <TooltipContent>
                <span>{{ $t("layouts.system_update.title") }}</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent class="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle class="text-2xl font-bold">
            {{ $t("layouts.system_update.title") }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            <div class="flex flex-col space-y-4">
              <template v-if="hasServiceUpdate">
                <p class="text-gray-600 mb-2">
                  {{ $t("layouts.system_update.description") }}
                </p>

                <div>
                  <ul class="list-disc list-inside mt-2 space-y-1">
                    <template
                      v-for="update in updates"
                      :key="`${update.service}-${update.pod}`"
                    >
                      <li
                        class="flex items-center"
                        v-if="update.service !== 'panel'"
                      >
                        <span class="mr-2">•</span>{{ update.service }}
                      </li>
                    </template>
                  </ul>
                </div>
              </template>

              <div
                v-if="hasPanelUpdate"
                class="flex flex-col space-y-4 text-sm text-gray-500 italic"
              >
                {{ $t("layouts.system_update.panel_update") }}

                <code
                  class="block bg-gray-100 dark:bg-gray-800 p-2 rounded font-mono text-sm"
                >
                  git pull && ./update.sh
                </code>
              </div>

              <p>
                {{ $t("layouts.system_update.note") }}

                <a
                  href="https://docs.5stack.gg/common-issues/system-not-updating"
                  target="_blank"
                  class="text-blue-500"
                >
                  {{ $t("layouts.system_update.fix_link") }}
                </a>
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter class="space-x-2">
          <AlertDialogCancel>{{
            $t("common.cancel")
          }}</AlertDialogCancel>
          <AlertDialogAction @click="updateServices">{{
            $t("common.update")
          }}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script lang="ts">
import { toast } from "@/components/ui/toast";
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  methods: {
    async updateServices() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          updateServices: {
            success: true,
          },
        }),
      });

      toast({
        title: this.$t("layouts.system_update.updating"),
      });
    },
  },
  computed: {
    updates() {
      const updates = useApplicationSettingsStore().settings?.find(
        ({ name }) => {
          return name === "updates";
        },
      )?.value;

      if (!updates) {
        return [];
      }

      return JSON.parse(updates);
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
