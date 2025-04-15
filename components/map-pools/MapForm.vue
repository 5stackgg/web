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
import { Trash, AlertTriangle, RefreshCw } from "lucide-vue-next";
import ViewOnSteam from "~/components/map-pools/ViewOnSteam.vue";
</script>

<template>
  <form @submit.prevent="submitForm" class="space-y-4">
    <FormField name="workshop_map_id" v-slot="{ componentField }">
      <FormItem>
        <FormLabel for="workshop_map_id">{{
          $t("pages.map_pools.form.workshop_map_id")
        }}</FormLabel>
        <FormControl>
          <div class="flex gap-2">
            <Input
              v-bind="componentField"
              type="text"
              id="workshop_map_id"
              name="workshop_map_id"
            />
            <Button
              type="button"
              variant="outline"
              @click="refreshWorkshopMapDetails"
              :disabled="!form.values.workshop_map_id || isLoading"
            >
              <RefreshCw
                class="h-4 w-4 mr-2"
                :class="{ 'animate-spin': isLoading }"
              />
              {{ $t("pages.map_pools.form.refresh_workshop") }}
            </Button>
          </div>
          <template v-if="form.values.workshop_map_id">
            <ViewOnSteam :workshop_map_id="form.values.workshop_map_id" />
          </template>
        </FormControl>
      </FormItem>
    </FormField>

    <template v-show="!form.values.workshop_map_id">
      <FormField name="name" v-slot="{ componentField }">
        <FormItem>
          <FormLabel for="name">{{
            $t("pages.map_pools.form.name")
          }}</FormLabel>
          <FormControl>
            <Input
              v-bind="componentField"
              type="text"
              id="name"
              name="name"
              required
              :disabled="!!form.values.workshop_map_id"
            />
          </FormControl>
          <FormDescription class="flex items-center">
            <AlertTriangle class="w-4 h-4 mr-2 text-red-500" />
            {{ $t("pages.map_pools.form.name_description") }}
          </FormDescription>
        </FormItem>
      </FormField>
    </template>

    <FormField name="label" v-slot="{ componentField }">
      <FormItem>
        <FormLabel for="label">{{
          $t("pages.map_pools.form.label")
        }}</FormLabel>
        <FormControl>
          <Input v-bind="componentField" type="text" id="label" name="label" />
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
          <div v-if="form.values.poster" class="mt-2">
            <img
              :src="form.values.poster"
              alt="Map poster"
              class="max-w-xs rounded-md"
            />
          </div>
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
          <div v-if="form.values.patch" class="mt-2">
            <img
              :src="form.values.patch"
              alt="Map patch"
              class="max-w-xs rounded-md"
            />
          </div>
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
      verifiredMapName: false,
      isLoading: false,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            label: z.string().optional(),
            name: z.string().min(1),
            workshop_map_id: z.string().optional(),
            poster: z.string().optional(),
            patch: z.string().optional(),
          }),
        ),
        initialValues: this.map
          ? {
              name: this.map.name,
              label: this.map.label,
              workshop_map_id: this.map.workshop_map_id,
              poster: this.map.poster,
              patch: this.map.patch,
            }
          : undefined,
      }),
    };
  },
  methods: {
    async refreshWorkshopMapDetails() {
      if (!this.form.values.workshop_map_id) return;

      this.isLoading = true;
      try {
        const map = await this.getWorkshopMap(this.form.values.workshop_map_id);
        if (!map) {
          toast({
            title: this.$t("pages.map_pools.form.error.workshop_refresh"),
            variant: "destructive",
          });
          return;
        }

        this.form.setFieldValue("name", this.form.values.workshop_map_id);
        this.form.setFieldValue("label", map.title);
        this.form.setFieldValue("poster", map.preview_url);

        toast({
          title: this.$t("pages.map_pools.form.success.workshop_refresh"),
        });
      } catch (error) {
        console.error("Error refreshing workshop map details:", error);
        toast({
          title: this.$t("pages.map_pools.form.error.workshop_refresh"),
          variant: "destructive",
        });
      } finally {
        this.isLoading = false;
      }
    },
    async getWorkshopMap(workshopMapId: string): Promise<{
      name: string;
      title: string;
      preview_url: string;
    }> {
      return await $fetch<{ name: string; title: string; preview_url: string }>(
        "/api/get-workshop-map",
        {
          method: "post",
          body: {
            workshop_map_id: workshopMapId,
          },
        },
      );
    },
    async submitForm() {
      const values = this.form.values;

      // Verify workshop map if provided
      if (values.workshop_map_id) {
        const map = await this.getWorkshopMap(values.workshop_map_id);

        if (!map) {
          toast({
            title: this.$t("pages.map_pools.form.error.invalid_workshop"),
            variant: "destructive",
          });
          return;
        }
      }

      try {
        if (this.map) {
          await this.$apollo.mutate({
            mutation: generateMutation({
              update_maps: [
                {
                  _set: {
                    name: values.name,
                    label: values.label,
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
          return;
        }

        await this.$apollo.mutate({
          mutation: generateMutation({
            insert_maps: [
              {
                objects: [
                  {
                    name: values.name,
                    label: values.label,
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
