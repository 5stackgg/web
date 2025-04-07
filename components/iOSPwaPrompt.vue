<script setup lang="ts">
import { ref } from "vue";
import { Dialog, DialogTitle, DialogDescription, DialogFooter } from "shadcn";

const isOpen = ref(false);

// Logic to trigger the dialog can be added here
</script>

<template>
  <Dialog v-model:open="isOpen" class="p-4">
    <DialogTitle>{{ $t("pwa.install.title") }}</DialogTitle>
    <DialogDescription>
      {{ $t("pwa.install.description") }}
    </DialogDescription>
    <div class="flex flex-col space-y-2">
      <p>1) {{ $t("pwa.install.step1") }}</p>
      <p>2) {{ $t("pwa.install.step2") }}</p>
    </div>
    <DialogFooter>
      <Button variant="outline" @click="isOpen = false">{{
        $t("common.cancel")
      }}</Button>
    </DialogFooter>
  </Dialog>
</template>

<script lang="ts"></script>
