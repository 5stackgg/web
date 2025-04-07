<script lang="ts" setup>
import { AlertCircle } from "lucide-vue-next";
</script>

<template>
  <div v-if="updates.length > 0" class="relative flex items-center">
    <AlertDialog>
      <AlertDialogTrigger>
        <Button variant="ghost" size="icon" class="h-6 flex items-center">
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
            <p class="text-gray-600 mb-2">
              {{ $t("layouts.system_update.description") }}
            </p>
            <ul class="list-disc list-inside mt-2 space-y-1">
              <li
                v-for="update in updates"
                :key="update.pod"
                class="flex items-center"
              >
                <span class="mr-2">•</span>{{ update.service }}
              </li>
            </ul>
            <p class="my-4 text-sm text-gray-500 italic">
              {{ $t("layouts.system_update.note") }}

              <a
                href="https://docs.5stack.gg/common-issues/system-not-updating"
                target="_blank"
                class="text-blue-500"
              >
                {{ $t("layouts.system_update.fix_link") }}
              </a>
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter class="space-x-2">
          <AlertDialogCancel>{{
            $t("layouts.system_update.cancel")
          }}</AlertDialogCancel>
          <AlertDialogAction @click="updateServices">{{
            $t("layouts.system_update.update")
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
        title: "System is Updating",
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
  },
};
</script>
