<script setup lang="ts">
import { CaretSortIcon, CheckIcon } from "@radix-icons/vue";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <FormControl>
        <Button
          variant="outline"
          role="combobox"
          :class="
            cn(
              'w-[200px] justify-between',
              !modelValue && 'text-muted-foreground'
            )
          "
        >
          <template v-if="expectsMultiple">
            <template
              v-for="(mapId, index) of modelValue"
              v-if="modelValue.length > 0"
            >
              <template v-if="parseInt(index) != 0">,</template>
              {{
                availableMaps.find((map) => map.value === mapId)?.display ||
                "Unknown"
              }}
            </template>
            <template v-else> Select Maps </template>
          </template>
          <template v-else>
            {{ availableMaps[modelValue]?.display || "Select a Map" }}
          </template>

          <CaretSortIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </FormControl>
    </PopoverTrigger>
    <PopoverContent>
      <Command v-bind:model-value="modelValue" multiple>
        <CommandInput placeholder="Search Maps..." />
        <CommandEmpty>No framework found.</CommandEmpty>
        <CommandList>
          <CommandGroup>
            <CommandItem
              v-for="availableMap in availableMaps"
              :key="availableMap.value"
              :value="availableMap.value"
            >
              <CheckIcon
                :class="
                  cn(
                    'mr-2 h-4 w-4',
                    (
                      expectsMultiple
                        ? modelValue.includes(availableMap.value)
                        : modelValue === availableMap
                    )
                      ? 'opacity-100'
                      : 'opacity-0'
                  )
                "
              />
              {{ availableMap.display }}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>

<script lang="ts">
import { mapFields } from "~/graphql/mapGraphql";
import { generateQuery } from "~/graphql/graphqlGen";
import { e_match_types_enum } from "~/generated/zeus";

export default {
  props: {
    matchType: {
      type: String,
      required: true,
    },
    modelValue: {
      type: [String, Number, Array],
      default: "",
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  apollo: {
    maps: {
      query: generateQuery({
        maps: [{}, mapFields],
      }),
    },
  },
  computed: {
    expectsMultiple() {
      return Array.isArray(this.modelValue);
    },
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
              return map.type === e_match_types_enum.Competitive;
            case e_match_types_enum.Wingman:
              return map.type === e_match_types_enum.Wingman;
          }
        })
        .map((map) => {
          return {
            value: map.id,
            display: map.name,
          };
        });
    },
  },
};
</script>
