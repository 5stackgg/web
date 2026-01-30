<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create New Directory</DialogTitle>
        <DialogDescription>
          Enter a name for the new directory
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div class="space-y-2">
          <Label for="dir-name">Directory Name</Label>
          <Input
            id="dir-name"
            ref="inputRef"
            v-model="dirName"
            placeholder="my-directory"
            @keyup.enter="handleCreate"
          />
        </div>

        <Alert v-if="store.error" variant="destructive">
          <AlertTriangle class="w-4 h-4" />
          <AlertDescription>{{ store.error }}</AlertDescription>
        </Alert>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="handleCancel"> Cancel </Button>
        <Button @click="handleCreate" :disabled="!dirName || store.isLoading">
          Create
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const store = useFileManagerStore();
const dirName = ref("");
const inputRef = ref<InstanceType<typeof Input> | null>(null);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      dirName.value = "";
      store.clearError();
    } else {
      nextTick(() => {
        inputRef.value?.$el?.focus();
      });
    }
  },
);

async function handleCreate() {
  if (!dirName.value) return;

  try {
    await store.createDirectory(dirName.value);
    emit("update:open", false);
  } catch (error) {
    // Error handled by store
  }
}

function handleCancel() {
  emit("update:open", false);
}
</script>
