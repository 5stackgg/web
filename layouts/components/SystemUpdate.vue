<script lang="ts" setup>
import { AlertCircle } from "lucide-vue-next";
</script>

<template>
  <div v-if="hasUpdatesAvailable" class="relative">
    <AlertDialog>
      <AlertDialogTrigger>
        <Button variant="ghost" size="icon">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <AlertCircle class="h-5 w-5 animate-pulse text-orange-500" />
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
                v-for="service in servicesNeedsUpdates"
                :key="service.name"
                class="flex items-center"
              >
                <span class="mr-2">•</span>{{ service.name }}
              </li>
            </ul>
            <p class="my-4 text-sm text-gray-500 italic">
              Please note: It will take a few minutes to process and verify the
              new updates.
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
    servicesNeedsUpdates() {
      const versionUpdates = useApplicationSettingsStore().settings?.filter(
        (setting: { name: string }) => {
          return ["api", "web", "game-server-node"].includes(setting.name);
        },
      );

      return (
        versionUpdates?.filter(({ value }) => {
          const { current, latest } = JSON.parse(value);
          return current !== latest;
        }) || []
      );
    },
    hasUpdatesAvailable() {
      return this.servicesNeedsUpdates.length > 0;
    },
  },
};
</script>
