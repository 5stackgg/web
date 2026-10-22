<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { ArrowLeft } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { useTopBarBack } from "~/composables/useHistoryBack";
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();

const { canGoBack, back } = useTopBarBack();
</script>

<template>
  <PageTransition swap :appear="false">
    <Button
      v-if="canGoBack"
      variant="ghost"
      size="icon-lg"
      :class="cn('shrink-0 [&_svg]:size-5', props.class)"
      :aria-label="$t('common.back')"
      :title="$t('common.back')"
      @click="back"
    >
      <ArrowLeft />
    </Button>
  </PageTransition>
</template>
