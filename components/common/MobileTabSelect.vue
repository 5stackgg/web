<script setup lang="ts">
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

// Phone stand-in for a tab strip too wide to fit: the same tabs as a select.
// Pair it with the TabsList wrapped in `max-md:hidden`.
defineProps<{
  items: Array<{ value: string; label: string }>;
  label?: string;
}>();

const model = defineModel<string>({ required: true });
</script>

<template>
  <div class="md:hidden">
    <Select v-model="model">
      <SelectTrigger class="w-full" :aria-label="label">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="item in items" :key="item.value" :value="item.value">
          {{ item.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </div>
</template>
