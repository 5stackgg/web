<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import {FormField, FormItem, FormLabel, FormMessage} from "~/components/ui/form";
import {CaretSortIcon} from "@radix-icons/vue";
</script>

<template>
  <div v-if="tournament">
    <form class="space-y-8">
      <FormField v-slot="{ componentField }" name="serverIds">
        <FormItem>
          <FormLabel>Assign Match Servers</FormLabel>
          <Popover>
            <PopoverTrigger as-child>
              <Button
                  variant="outline"
                  role="combobox"
                  class="w-[200px] justify-between"
              >
                <template v-if="componentField.modelValue.length > 0">
                  Selected {{ componentField.modelValue.length}} servers
                </template>
                <template v-else>
                  Servers
                </template>
                <CaretSortIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-[200px] p-0">
              <Command>
                <CommandInput class="h-9" placeholder="Search framework..." />
                <CommandEmpty>No framework found.</CommandEmpty>
                <CommandList>
                  <CommandGroup>
                    <CommandItem
                        v-for="server in servers"
                        :key="server.value"
                        :value="server.value"
                        @select="updateServerList(server.value)"
                    >
                      {{ server.display }}
                      <Check v-if="form.values.serverIds.includes(server.value)"></Check>
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
  </div>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import {useForm} from "vee-validate";
import {toTypedSchema} from "@vee-validate/zod";
import * as z from "zod";
import {typedGql} from "~/generated/zeus/typedDocumentNode";

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
        validationSchema: toTypedSchema(
            z.string().array().default([]),
        ),
      }),
    }
  },
  watch: {
    tournament: {
      immediate: true,
      handler(tournament) {
        this.form.setFieldValue('serverIds', tournament?.servers.map((server) => server.server_id ) || [])
      }
    }
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
                    _eq: serverId
                  },
                  tournament_id: {
                    _eq: this.$route.params.tournamentId
                  },
                }
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
                __typename: true
              },
            ],
          }),
        });
      }
    },
  },
};
</script>
