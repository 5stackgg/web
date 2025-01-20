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
                <span>System Update Available</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent class="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle class="text-2xl font-bold"
            >System Update Available</AlertDialogTitle
          >
          <AlertDialogDescription>
            <p class="text-gray-600 mb-2">
              The following services have updates:
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
              Please note: It will take a few minutes to process and verify the
              new updates.

              <a
                href="https://docs.5stack.gg/common-issues/system-not-updating"
                target="_blank"
                class="text-blue-500"
                >If a system upgrade persists, you may need to fix your
                versions</a
              >
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter class="space-x-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction @click="updateServices">Update</AlertDialogAction>
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
