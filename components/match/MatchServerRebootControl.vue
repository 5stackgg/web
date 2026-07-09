<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import gql from "graphql-tag";
import { RotateCcw } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import DropdownMenuItem from "~/components/ui/dropdown-menu/DropdownMenuItem.vue";
import DropdownMenuSeparator from "~/components/ui/dropdown-menu/DropdownMenuSeparator.vue";
import { toast } from "@/components/ui/toast";
import { e_match_status_enum } from "~/generated/zeus";

const props = defineProps<{
  match: Record<string, any>;
  // "card" (default) — self-contained banner + confirm dialog.
  // "menu-item" — a destructive trigger meant to live inside the RCON console
  //   quick-commands dropdown. Emits `update:open` to drive an external dialog.
  // "dialog" — the confirm dialog only, rendered at the parent's top level so
  //   it survives the dropdown unmounting on close.
  variant?: "card" | "menu-item" | "dialog";
  open?: boolean;
}>();

const emit = defineEmits<{ "update:open": [boolean] }>();

const { t } = useI18n();
const nuxtApp = useNuxtApp();

const rebootLoading = ref(false);
const internalOpen = ref(false);

// card keeps its own open state; dialog is driven by the parent model.
const dialogOpen = computed({
  get: () => (props.variant === "dialog" ? !!props.open : internalOpen.value),
  set: (value) => {
    if (props.variant === "dialog") emit("update:open", value);
    else internalOpen.value = value;
  },
});

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
    dialogOpen.value = false;
  }
}
</script>

<template>
  <template v-if="canRebootMatchServer">
    <!-- Destructive trigger for the RCON console quick-commands dropdown. -->
    <template v-if="variant === 'menu-item'">
      <DropdownMenuSeparator />
      <DropdownMenuItem
        class="text-destructive"
        :disabled="rebootLoading"
        @click="$emit('update:open', true)"
      >
        <RotateCcw />
        {{
          rebootLoading
            ? $t("match.server.rebooting")
            : $t("match.server.reboot")
        }}
      </DropdownMenuItem>
    </template>

    <template v-else>
      <!-- Standalone banner (card variant only). -->
      <div
        v-if="variant !== 'dialog'"
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
            @click="dialogOpen = true"
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
      </div>

      <AlertDialog
        :open="dialogOpen"
        @update:open="(open) => (dialogOpen = open)"
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
            <Button
              variant="destructive"
              :disabled="rebootLoading"
              @click="rebootMatchServer"
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
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </template>
  </template>
</template>
