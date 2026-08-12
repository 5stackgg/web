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
import { toTypedSchema } from "~/utilities/vee-validate-zod";
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
    async updateMatchWinner() {
      // setMatchWinner takes a non-null lineup. The select only ever offers
      // the two lineups, so this is just a guard against firing before one
      // has been chosen.
      if (!this.form.values.lineup_id) {
        return;
      }

      // Goes through setMatchWinner rather than writing winning_lineup_id
      // directly: the action is what enforces organizer permission and blocks
      // a reassignment once a downstream tournament match has already been
      // played. A direct mutation skips both.
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            setMatchWinner: [
              {
                match_id: this.match.id,
                winning_lineup_id: this.form.values.lineup_id,
              },
              {
                success: true,
              },
            ],
          }),
        });
      } catch (error) {
        // Put the selector back on the winner the match actually has, so it
        // doesn't sit showing a change that was rejected.
        this.form.setFieldValue("lineup_id", this.match.winning_lineup_id);

        toast({
          title: this.$t("match.winner.set_failed"),
          description: (error as Error)?.message,
          variant: "destructive",
        });
        return;
      }

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
