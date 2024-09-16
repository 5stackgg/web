<script setup lang="ts">
import { Check, ChevronsUpDown } from "lucide-vue-next";

definePageMeta({
  layout: "settings",
});
</script>

<template>
  <div>
    <h3 class="text-lg font-medium">Profile</h3>
    <p class="text-sm text-muted-foreground">Your Profile Details</p>
  </div>
  <Separator />

  <form @submit.prevent="updateMe">
    <FormField name="steam_id">
      <FormItem>
        <FormLabel>Steam ID</FormLabel>
        <FormControl>
          <Input :value="me?.steam_id" readonly disabled />
        </FormControl>
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="name">
      <FormItem>
        <FormLabel>Name</FormLabel>
        <FormControl>
          <Input v-bind="componentField" />
          <FormMessage />
        </FormControl>
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="avatar_url">
      <FormItem>
        <FormLabel>Avatar URL</FormLabel>
        <FormControl>
          <Input v-bind="componentField" />
          <FormMessage />
        </FormControl>
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="country">
      <FormItem>
        <FormLabel>Country </FormLabel>
        <FormControl>
          <Popover class="w-full" v-model:open="open">
            <PopoverTrigger as-child>
              <Button
                role="combobox"
                variant="outline"
                class="w-full justify-between"
              >
                <div class="flex items-center gap-2">
                  <TimezoneFlag
                    v-if="form.values.country"
                    :country="form.values.country"
                  />
                  {{
                    form.values.country
                      ? countries[form.values.country]?.name
                      : "Select country..."
                  }}
                </div>
                <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-full p-0">
              <Command class="w-[300px]">
                <CommandInput placeholder="Search country..." />
                <CommandEmpty>No country found.</CommandEmpty>
                <CommandList>
                  <CommandGroup>
                    <CommandItem
                      v-for="country in Object.values(countries)"
                      :key="country.id"
                      :value="country.name"
                      @select="
                        () => {
                          form.setFieldValue('country', country.id);
                          open = false;
                        }
                      "
                    >
                      <div class="flex items-center gap-2 w-full">
                        <TimezoneFlag :country="country.id" />
                        <span class="truncate">{{ country.name }}</span>
                      </div>
                      <Check
                        :class="[
                          'ml-auto h-4 w-4 flex-shrink-0',
                          form.values.country === country.id
                            ? 'opacity-100'
                            : 'opacity-0',
                        ]"
                      />
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <Button type="submit" :disabled="Object.keys(form.errors).length > 0">
      Update
    </Button>
  </form>
</template>

<script lang="ts">
import { toTypedSchema } from "@vee-validate/zod";
import { useForm } from "vee-validate";
import * as z from "zod";
import { getAllCountries } from "countries-and-timezones";
import TimezoneFlag from "~/components/TimezoneFlag.vue";
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  data() {
    return {
      open: false,
      countries: getAllCountries(),
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            name: z.string().min(1),
            avatar_url: z.string().min(1),
            country: z.string().min(1),
          }),
        ),
      }),
    };
  },
  watch: {
    me: {
      immediate: true,
      handler() {
        this.form.setValues({
          name: this.me.name,
          avatar_url: this.me.avatar_url,
          country: this.me.country,
        });
      },
    },
  },
  methods: {
    async updateMe() {
      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }

      await this.$apollo.mutate({
        mutation: generateMutation({
          update_players_by_pk: [
            {
              pk_columns: {
                steam_id: this.me.steam_id,
              },
              _set: {
                name: this.form.values.name,
                avatar_url: this.form.values.avatar_url,
                country: this.form.values.country,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
  },
};
</script>
