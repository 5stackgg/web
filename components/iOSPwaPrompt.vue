<script setup lang="ts">
import { ref } from "vue";
import { Dialog, DialogTitle, DialogDescription, DialogFooter } from "shadcn";

const isOpen = ref(false);

// Logic to trigger the dialog can be added here
</script>

<template>
  <Dialog v-model:open="isOpen" class="p-4">
    <DialogTitle>Add to Home Screen</DialogTitle>
    <DialogDescription>
      This website has app functionality. Add it to your home screen to use it
      in fullscreen and while offline.
    </DialogDescription>
    <div class="flex flex-col space-y-2">
      <p>1) Press the 'Share' button</p>
      <p>2) Press 'Add to Home Screen'</p>
    </div>
    <DialogFooter>
      <Button variant="outline" @click="isOpen = false">Cancel</Button>
    </DialogFooter>
  </Dialog>
</template>

<script lang="ts"></script>
