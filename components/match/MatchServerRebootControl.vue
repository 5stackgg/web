<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import gql from "graphql-tag";
import { RotateCcw } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { toast } from "@/components/ui/toast";
import { e_match_status_enum } from "~/generated/zeus";

const props = defineProps<{
  match: Record<string, any>;
}>();

const { t } = useI18n();
const nuxtApp = useNuxtApp();

const rebootLoading = ref(false);
const showConfirmDialog = ref(false);
const rebootMatchServerMutation = gql`
  mutation RebootMatchServer($matchId: uuid!) {
    rebootMatchServer(match_id: $matchId) {
      success
    }
  }
`;

const rebootableStatuses = [
  e_match_status_enum.Live,
  e_match_status_enum.PickingPlayers,
  e_match_status_enum.Scheduled,
  e_match_status_enum.Veto,
  e_match_status_enum.WaitingForCheckIn,
  e_match_status_enum.WaitingForServer,
];

const canRebootMatchServer = computed(
  () =>
    props.match.is_organizer &&
    !!props.match.server_id &&
    props.match.server_type === "On Demand" &&
    rebootableStatuses.includes(props.match.status),
);

function getErrorMessage(error: any) {
  return (
    error?.graphQLErrors?.[0]?.message ||
    error?.networkError?.result?.errors?.[0]?.message ||
    error?.message ||
    t("common.error")
  );
}

async function rebootMatchServer() {
  if (rebootLoading.value) {
    return;
  }

  rebootLoading.value = true;

  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: rebootMatchServerMutation,
      variables: {
        matchId: props.match.id,
      },
    });

    toast({
      title: t("match.server.reboot_started"),
    });
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: getErrorMessage(error),
    });
  } finally {
    rebootLoading.value = false;
    showConfirmDialog.value = false;
  }
}
</script>

<template>
  <div
    v-if="canRebootMatchServer"
    class="rounded-md border border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.08)] p-4"
  >
    <div
      class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
    >
      <div class="space-y-1 min-w-0">
        <p
          class="font-mono text-[0.65rem] font-bold tracking-[0.2em] uppercase text-[hsl(var(--tac-amber))]"
        >
          {{ $t("match.server.reboot_label") }}
        </p>
        <p class="text-sm text-muted-foreground">
          {{ $t("match.server.reboot_description") }}
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        class="shrink-0"
        :disabled="rebootLoading"
        @click="showConfirmDialog = true"
      >
        <RotateCcw
          class="mr-2 h-4 w-4"
          :class="rebootLoading && 'animate-spin'"
        />
        {{
          rebootLoading
            ? $t("match.server.rebooting")
            : $t("match.server.reboot")
        }}
      </Button>
    </div>

    <AlertDialog
      :open="showConfirmDialog"
      @update:open="(open) => (showConfirmDialog = open)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ $t("match.server.reboot_confirm_title") }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("match.server.reboot_confirm_description") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="rebootLoading">
            {{ $t("common.cancel") }}
          </AlertDialogCancel>
          <AlertDialogAction
            :disabled="rebootLoading"
            @click="rebootMatchServer"
          >
            {{
              rebootLoading
                ? $t("match.server.rebooting")
                : $t("match.server.reboot")
            }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
