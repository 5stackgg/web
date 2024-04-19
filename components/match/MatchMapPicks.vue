<template>
  <Card class="sm:col-span-4">
    <CardHeader class="pb-3">
      <CardTitle>Map Veto</CardTitle>
      <CardContent>

      <form @submit.prevent="addMap">
        <FormField v-slot="{ componentField }" name="maps">
          <FormItem>
            <FormLabel>Custom Map Pool</FormLabel>
            <five-stack-map-picker
                v-model="componentField.modelValue"
                :match-type="match.type"
            ></five-stack-map-picker>
            <FormMessage />
          </FormItem>
        </FormField>


        <FormField v-slot="{ componentField }" name="picked_by">
          <FormItem>
            <FormLabel>Picked Team</FormLabel>

            <Select v-bind="componentField">
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select the team that selected the pick" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                      v-for="mapPickLineupOption in mapPickLineupOptions"
                      :key="mapPickLineupOption.value"
                      :value="mapPickLineupOption.value"
                  >
                    {{ mapPickLineupOption.display }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        </FormField>

        <Button type="submit" :disabled="Object.keys(form.errors).length > 0">
          Pick Map
        </Button>
      </form>
      </CardContent>
    </CardHeader>
  </Card>
</template>

<script lang="ts">
import * as z from "zod";
import {useForm} from "vee-validate";
import {e_sides_enum} from "~/generated/zeus";
import {Button} from "~/components/ui/button";
import {toTypedSchema} from "@vee-validate/zod";
import { generateMutation } from "~/graphql/graphqlGen";
import getMatchLineups from "~/utilities/getMatchLineups";
import FiveStackMapPicker from "~/components/forms/FiveStackMapPicker.vue";
import FiveStackSelectInput from "~/components/forms/FiveStackSelectInput.vue";
import {Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue} from "~/components/ui/select";
import {FormControl, FormField, FormItem, FormLabel, FormMessage} from "~/components/ui/form";

export default {
  components: {
    FormLabel,
    SelectGroup,
    SelectValue,
    FormItem,
    FormField,
    FormControl,
    SelectItem,
    SelectTrigger,
    Select,
    FormMessage,
    SelectContent,
    Button,
    FiveStackMapPicker,
    FiveStackSelectInput,
  },
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(
            z.object({
              maps: z.array(z.string()).min(1).max(this.match.best_of).default([]),
              picked_by: z.string()
            })
        )
      }),
    };
  },
  methods: {
    async addMap() {
      let currentMapCount = this.match.match_maps.length;

      try {
        const { maps, picked_by } = this.form.values;
        for (const map_id of maps) {
          await this.$apollo.mutate({
            mutation: generateMutation({
              insert_match_maps_one: [
                {
                  object: {
                    map_id,
                    order: ++currentMapCount,
                    match_id: this.match.id,
                    lineup_1_side: e_sides_enum.CT,
                    lineup_2_side: e_sides_enum.TERRORIST,
                  },
                },
                {
                  id: true,
                },
              ],
            }),
          });
        }
      } catch (error) {
        console.warn("unable to insert map", error);
      }

      this.form.resetForm();
    },
  },
  computed: {
    matchLineups() {
      return getMatchLineups(this.match);
    },
    mapPickLineupOptions() {
      return [
        {
          value: this.matchLineups.lineup1.id,
          display: this.matchLineups.lineup1.name,
        },
        {
          value: this.matchLineups.lineup2.id,
          display: this.matchLineups.lineup2.name,
        },
      ];
    },
  },
};
</script>
