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
        <FormLabel>Assign Match Server</FormLabel>
        <Select v-bind="componentField" @update:modelValue="updateMatchServer">
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder="Select an server" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Dedicated Servers</SelectLabel>
              <SelectItem
                v-for="server in availableServers"
                :key="server.value"
                :value="server.value"
              >
                {{ server.display }}
              </SelectItem>
            </SelectGroup>

            <SelectGroup>
              <SelectLabel>On Demand</SelectLabel>
              <SelectItem
                v-for="region in regions"
                :key="region.value"
                :value="`0:${region.value}`"
              >
                {{ region.description }}
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
import { toast } from "@/components/ui/toast";

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
            {
              where: {
                is_dedicated: {
                  _eq: true,
                },
              },
            },
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
      e_server_regions: {
        query: typedGql("subscription")({
          e_server_regions: [
            {
              where: {
                total_server_count: {
                  _gt: 0,
                },
              },
            },
            {
              value: true,
              description: true,
            },
          ],
        }),
        result({ data }) {
          this.regions = data.e_server_regions;
        },
      },
    },
  },
  data() {
    return {
      servers: [],
      regions: [],
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            region: z.string(),
            server_id: z.string(),
          }),
        ),
      }),
    };
  },
  watch: {
    match: {
      immediate: true,
      handler(match) {
        if (match) {
          let server_id = match.server_id;

          if (!server_id || match.server_type === "On Demand") {
            server_id = `${match.region ? `0:${match.region}` : "0"}`;
          }

          this.form.setValues({
            server_id,
          });
        }
      },
    },
  },
  methods: {
    async updateMatchServer() {
      const [serverId, region] = this.form.values.server_id?.split(":");

      await this.$apollo.mutate({
        mutation: generateMutation({
          update_matches_by_pk: [
            {
              pk_columns: {
                id: this.match.id,
              },
              _set: {
                region,
                server_id: serverId === "0" ? null : this.form.values.server_id,
              },
            },
            {
              id: true,
            },
          ],
        }),
      });

      toast({
        title: "Assgined Match Server",
      });
    },
  },
  computed: {
    availableServers() {
      return this.servers.map((server) => {
        return {
          value: server.id,
          display: `${server.label} (${server.host}:${server.port})`,
        };
      });
    },
  },
};
</script>
