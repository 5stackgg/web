<script lang="ts" setup>
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
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
      <FormItem>
        <FormLabel>{{ $t("match.winner.set") }}</FormLabel>
        <Select v-bind="componentField" @update:modelValue="updateMatchWinner">
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
import { toTypedSchema } from "@vee-validate/zod";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      servers: [],
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            lineup_id: z.string(),
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
    async updateMatchWinner() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_matches_by_pk: [
            {
              pk_columns: {
                id: this.match.id,
              },
              _set: {
                winning_lineup_id: this.form.values.lineup_id,
              },
            },
            {
              id: true,
            },
          ],
        }),
      });

      toast({
        title: this.$t("match.winner.set"),
      });
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
