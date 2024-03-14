<template>
  <div class="max-w-[85rem] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 mx-auto">
    <h1>Map Picks</h1>

    <div class="grid md:grid-cols-2 gap-12">
      <div
        class="flex flex-col border rounded-xl p-4 sm:p-6 lg:p-10 dark:border-gray-700"
      >
        <form @submit.prevent.stop>
          <five-stack-map-picker
            v-model="mapsForm.maps"
            :match-type="match.type"
            :best_of="match.best_of"
          ></five-stack-map-picker>
          <five-stack-select-input
            v-model="mapsForm.pickedBy"
            label="Picked By"
            :options="mapPickLineupOptions"
          ></five-stack-select-input>
          <five-stack-select-input
            v-model="mapsForm.startingSide"
            label="Starting Side"
            :options="startingSideOptions"
            :disabled="!mapsForm.pickedBy"
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
import FiveStackMapPicker from "~/components/forms/FiveStackMapPicker.vue";
import FiveStackSelectInput from "~/components/forms/FiveStackSelectInput.vue";
import getMatchLineups from "~/utilities/getMatchLineups";

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
      mapsForm: {
        maps: [],
        pickedBy: undefined,
        startingSide: e_sides_enum.CT,
      },
    };
  },
  methods: {
    async addMaps() {
      let currentMapCount = this.match.match_maps.length;
      const picked_by_lineup_id = this.mapsForm.pickedBy;
      const pickedStartingSide = this.mapsForm.startingSide;

      let lineup_1_side = e_sides_enum.CT;
      let lineup_2_side = e_sides_enum.TERRORIST;

      if (picked_by_lineup_id == this.matchLineups.lineup1.id) {
        lineup_1_side = pickedStartingSide;
        lineup_2_side =
          lineup_1_side === e_sides_enum.CT
            ? e_sides_enum.TERRORIST
            : e_sides_enum.CT;
      } else {
        lineup_2_side = pickedStartingSide;
        lineup_1_side =
          lineup_2_side === e_sides_enum.CT
            ? e_sides_enum.TERRORIST
            : e_sides_enum.CT;
      }

      try {
        for (const map of this.mapsForm.maps) {
          await this.$apollo.mutate({
            mutation: generateMutation({
              insert_match_maps_one: [
                {
                  object: {
                    map,
                    order: ++currentMapCount,
                    match_id: this.match.id,
                    picked_by_lineup_id: picked_by_lineup_id,
                    lineup_1_side,
                    lineup_2_side,
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
        this.mapsForm.maps = [];
        this.mapsForm.pickedBy = undefined;
      }
    },
  },
  computed: {
    matchLineups() {
      return getMatchLineups(this.match);
    },
    startingSideOptions() {
      return [e_sides_enum.CT, e_sides_enum.TERRORIST];
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
