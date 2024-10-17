<script lang="ts" setup>
import { AlertCircle } from "lucide-vue-next";
</script>

<template>
  <div v-if="hasUpdatesAvailalbe">
    <AlertDialog>
      <AlertDialogTrigger>
        <Button variant="ghost" size="icon">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <AlertCircle class="h-5 w-5 text-orange-500" />
              </TooltipTrigger>
              <TooltipContent>
                <span>System Update Available</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>System Update Available</AlertDialogTitle>
          <AlertDialogDescription>
            There are system updates available. Would you like to update now?
            This will cause some serivces to be restarted
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
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
    hasUpdatesAvailalbe() {
      return useApplicationSettingsStore().hasUpdates;
    },
  },
};
</script>
