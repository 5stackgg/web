<script setup lang="ts">
import { computed } from "vue";
import { Eye } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

/**
 * View counter for a news post. The count only exists on the admin queries
 * (newsPostsAdmin / newsPostAdmin), so every call site is already gated on
 * `canPostNews` — this is chrome for authors, not readers.
 */
const props = defineProps<{
  count?: string | number | null;
}>();

const formatted = computed(() => Number(props.count || 0).toLocaleString());
</script>

<template>
  <FiveStackToolTip as-child :delay-duration="120">
    <template #trigger>
      <span
        class="inline-flex items-center gap-1 text-xs text-muted-foreground"
      >
        <Eye class="h-3.5 w-3.5" />
        {{ formatted }}
      </span>
    </template>
    {{ $t("pages.news.manage.views") }}
  </FiveStackToolTip>
</template>
