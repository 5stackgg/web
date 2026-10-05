<script lang="ts" setup>
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "~/components/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
</script>

<template>
  <form class="space-y-8">
    <FormField v-slot="{ componentField }" name="lineup_id">
      <FormItem class="space-y-1.5">
        <Select v-bind="componentField" @update:modelValue="pick">
          <FormControl>
            <SelectTrigger :aria-label="$t('match.winner.set')">
              <SelectValue :placeholder="$t('match.winner.select_lineup')" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectGroup>
              <SelectItem
                v-for="lineup in availableLineups"
                :key="lineup.value"
                :value="lineup.value"
              >
                {{ lineup.display }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    </FormField>
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  // The parent's dialog sets the winner; this only reports the pick.
  emits: ["select"],
  data() {
    return {
      servers: [],
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            lineup_id: z.string().nullable(),
          }),
        ),
      }),
    };
  },
  watch: {
    // Only a real winner change resets the pick; the match object itself is
    // replaced on every live update.
    "match.winning_lineup_id": {
      immediate: true,
      handler(winningLineupId) {
        this.form.setFieldValue("lineup_id", winningLineupId);
      },
    },
  },
  methods: {
    pick(value: string) {
      const lineup = this.availableLineups.find(
        (lineup) => lineup.value === value,
      );
      this.$emit("select", { value, label: lineup?.display ?? value });
    },
  },
  computed: {
    availableLineups() {
      return [
        {
          value: this.match.lineup_1.id,
          display: this.match.lineup_1.name,
        },
        {
          value: this.match.lineup_2.id,
          display: this.match.lineup_2.name,
        },
      ];
    },
  },
};
</script>
