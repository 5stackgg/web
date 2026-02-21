<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { generateMutation } from "~/graphql/graphqlGen";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

definePageMeta({
  layout: "application-settings",
});

const config = useRuntimeConfig();
const isDev = computed(
  () =>
    config.public.webDomain.includes("localhost") ||
    config.public.webDomain.includes(".local"),
);

const settings = computed(() => useApplicationSettingsStore().settings);

const fixturesLoaded = computed(() => {
  return (
    settings.value?.find(
      (s: { name: string; value: string }) => s.name === "dev.fixtures_loaded",
    )?.value === "true"
  );
});

const showLoadDialog = ref(false);
const showReloadDialog = ref(false);
const showRemoveDialog = ref(false);
const loading = ref(false);

async function doLoadFixtures() {
  loading.value = true;
  showLoadDialog.value = false;
  showReloadDialog.value = false;

  try {
    await useNuxtApp().$apollo.defaultClient.mutate({
      mutation: generateMutation({
        loadFixtures: {
          success: true,
        },
      }),
    });

    toast({
      title: "Fixtures loaded successfully",
    });
  } catch (error: any) {
    toast({
      title: "Failed to load fixtures",
      description: error?.message || "An error occurred",
      variant: "destructive",
    });
  } finally {
    loading.value = false;
  }
}

async function doRemoveFixtures() {
  loading.value = true;
  showRemoveDialog.value = false;

  try {
    await useNuxtApp().$apollo.defaultClient.mutate({
      mutation: generateMutation({
        removeFixtures: {
          success: true,
        },
      }),
    });

    toast({
      title: "Fixtures removed successfully",
    });
  } catch (error: any) {
    toast({
      title: "Failed to remove fixtures",
      description: error?.message || "An error occurred",
      variant: "destructive",
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <PageTransition :delay="0">
    <div v-if="!isDev" class="p-6">
      <p class="text-muted-foreground">
        Fixtures are only available in development mode.
      </p>
    </div>

    <div v-else>
      <div class="p-6">
        <template v-if="!fixturesLoaded">
          <h3 class="text-lg font-semibold">Load Demo Fixtures</h3>
          <p class="text-sm text-muted-foreground mt-1">
            Populate the database with sample players, teams, matches, and
            tournaments for testing.
          </p>
          <div class="mt-4">
            <Button
              variant="destructive"
              :disabled="loading"
              @click="showLoadDialog = true"
            >
              {{ loading ? "Loading..." : "Load Fixtures" }}
            </Button>
          </div>
        </template>

        <template v-else>
          <h3 class="text-lg font-semibold">Demo Fixtures Loaded</h3>
          <p class="text-sm text-muted-foreground mt-1">
            Fixture data is currently loaded in the database.
          </p>
          <div class="mt-4 flex gap-3">
            <Button
              variant="destructive"
              :disabled="loading"
              @click="showReloadDialog = true"
            >
              {{ loading ? "Processing..." : "Reload Fixtures" }}
            </Button>
            <Button
              variant="outline"
              :disabled="loading"
              @click="showRemoveDialog = true"
            >
              {{ loading ? "Processing..." : "Remove Fixtures" }}
            </Button>
          </div>
        </template>
      </div>

      <AlertDialog v-model:open="showLoadDialog">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Load Fixture Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will insert 40 players, 8 teams, ~120 matches, and 4
              tournaments into the database. This is sample data for development
              purposes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              @click="doLoadFixtures"
            >
              Load Fixtures
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog v-model:open="showReloadDialog">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reload Fixture Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all existing fixture data and reload fresh
              copies. Any changes you've made to fixture players, matches, or
              tournaments will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              @click="doLoadFixtures"
            >
              Reload Fixtures
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog v-model:open="showRemoveDialog">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Fixture Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all fixture players, teams, matches, and
              tournaments from the database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              @click="doRemoveFixtures"
            >
              Remove Fixtures
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </PageTransition>
</template>
