<script setup lang="ts">
import LastChanged from "~/components/admin/LastChanged.vue";
import {
  lastChangedId,
  lastChangedKey,
  useLastChanged,
  type LastChangedType,
} from "~/composables/useLastChanged";

// LastChanged for a live row: reads the stamp itself and again whenever one
// of the row's settings changes. Usable from Options API pages, which can't
// reach a <script setup> composable's bindings from their own methods.
const props = withDefaults(
  defineProps<{
    type: LastChangedType;
    row: Record<string, any> | null | undefined;
    dot?: boolean;
  }>(),
  { dot: false },
);

const { at, by } = useLastChanged(
  props.type,
  () => lastChangedId(props.type, props.row),
  () => lastChangedKey(props.type, props.row),
);
</script>

<template>
  <LastChanged :at="at" :by="by" :dot="dot" />
</template>
