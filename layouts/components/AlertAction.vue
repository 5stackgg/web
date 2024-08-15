<script lang="ts" setup>
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
</script>

<template>
  <Alert class="mt--10">
    <AlertTitle>
      {{ alert.title }}
    </AlertTitle>
    <AlertDescription>
      {{ alert.message }}
    </AlertDescription>
  </Alert>
</template>

<script lang="ts">
import alertStore from "~/stores/AlertStore";

export default {
  props: {
    alert: {
      required: true,
      type: Object,
    },
  },
  created() {
    if (this.alert.duration && this.alert.duration > 0) {
      setTimeout(() => {
        this.close();
      }, this.alert.duration);
    }
  },
  methods: {
    close() {
      alertStore().remove(this.alert);
    },
  },
};
</script>
