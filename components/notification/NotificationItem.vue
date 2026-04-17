<script setup lang="ts">
import { computed } from "vue";
import { Trash2 } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import TimeAgo from "~/components/TimeAgo.vue";
import NotificationContext from "~/components/notification/NotificationContext.vue";

type NotificationAction = {
  label: string;
  graphql: {
    type: string;
    action: string;
    selection: Record<string, any>;
    variables?: Record<string, any>;
  };
};

type NotificationItemProps = {
  notification: {
    id: string;
    title: string;
    message: string;
    type: string;
    entity_id?: string | null;
    is_read: boolean;
    deletable?: boolean;
    created_at: string;
    actions?: NotificationAction[];
  };
  variant?: "sheet" | "hub";
  showContext?: boolean;
};

const props = withDefaults(defineProps<NotificationItemProps>(), {
  variant: "hub",
  showContext: true,
});

const emit = defineEmits<{
  (e: "dismiss", id: string): void;
  (e: "delete", id: string): void;
  (
    e: "action",
    notification: NotificationItemProps["notification"],
    action: NotificationAction,
  ): void;
}>();

const wrapperClass = computed(() =>
  props.variant === "sheet"
    ? "mb-4 p-4 rounded-lg shadow-md relative"
    : "mb-3 p-3 rounded-md border border-border bg-card/40 relative",
);
</script>

<template>
  <div :class="wrapperClass">
    <Button
      v-if="notification.deletable !== false"
      size="icon"
      variant="ghost"
      @click="emit('delete', notification.id)"
      class="absolute top-2 right-2"
    >
      <Trash2 class="h-4 w-4" />
      <span class="sr-only">{{ $t("common.delete") }}</span>
    </Button>
    <h3
      :class="[
        'text-lg font-semibold mb-2',
        notification.is_read ? 'text-muted-foreground' : '',
      ]"
    >
      {{ notification.title }}
    </h3>

    <template v-if="notification.type !== 'NameChangeRequest'">
      <p
        class="[&_a]:text-blue-500 [&_a]:underline [&_a:hover]:text-blue-700"
        :class="[
          'text-sm mb-2',
          notification.is_read
            ? 'text-muted-foreground/70'
            : 'text-muted-foreground',
        ]"
        v-html="notification.message"
      />
    </template>
    <template v-else>
      <p
        class="[&_a]:text-blue-500 [&_a]:underline [&_a:hover]:text-blue-700"
        :class="[
          'text-sm mb-2',
          notification.is_read
            ? 'text-muted-foreground/70'
            : 'text-muted-foreground',
        ]"
      >
        {{ notification.message }}
      </p>
    </template>

    <NotificationContext
      v-if="showContext && notification.entity_id"
      :type="notification.type"
      :entity-id="notification.entity_id"
      class="mb-2"
    />

    <div class="flex justify-between items-center">
      <span
        :class="[
          'text-xs',
          notification.is_read
            ? 'text-muted-foreground/50'
            : 'text-muted-foreground',
        ]"
      >
        <TimeAgo :date="notification.created_at" />
      </span>
      <template v-if="notification.actions">
        <div class="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            @click="emit('action', notification, action)"
            :key="index"
            v-for="(action, index) of notification.actions"
          >
            {{ action.label }}
          </Button>
        </div>
      </template>
      <template v-else>
        <Button
          size="sm"
          variant="outline"
          @click="emit('dismiss', notification.id)"
          v-if="!notification.is_read && notification.deletable !== false"
        >
          {{ $t("layouts.notifications.dismiss") }}
        </Button>
      </template>
    </div>
  </div>
</template>
