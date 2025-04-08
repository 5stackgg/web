<script setup lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";
import { e_match_types_enum } from "~/generated/zeus";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash } from "lucide-vue-next";
import ViewOnSteam from "~/components/map-pools/ViewOnSteam.vue";
</script>

<template>
  <form @submit.prevent="submitForm" class="space-y-4">
    <FormField name="name" v-slot="{ componentField }">
      <FormItem>
        <FormLabel for="name">{{ $t("pages.map_pools.form.name") }}</FormLabel>
        <FormControl>
          <Input
            v-bind="componentField"
            type="text"
            id="name"
            name="name"
            required
          />
        </FormControl>
      </FormItem>
    </FormField>
    <FormField name="poster" v-slot="{ componentField }">
      <FormItem>
        <FormLabel for="poster">{{
          $t("pages.map_pools.form.poster")
        }}</FormLabel>
        <FormControl>
          <Input
            v-bind="componentField"
            type="text"
            id="poster"
            name="poster"
            :placeholder="$t('pages.map_pools.form.poster_placeholder')"
          />
        </FormControl>
      </FormItem>
    </FormField>
    <FormField name="patch" v-slot="{ componentField }">
      <FormItem>
        <FormLabel for="patch">{{
          $t("pages.map_pools.form.patch")
        }}</FormLabel>
        <FormControl>
          <Input
            v-bind="componentField"
            type="text"
            id="patch"
            name="patch"
            :placeholder="$t('pages.map_pools.form.patch_placeholder')"
          />
        </FormControl>
      </FormItem>
    </FormField>
    <FormField name="workshop_map_id" v-slot="{ componentField }">
      <FormItem>
        <FormLabel for="workshop_map_id">{{
          $t("pages.map_pools.form.workshop_map_id")
        }}</FormLabel>
        <FormControl>
          <Input
            v-bind="componentField"
            type="text"
            id="workshop_map_id"
            name="workshop_map_id"
          />
          <template v-if="form.values.workshop_map_id">
            <ViewOnSteam :workshop_map_id="form.values.workshop_map_id" />
          </template>
        </FormControl>
      </FormItem>
    </FormField>
    <div class="flex justify-between items-center">
      <Button type="submit">{{
        map
          ? $t("pages.map_pools.form.update_map")
          : $t("pages.map_pools.form.create_map")
      }}</Button>
      <AlertDialog v-if="map">
        <AlertDialogTrigger asChild>
          <Button variant="destructive" type="button">
            <Trash class="mr-2 h-4 w-4" />
            {{ $t("pages.map_pools.form.delete_map") }}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{{
              $t("pages.map_pools.form.delete_confirm.title")
            }}</AlertDialogTitle>
            <AlertDialogDescription>
              {{ $t("pages.map_pools.form.delete_confirm.description") }}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{{
              $t("pages.map_pools.form.delete_confirm.cancel")
            }}</AlertDialogCancel>
            <AlertDialogAction @click="deleteMap" variant="destructive">
              {{ $t("pages.map_pools.form.delete_confirm.confirm") }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </form>
</template>

<script lang="ts">
export default {
  props: {
    map: {
      type: Object,
      required: false,
    },
  },
  emits: ["updated", "created", "deleted"],
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            name: z.string().min(1),
            workshop_map_id: z.string().optional(),
            poster: z.string().optional(),
            patch: z.string().optional(),
          }),
        ),
        initialValues: this.map
          ? {
              name: this.map.name,
              workshop_map_id: this.map.workshop_map_id,
              poster: this.map.poster,
              patch: this.map.patch,
            }
          : undefined,
      }),
    };
  },
  methods: {
    async submitForm() {
      const values = this.form.values;
      try {
        if (this.map) {
          // Update existing map
          await this.$apollo.mutate({
            mutation: generateMutation({
              update_maps: [
                {
                  _set: {
                    name: values.name,
                    workshop_map_id: values.workshop_map_id,
                    poster: values.poster,
                    patch: values.patch,
                  },
                  where: {
                    id: {
                      _eq: this.map.id,
                    },
                  },
                },
                {
                  affected_rows: true,
                },
              ],
            }),
          });

          toast({
            title: this.$t("pages.map_pools.form.success.update"),
          });

          this.$emit("updated");
        } else {
          await this.$apollo.mutate({
            mutation: generateMutation({
              insert_maps: [
                {
                  objects: [
                    {
                      name: values.name,
                      workshop_map_id: values.workshop_map_id,
                      poster: values.poster,
                      patch: values.patch,
                      type: e_match_types_enum.Competitive,
                      enabled: false,
                      active_pool: false,
                    },
                  ],
                },
                {
                  affected_rows: true,
                },
              ],
            }),
          });

          toast({
            title: this.$t("pages.map_pools.form.success.create"),
          });

          this.$emit("created");
        }
      } catch (error) {
        toast({
          title: this.map
            ? this.$t("pages.map_pools.form.error.update")
            : this.$t("pages.map_pools.form.error.create"),
          variant: "destructive",
        });
      }
    },
    async deleteMap() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_maps: [
            {
              where: {
                name: {
                  _eq: this.map.name,
                },
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      toast({
        title: this.$t("pages.map_pools.form.success.delete"),
      });

      this.$emit("deleted");
    },
  },
};
</script>
