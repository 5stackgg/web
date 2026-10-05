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
    <FormField v-slot="{ componentField }" name="server_id">
      <FormItem class="space-y-1.5">
        <SettingHeader>{{ $t("match.server.assign") }}</SettingHeader>
        <Select v-bind="componentField" @update:modelValue="pick">
          <FormControl>
            <SelectTrigger>
              <SelectValue :placeholder="$t('match.server.select')" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectGroup v-if="canSelectDedicatedServer">
              <SelectLabel>{{ $t("match.server.dedicated") }}</SelectLabel>
              <SelectItem
                v-for="server in availableServers"
                :key="server.value"
                :value="server.value"
              >
                {{ server.display }}
              </SelectItem>
            </SelectGroup>

            <SelectGroup>
              <SelectLabel>{{ $t("match.server.on_demand") }}</SelectLabel>
              <SelectItem
                v-for="region in regionOptions"
                :key="region.value"
                :value="region.value"
              >
                {{ region.display }}
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
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { e_server_types_enum } from "~/generated/zeus";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  // The parent confirms and assigns; this only reports the pick.
  emits: ["select"],
  apollo: {
    $subscribe: {
      servers: {
        query: typedGql("subscription")({
          servers: [
            {
              where: {
                type: {
                  _eq: e_server_types_enum.Ranked,
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
    },
  },
  data() {
    return {
      servers: [],
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
      handler() {
        this.syncFromMatch();
      },
    },
  },
  methods: {
    syncFromMatch() {
      let server_id = this.match.server_id;

      if (!server_id || this.match.server_type === "On Demand") {
        server_id = `${this.match.region ? `0:${this.match.region}` : "0"}`;
      }

      this.form.setValues({
        server_id,
      });
    },
    // Snap back to the match's real server; the pick only takes effect once
    // the parent's confirm runs.
    pick(value: string) {
      const option = [...this.availableServers, ...this.regionOptions].find(
        (option) => option.value === value,
      );
      this.$emit("select", { value, label: option?.display ?? value });
      this.syncFromMatch();
    },
  },
  computed: {
    regionOptions() {
      return useApplicationSettingsStore().availableRegions.map((region) => ({
        value: `0:${region.value}`,
        display: region.description || region.value,
      }));
    },
    canSelectDedicatedServer() {
      const { isAdmin, isMatchOrganizer, isTournamentOrganizer } =
        useAuthStore();
      return isAdmin || isMatchOrganizer || isTournamentOrganizer;
    },
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
