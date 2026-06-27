<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import CreateDraftGame from "~/components/draft-games/CreateDraftGame.vue";

definePageMeta({
  middleware: ["draft-create"],
});

const route = useRoute();
const rehost = ref<any | undefined>(undefined);
const forOthers = computed(() => route.query.for === "others");

onMounted(() => {
  if (route.query.rehost) {
    try {
      const stored = localStorage.getItem("draft-games:rehost");
      if (stored) {
        rehost.value = JSON.parse(stored);
      }
    } catch {
      rehost.value = null;
    }
  }
});

const onCreated = () => {
  navigateTo("/play");
};
</script>

<template>
  <PageTransition>
    <div class="mx-auto max-w-3xl pb-24 pt-4">
      <CreateDraftGame
        :rehost="rehost"
        :for-others="forOthers"
        @created="onCreated"
      />
    </div>
  </PageTransition>
</template>
