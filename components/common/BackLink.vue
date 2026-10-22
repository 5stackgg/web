<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";
import {
  useBackToList,
  useTopBarBackShown,
} from "~/composables/useHistoryBack";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ to: RouteLocationRaw }>();

const stepBackTo = useBackToList();
const topBarBack = useTopBarBackShown();

function onClick(event: MouseEvent, navigate: (event?: MouseEvent) => unknown) {
  const plain =
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey;

  if (plain && !event.defaultPrevented && stepBackTo(props.to)) {
    event.preventDefault();
    return;
  }

  navigate(event);
}
</script>

<template>
  <NuxtLink v-if="!topBarBack" v-slot="{ href, navigate }" :to="to" custom>
    <a :href="href" v-bind="$attrs" @click="onClick($event, navigate)">
      <slot />
    </a>
  </NuxtLink>
</template>
