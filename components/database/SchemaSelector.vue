<template>
  <Popover>
    <PopoverTrigger as-child>
      <button
        type="button"
        :class="[
          filterTriggerBase,
          isDefault ? filterTriggerIdle : filterTriggerActive,
          'max-w-[220px]',
        ]"
      >
        <Layers class="h-3.5 w-3.5 shrink-0" />
        <span class="truncate normal-case tracking-normal">{{ label }}</span>
        <ChevronDown class="h-3 w-3 shrink-0 opacity-60" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="end" class="w-[240px] p-0">
      <Command>
        <CommandInput
          :placeholder="$t('pages.database.explorer.find_schema')"
        />
        <CommandEmpty>{{
          $t("pages.database.filters.no_schemas")
        }}</CommandEmpty>
        <CommandList>
          <CommandGroup>
            <CommandItem
              v-for="schema in availableSchemas"
              :key="schema"
              :value="schema"
              @select="toggleSchema(schema)"
            >
              <div class="pointer-events-none mr-2 flex items-center">
                <Checkbox :model-value="modelValue.includes(schema)" />
              </div>
              <span class="font-mono text-xs">{{ schema }}</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>

<script lang="ts">
import { ChevronDown, Layers } from "lucide-vue-next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { generateQuery } from "~/graphql/graphqlGen";
import {
  filterTriggerActive,
  filterTriggerBase,
  filterTriggerIdle,
} from "~/utilities/tacticalClasses";

// Which schemas the explorer reads. The page owns the choice and remembers
// it; every selector on the page shows and changes the same list.
export default {
  components: {
    Popover,
    PopoverContent,
    PopoverTrigger,
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    Checkbox,
    ChevronDown,
    Layers,
  },
  props: {
    modelValue: {
      type: Array as () => string[],
      required: true,
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      availableSchemas: [] as string[],
      filterTriggerActive,
      filterTriggerBase,
      filterTriggerIdle,
    };
  },
  computed: {
    isDefault(): boolean {
      return this.modelValue.length === 1 && this.modelValue[0] === "public";
    },
    label(): string {
      if (this.modelValue.length === 0) {
        return this.$t("pages.database.explorer.no_schemas");
      }
      if (this.modelValue.length === 1) {
        return this.modelValue[0];
      }
      return this.$t(
        "pages.database.explorer.schema_count",
        { count: this.modelValue.length },
        this.modelValue.length,
      );
    },
  },
  methods: {
    toggleSchema(schema: string) {
      const next = this.modelValue.includes(schema)
        ? this.modelValue.filter((s) => s !== schema)
        : [...this.modelValue, schema];
      this.$emit("update:modelValue", next);
    },
  },
  apollo: {
    availableSchemas: {
      query: generateQuery({
        getSchemas: true,
      }),
      update: (data: any) => data.getSchemas || [],
    },
  },
};
</script>
