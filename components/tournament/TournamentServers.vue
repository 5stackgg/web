<script setup lang="ts">
import { Check } from "lucide-vue-next";
import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { CaretSortIcon } from "@radix-icons/vue";
</script>

<template>
  <Card v-if="tournament" class="p-6 w-full max-w-2xl">
    <CardHeader>
      <CardTitle>Tournament Servers</CardTitle>
      <CardDescription>Assign servers for tournament matches</CardDescription>
    </CardHeader>
    <CardContent>
      <form class="space-y-6">
        <FormField v-slot="{ componentField }" name="serverIds">
          <FormItem>
            <FormLabel class="text-lg font-semibold"
              >Assign Match Servers</FormLabel
            >
            <Popover>
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  role="combobox"
                  class="w-full justify-between text-left font-normal"
                >
                  <template v-if="componentField.modelValue.length > 0">
                    {{ componentField.modelValue.length }} server{{
                      componentField.modelValue.length > 1 ? "s" : ""
                    }}
                    selected
                  </template>
                  <template v-else>Select servers</template>
                  <CaretSortIcon class="ml-2 h-5 w-5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-[350px] p-0">
                <Command>
                  <CommandInput class="h-10" placeholder="Search servers..." />
                  <CommandEmpty>No servers found.</CommandEmpty>
                  <CommandList>
                    <CommandGroup>
                      <CommandItem
                        v-for="server in servers"
                        :key="server.value"
                        :value="server.value"
                        @select="updateServerList(server.value)"
                      >
                        <div class="flex items-center justify-between w-full">
                          <span>{{ server.display }}</span>
                          <Check
                            v-if="form.values.serverIds.includes(server.value)"
                            class="h-4 w-4 text-primary"
                          />
                        </div>
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        </FormField>
      </form>
    </CardContent>
  </Card>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import { typedGql } from "~/generated/zeus/typedDocumentNode";

export default {
  props: {
    tournament: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      servers: [],
      form: useForm({
        validationSchema: toTypedSchema(z.string().array().default([])),
      }),
    };
  },
  watch: {
    tournament: {
      immediate: true,
      handler(tournament) {
        this.form.setFieldValue(
          "serverIds",
          tournament?.servers.map((server) => server.server_id) || [],
        );
      },
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
          this.servers = data.servers.map((server) => {
            return {
              value: server.id,
              display: `${server.label} (${server.host}:${server.port})`,
            };
          });
        },
      },
    },
  },
  methods: {
    async updateServerList(serverId: number) {
      const serverIds = Object.assign([], this.form.values.serverIds);
      if (serverIds.includes(serverId)) {
        await this.$apollo.mutate({
          mutation: generateMutation({
            delete_tournament_servers: [
              {
                where: {
                  server_id: {
                    _eq: serverId,
                  },
                  tournament_id: {
                    _eq: this.$route.params.tournamentId,
                  },
                },
              },
              {
                __typename: true,
              },
            ],
          }),
        });
      } else {
        await this.$apollo.mutate({
          mutation: generateMutation({
            insert_tournament_servers_one: [
              {
                object: {
                  server_id: serverId,
                  tournament_id: this.$route.params.tournamentId,
                },
              },
              {
                __typename: true,
              },
            ],
          }),
        });
      }
    },
  },
};
</script>
