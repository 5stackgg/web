<script setup lang="ts">
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { FormControl, FormField, FormItem } from "~/components/ui/form";
</script>

<template>
  <form @submit.prevent="updateCreateServer" class="grid gap-4">
    <FormField v-slot="{ componentField }" name="label">
      <FormItem>
        <FormLabel>{{ $t("server.form.label") }}</FormLabel>
        <FormControl>
          <Input v-bind="componentField" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="host">
      <FormItem>
        <FormLabel>{{ $t("server.form.host") }}</FormLabel>
        <FormControl>
          <Input v-bind="componentField" />
          <FormMessage />
        </FormControl>
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="region">
      <FormItem>
        <FormLabel class="text-lg font-semibold">{{
          $t("server.form.region")
        }}</FormLabel>
        <Select v-bind="componentField">
          <FormControl>
            <SelectTrigger>
              <SelectValue :placeholder="$t('server.form.select_region')" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectGroup>
              <SelectItem
                :value="region.value"
                v-for="region in server_regions"
                :key="region.value"
              >
                {{ region.description }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="rcon_password">
      <FormItem>
        <FormLabel>{{ $t("server.form.rcon_password") }}</FormLabel>
        <FormControl>
          <Input type="password" v-bind="componentField" />
          <FormMessage />
          <FormDescription v-if="server">
            {{ $t("server.form.rcon_password_description") }}
          </FormDescription>
        </FormControl>
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="port">
      <FormItem>
        <FormLabel>{{ $t("server.form.port") }}</FormLabel>
        <FormControl>
          <Input type="number" v-bind="componentField" />
          <FormMessage />
        </FormControl>
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="tv_port">
      <FormItem>
        <FormLabel>{{ $t("server.form.tv_port") }}</FormLabel>
        <FormControl>
          <Input type="number" v-bind="componentField" />
          <FormMessage />
        </FormControl>
      </FormItem>
    </FormField>

    <Button type="submit" :disabled="Object.keys(form.errors).length > 0">
      <template v-if="server">{{ $t("server.form.update") }}</template>
      <template v-else>{{ $t("server.form.create") }}</template>
    </Button>
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";

export default {
  emits: ["updated"],
  props: {
    server: {
      type: Object,
      required: false,
    },
  },
  apollo: {
    server_regions: {
      query: generateQuery({
        server_regions: [
          {},
          {
            value: true,
            description: true,
          },
        ],
      }),
    },
  },
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            host: z
              .string()
              .ip({ version: "v4" })
              .or(
                z
                  .string()
                  .regex(/^(?!:\/\/)(?:[-A-Za-z0-9]+\.)+[A-Za-z]{2,6}$/),
              ),
            label: z.string().min(3),
            region: z.string(),
            port: z.number().min(2).max(65535),
            tv_port: z.number().min(2).max(65535),
            rcon_password: this.server
              ? z.string().min(1).optional()
              : z.string().min(1),
          }),
        ),
      }),
    };
  },
  watch: {
    server: {
      immediate: true,
      handler(server) {
        if (server) {
          const { host, label, port, tv_port, region } = server;
          this.form.setValues({
            host,
            label,
            port,
            region,
            tv_port,
          });
          return;
        }
      },
    },
  },
  methods: {
    async updateCreateServer() {
      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }

      if (this.server) {
        await this.$apollo.mutate({
          mutation: generateMutation({
            update_servers_by_pk: [
              {
                pk_columns: {
                  id: this.server.id,
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

      const { data } = await this.$apollo.mutate({
        mutation: generateMutation({
          insert_servers_one: [
            {
              object: this.form.values,
            },
            {
              id: true,
            },
          ],
        }),
      });

      this.$router.push(`/dedicated-servers/${data.insert_servers_one.id}`);
    },
  },
};
</script>
