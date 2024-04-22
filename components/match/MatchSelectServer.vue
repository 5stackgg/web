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
    <FormField v-slot="{ componentField }" name="server_id">
      <FormItem>
        <FormLabel>Server</FormLabel>
        <Select v-bind="componentField" @update:modelValue="updateMatchServer">
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder="Select an server" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectGroup>
              <SelectItem
                v-for="server in availableServers"
                :key="server.value"
                :value="server.value"
              >
                {{ server.display }}
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
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  apollo: {
    $subscribe: {
      servers: {
        query: typedGql("subscription")({
          servers: [
            {},
            {
              id: true,
              host: true,
              port: true,
              label: true,
            },
          ],
        }),
        result({ data }) {
          this.servers = data.servers;
        },
      },
    },
  },
  data() {
    return {
      servers: [],
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            server_id: z.string(),
          })
        ),
      }),
    };
  },
  watch: {
    match: {
      immediate: true,
      handler(match) {
        if (match) {
          this.form.setValues({
            server_id: match.server_id || "0",
          });
        }
      },
    },
  },
  methods: {
    async updateMatchServer() {
      let serverId: string | null = this.form.values.server_id;
      if (serverId === "0") {
        serverId = null;
      }
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_matches_by_pk: [
            {
              pk_columns: {
                id: this.match.id,
              },
              _set: {
                server_id: serverId,
              },
            },
            {
              id: true,
            },
          ],
        }),
      });
    },
  },
  computed: {
    availableServers() {
      const servers = this.servers.map((server) => {
        return {
          value: server.id,
          display: `${server.label} (${server.host}:${server.port})`,
        };
      });

      servers.unshift({
        value: "0",
        display: "On Demand",
      });

      return servers;
    },
  },
};
</script>
