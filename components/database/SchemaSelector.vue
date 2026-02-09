<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button variant="outline" class="justify-between w-full h-10">
        <span v-if="selectedSchemas.length === 0" class="text-muted-foreground">
          {{ $t("pages.database.filters.select_schemas") }}
        </span>
        <span v-else-if="selectedSchemas.length === 1">
          {{ selectedSchemas[0] }}
        </span>
        <span v-else>
          {{ selectedSchemas.length }}
          {{ $t("pages.database.filters.schemas_selected") }}
        </span>
        <ChevronDownIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-[200px] p-0">
      <Command>
        <CommandInput
          :placeholder="$t('pages.database.filters.search_schemas')"
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
              <div class="flex items-center pointer-events-none mr-2">
                <Checkbox :model-value="selectedSchemas.includes(schema)" />
              </div>
              {{ schema }}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>

<script lang="ts">
import { ChevronDownIcon } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
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

export default {
  components: {
    Button,
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
    ChevronDownIcon,
  },
  data() {
    return {
      availableSchemas: [] as string[],
      selectedSchemas: [] as string[],
    };
  },
  mounted() {
    // Load selected schemas from localStorage
    this.loadFromLocalStorage();

    // Emit initial value to parent
    this.$nextTick(() => {
      this.$emit("change", this.selectedSchemas);
    });

    // Listen for changes from other tabs
    window.addEventListener("storage", this.handleStorageChange);
  },
  beforeUnmount() {
    window.removeEventListener("storage", this.handleStorageChange);
  },
  methods: {
    loadFromLocalStorage() {
      const saved = localStorage.getItem("database-selected-schemas");
      if (saved) {
        try {
          this.selectedSchemas = JSON.parse(saved);
        } catch (e) {
          this.selectedSchemas = ["public"];
        }
      } else {
        this.selectedSchemas = ["public"];
        localStorage.setItem(
          "database-selected-schemas",
          JSON.stringify(this.selectedSchemas),
        );
      }
    },
    handleStorageChange(event: StorageEvent) {
      if (event.key === "database-selected-schemas" && event.newValue) {
        try {
          this.selectedSchemas = JSON.parse(event.newValue);
          this.$emit("change", this.selectedSchemas);
        } catch (e) {
          // Invalid JSON, ignore
        }
      }
    },
    toggleSchema(schema: string) {
      const index = this.selectedSchemas.indexOf(schema);
      if (index > -1) {
        this.selectedSchemas.splice(index, 1);
      } else {
        this.selectedSchemas.push(schema);
      }
      // Save to localStorage
      localStorage.setItem(
        "database-selected-schemas",
        JSON.stringify(this.selectedSchemas),
      );
      // Emit change event
      this.$emit("change", this.selectedSchemas);
    },
  },
  apollo: {
    availableSchemas: {
      query: generateQuery({
        getSchemas: true,
      }),
      update: (data: any) => data.getSchemas || [],
      pollInterval: 0, // Only fetch once
    },
  },
};
</script>
