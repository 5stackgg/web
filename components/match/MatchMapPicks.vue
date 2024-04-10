<template>
  <div class="max-w-[85rem] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 mx-auto">
    <h1>Map Picks</h1>

    <div class="grid md:grid-cols-2 gap-12">
      <div
        class="flex flex-col border rounded-xl p-4 sm:p-6 lg:p-10 dark:border-gray-700"
      >
        <form @submit.prevent.stop>
          <five-stack-map-picker
            v-model="form.maps"
            :match-type="match.type"
          ></five-stack-map-picker>
          <five-stack-select-input
            v-model="form.pickedBy"
            label="Picked By"
            :options="mapPickLineupOptions"
          ></five-stack-select-input>
          <five-stack-button @click="addMaps">Pick Maps</five-stack-button>
        </form>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { e_sides_enum } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import getMatchLineups from "~/utilities/getMatchLineups";
import FiveStackMapPicker from "~/components/forms/FiveStackMapPicker.vue";
import FiveStackSelectInput from "~/components/forms/FiveStackSelectInput.vue";

export default {
  components: {
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
      form: {
        maps: [],
        pickedBy: undefined,
      },
    };
  },
  methods: {
    async addMaps() {
      let currentMapCount = this.match.match_maps.length;

      try {
        for (const map_id of this.form.maps) {
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
      } finally {
        this.form.maps = [];
        this.form.pickedBy = undefined;
      }
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
