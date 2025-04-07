<script setup lang="ts">
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { FormControl, FormField, FormItem } from "~/components/ui/form";
</script>

<template>
  <form @submit.prevent="updateCreateRegion" class="grid gap-4">
    <FormField v-slot="{ componentField }" name="value">
      <FormItem>
        <FormLabel>{{ $t("region.form.name") }}</FormLabel>
        <FormControl>
          <Input v-bind="componentField" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="description">
      <FormItem>
        <FormLabel>{{ $t("region.form.description") }}</FormLabel>
        <FormControl>
          <Input v-bind="componentField" />
          <FormMessage />
        </FormControl>
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="is_lan">
      <FormItem>
        <FormLabel>{{ $t("region.form.use_lan") }}</FormLabel>
        <FormControl>
          <Switch v-bind="componentField" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <Button type="submit" :disabled="Object.keys(form.errors).length > 0">
      <template v-if="region">{{ $t("region.form.update") }}</template>
      <template v-else>{{ $t("region.form.create") }}</template>
    </Button>
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  emits: ["updated"],
  props: {
    region: {
      type: Object,
      required: false,
    },
  },
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            value: z.string(),
            description: z.string().optional(),
            is_lan: z.boolean().optional(),
          }),
        ),
      }),
    };
  },
  watch: {
    region: {
      immediate: true,
      handler(region) {
        if (region) {
          const { value, description, is_lan } = region;
          this.form.setValues({
            value,
            description,
            is_lan,
          });
          return;
        }
      },
    },
  },
  methods: {
    async updateCreateRegion() {
      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }

      if (this.region) {
        await this.$apollo.mutate({
          mutation: generateMutation({
            update_server_regions_by_pk: [
              {
                pk_columns: {
                  value: this.region.value,
                },
                _set: this.form.values,
              },
              {
                __typename: true,
              },
            ],
          }),
        });
        this.$emit("updated");
        return;
      }

      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_server_regions_one: [
            {
              object: this.form.values,
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      this.$emit("updated");
    },
  },
};
</script>
