<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { e_player_roles_enum } from "~/generated/zeus";

definePageMeta({
  middleware: "auth",
});

const authStore = useAuthStore();

const canAccess = computed(() =>
  authStore.isRoleAbove(e_player_roles_enum.match_organizer),
);
</script>

<template>
  <PageTransition :delay="0">
    <div class="flex flex-col h-[calc(100vh-4rem)] p-4 gap-4">
      <h1 class="text-2xl font-bold">
        {{ $t("chat.organizers.title", "Organizer Chat") }}
      </h1>

      <div v-if="!canAccess" class="text-sm text-destructive">
        {{
          $t(
            "chat.organizers.no_access",
            "You do not have access to this page.",
          )
        }}
      </div>

      <div
        v-else
        class="flex-1 flex items-center justify-center text-sm text-muted-foreground"
      >
        {{
          $t(
            "chat.organizers.sidebar_hint",
            "Chat is available in the right sidebar under the Chats tab.",
          )
        }}
      </div>
    </div>
  </PageTransition>
</template>
