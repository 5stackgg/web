<script setup lang="ts">
import { Check, ChevronsUpDown } from "lucide-vue-next";
import PlayerChangeName from "~/components/PlayerChangeName.vue";
definePageMeta({
  layout: "profile-settings",
});
</script>

<template>
  <div>
    <h3 class="text-lg font-medium">
      {{ $t("pages.settings.profile.title") }}
    </h3>
    <p class="text-sm text-muted-foreground">
      {{ $t("pages.settings.profile.description") }}
    </p>
  </div>
  <Separator />

  <form @submit.prevent="updateMe" class="grid gap-4">
    <FormField v-slot="{ componentField }" name="steam_id">
      <FormItem>
        <FormLabel>{{ $t("pages.settings.profile.steam_id") }}</FormLabel>
        <FormControl>
          <Input v-bind="componentField" readonly disabled />
        </FormControl>
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="name">
      <FormItem>
        <FormLabel class="flex items-center gap-2">
          {{ $t("pages.settings.profile.name") }}
          <PlayerChangeName :player="me" />
        </FormLabel>
        <FormControl>
          <Input v-bind="componentField" readonly disabled />
          <FormMessage />
        </FormControl>
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="avatar_url">
      <FormItem>
        <FormLabel>{{ $t("pages.settings.profile.avatar_url") }}</FormLabel>
        <FormControl>
          <Input v-bind="componentField" />
          <FormMessage />
        </FormControl>
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="country">
      <FormItem>
        <FormLabel>{{ $t("pages.settings.profile.country") }}</FormLabel>

        <Popover v-model:open="open">
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
                    : $t("pages.settings.profile.select_country")
                }}
              </div>
              <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-full p-0">
            <Command class="w-[300px]">
              <CommandInput
                :placeholder="$t('pages.settings.profile.search_country')"
              />
              <CommandEmpty>{{
                $t("pages.settings.profile.no_country_found")
              }}</CommandEmpty>
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
        <FormMessage />
      </FormItem>
    </FormField>

    <div class="flex justify-start">
      <Button type="submit" :disabled="Object.keys(form.errors).length > 0">
        {{ $t("pages.settings.profile.update") }}
      </Button>
    </div>
  </form>
</template>

<script lang="ts">
import { toTypedSchema } from "@vee-validate/zod";
import { useForm } from "vee-validate";
import * as z from "zod";
import { getAllCountries } from "countries-and-timezones";
import TimezoneFlag from "~/components/TimezoneFlag.vue";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

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
          steam_id: this.me.steam_id,
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
                ...(useAuthStore().isAdmin
                  ? { avatar_url: this.form.values.avatar_url }
                  : {}),
                country: this.form.values.country,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      toast({
        title: "Updated Profile",
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
