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
import SettingHeader from "~/components/match/SettingHeader.vue";
</script>

<template>
  <form class="space-y-8">
    <FormField v-slot="{ componentField }" name="lineup_id">
      <FormItem class="space-y-1.5">
        <SettingHeader>{{ $t("match.winner.set") }}</SettingHeader>
        <Select v-bind="componentField" @update:modelValue="pick">
          <FormControl>
            <SelectTrigger>
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
  // The parent confirms and sets the winner; this only reports the pick.
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
    match: {
      immediate: true,
      handler() {
        this.form.setFieldValue("lineup_id", this.match.winning_lineup_id);
      },
    },
  },
  methods: {
    // Snap back to the match's real winner; the pick only takes effect once
    // the parent's confirm runs.
    pick(value: string) {
      const lineup = this.availableLineups.find(
        (lineup) => lineup.value === value,
      );
      this.$emit("select", { value, label: lineup?.display ?? value });
      this.form.setFieldValue("lineup_id", this.match.winning_lineup_id);
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
