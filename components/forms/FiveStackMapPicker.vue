<template>
  <five-stack-select-input
    :disabled="availableMaps.length === 0"
    label="Maps"
    :options="availableMaps"
    :modelValue="modelValue"
    @update:modelValue="updateModelValue"
    :multiple="best_of > 1"
  ></five-stack-select-input>
</template>

<script lang="ts">
import { mapFields } from "~/graphql/mapGraphql";
import { generateQuery } from "~/graphql/graphqlGen";
import { e_match_types_enum } from "~/generated/zeus";
import FiveStackSelectInput from "~/components/forms/FiveStackSelectInput.vue";

export default {
  emits: ["update:modelValue"],
  components: {
    FiveStackSelectInput,
  },
  props: {
    best_of: {
      type: [Number, String],
      required: true,
    },
    matchType: {
      type: String,
      required: true,
    },
    modelValue: {
      type: [String, Number, Array],
      default: "",
    },
  },
  apollo: {
    maps: {
      query: generateQuery({
        maps: [{}, mapFields],
      }),
    },
  },
  methods: {
    updateModelValue(value) {
      this.$emit("update:modelValue", value);
    },
  },
  computed: {
    availableMaps() {
      if (!this.maps) {
        return [];
      }
      return this.maps
        .filter((map) => {
          switch (this.matchType) {
            case e_match_types_enum.Competitive:
              return (
                map.type === e_match_types_enum.Competitive &&
                map.active_pool === true
              );
            case e_match_types_enum.Scrimmage:
              return (
                map.type === e_match_types_enum.Competitive &&
                map.active_pool === true
              );
            case e_match_types_enum.Wingman:
              return map.type === e_match_types_enum.Wingman;
          }
        })
        .map((map) => {
          return map.name;
        });
    },
  },
};
</script>
