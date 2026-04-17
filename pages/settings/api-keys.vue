<script setup lang="ts">
import { TrashIcon, PlusIcon, TriangleAlert } from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
import ClipBoard from "~/components/ClipBoard.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import {
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";

definePageMeta({
  layout: "profile-settings",
});
</script>

<template>
  <!-- API Keys Table -->
  <PageTransition :delay="0">
    <div>
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-base font-semibold uppercase tracking-wide">
            {{ $t("pages.settings.account.api_keys_management.your_api_keys") }}
          </h3>
          <p class="text-sm text-muted-foreground mt-0.5">
            {{
              $t(
                "pages.settings.account.api_keys_management.api_keys_description",
              )
            }}
          </p>
        </div>
        <Button size="sm" @click="openAddDialog">
          <PlusIcon class="w-4 h-4 mr-2" />
          {{ $t("pages.settings.account.api_keys_management.add_api_key") }}
        </Button>
      </div>
      <CardContent>
        <Table v-if="apiKeys.length > 0">
          <TableHeader>
            <TableRow>
              <TableHead>{{
                $t("pages.settings.account.api_keys_management.label")
              }}</TableHead>
              <TableHead>{{
                $t("pages.settings.account.api_keys_management.created")
              }}</TableHead>
              <TableHead>{{
                $t("pages.settings.account.api_keys_management.last_used")
              }}</TableHead>
              <TableHead class="w-[100px]">{{
                $t("pages.settings.account.api_keys_management.actions")
              }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="apiKey in apiKeys" :key="apiKey.id">
              <TableCell class="font-medium">
                {{ apiKey.label }}
              </TableCell>
              <TableCell>
                <TimeAgo :date="apiKey.created_at" />
              </TableCell>
              <TableCell>
                <template v-if="apiKey.last_used_at">
                  <TimeAgo :date="apiKey.last_used_at" />
                </template>
                <template v-else>
                  {{ $t("pages.settings.account.api_keys_management.never") }}
                </template>
              </TableCell>
              <TableCell>
                <Button
                  variant="destructive"
                  size="sm"
                  @click="openDeleteDialog(apiKey)"
                >
                  <TrashIcon class="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </div>
  </PageTransition>

  <!-- Add API Key Dialog -->
  <Dialog v-model:open="showAddDialog">
    <DialogContent>
      <DialogHeader>
        <DialogTitle v-if="!showingNewApiKey">{{
          $t("pages.settings.account.api_keys_management.create_new_api_key")
        }}</DialogTitle>
        <DialogTitle v-else>{{
          $t("pages.settings.account.api_keys_management.copy_key_dialog.title")
        }}</DialogTitle>
        <DialogDescription v-if="!showingNewApiKey">
          {{
            $t(
              "pages.settings.account.api_keys_management.create_new_description",
            )
          }}
        </DialogDescription>
        <DialogDescription v-else>
          {{
            $t(
              "pages.settings.account.api_keys_management.copy_key_dialog.description",
            )
          }}
        </DialogDescription>
      </DialogHeader>

      <!-- Form View -->
      <template v-if="!showingNewApiKey">
        <form :form="form" @submit.prevent="addApiKey">
          <FormField v-slot="{ componentField }" name="label">
            <FormItem>
              <FormLabel>{{
                $t("pages.settings.account.api_keys_management.label")
              }}</FormLabel>
              <FormControl>
                <Input
                  v-bind="componentField"
                  :placeholder="
                    $t(
                      'pages.settings.account.api_keys_management.label_placeholder',
                    )
                  "
                />
              </FormControl>
              <FormDescription>
                {{
                  $t(
                    "pages.settings.account.api_keys_management.label_description",
                  )
                }}
              </FormDescription>
              <FormMessage />
            </FormItem>
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" @click="closeAddDialog">
              {{ $t("common.cancel") }}
            </Button>
            <Button type="submit">
              {{
                $t("pages.settings.account.api_keys_management.create_api_key")
              }}
            </Button>
          </DialogFooter>
        </form>
      </template>

      <!-- API Key Display View -->
      <template v-else>
        <div class="space-y-4">
          <div class="space-y-2">
            <label class="text-sm font-medium">{{
              $t(
                "pages.settings.account.api_keys_management.copy_key_dialog.api_key_label",
              )
            }}</label>
            <div v-if="newApiKey">
              <div class="relative">
                <div
                  class="border rounded-md p-3 pr-12 font-mono text-sm break-all bg-background"
                >
                  {{ newApiKey }}
                </div>
                <div class="absolute top-2 right-2">
                  <ClipBoard
                    :data="newApiKey"
                    class="p-2 rounded-md hover:bg-muted transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <div class="flex">
              <TriangleAlert class="w-5 h-5 text-yellow-400 mr-2 mt-0.5" />
              <div class="text-sm text-yellow-800">
                <p class="font-medium">
                  {{
                    $t(
                      "pages.settings.account.api_keys_management.copy_key_dialog.warning_title",
                    )
                  }}
                </p>
                <p>
                  {{
                    $t(
                      "pages.settings.account.api_keys_management.copy_key_dialog.warning_message",
                    )
                  }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button @click="closeAddDialog">
            {{
              $t(
                "pages.settings.account.api_keys_management.copy_key_dialog.copied_button",
              )
            }}
          </Button>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>

  <!-- Delete Confirmation Dialog -->
  <AlertDialog v-model:open="showDeleteDialog">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{
          $t(
            "pages.settings.account.api_keys_management.delete_confirmation_title",
          )
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{
            $t(
              "pages.settings.account.api_keys_management.delete_confirmation_description",
              { label: apiKeyToDelete?.label },
            )
          }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="closeDeleteDialog">{{
          $t("common.cancel")
        }}</AlertDialogCancel>
        <AlertDialogAction
          @click="deleteApiKey"
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {{
            $t(
              "pages.settings.account.api_keys_management.delete_api_key_action",
            )
          }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script lang="ts">
import { generateSubscription, generateMutation } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { z } from "zod";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { $ } from "~/generated/zeus";
import { toast } from "@/components/ui/toast";

export default {
  apollo: {
    $subscribe: {
      api_keys: {
        query: generateSubscription({
          api_keys: [
            {
              where: {
                steam_id: {
                  _eq: $("steam_id", "bigint!"),
                },
              },
              order_by: [
                {
                  created_at: "desc",
                },
              ],
            },
            {
              id: true,
              label: true,
              created_at: true,
              last_used_at: true,
            },
          ],
        }),
        variables() {
          return {
            steam_id: this.me?.steam_id,
          };
        },
        result({ data }) {
          this.apiKeys = data?.api_keys || [];
        },
      },
    },
  },
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            label: z
              .string()
              .min(1, (this as any).$t("validation.label_required"))
              .max(50, (this as any).$t("validation.label_too_long")),
          }),
        ),
      }),
      showAddDialog: false,
      showDeleteDialog: false,
      showingNewApiKey: false,
      apiKeyToDelete: null,
      newApiKey: null,
      apiKeys: [],
    };
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
  },
  methods: {
    openAddDialog() {
      this.showAddDialog = true;
      this.showingNewApiKey = false;
      this.newApiKey = null;
      this.form.resetForm();
    },
    closeAddDialog() {
      this.showAddDialog = false;
      this.showingNewApiKey = false;
      this.newApiKey = null;
      this.form.resetForm();
    },
    openDeleteDialog(apiKey: any) {
      this.apiKeyToDelete = apiKey;
      this.showDeleteDialog = true;
    },
    closeDeleteDialog() {
      this.showDeleteDialog = false;
      this.apiKeyToDelete = null;
    },
    async addApiKey() {
      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }

      try {
        const { data } = await this.$apollo.mutate({
          variables: {
            label: this.form.values.label,
          },
          mutation: generateMutation({
            createApiKey: [
              {
                label: $("label", "String!"),
              },
              {
                key: true,
              },
            ],
          }),
        });

        // Store the new API key and show clipboard content in modal
        this.newApiKey = data.createApiKey.key;
        this.showingNewApiKey = true;
      } catch (error) {
        console.error("Error creating API key:", error);
        toast({
          title: this.$t(
            "pages.settings.account.api_keys_management.error_creating",
          ),
          description: this.$t(
            "pages.settings.account.api_keys_management.error_creating_description",
          ),
          variant: "destructive",
        });
      }
    },
    async deleteApiKey() {
      if (!this.apiKeyToDelete) return;

      try {
        await this.$apollo.mutate({
          variables: {
            id: this.apiKeyToDelete.id,
          },
          mutation: generateMutation({
            delete_api_keys_by_pk: [
              {
                id: $("id", "uuid!"),
              },
              {
                id: true,
              },
            ],
          }),
        });

        toast({
          title: this.$t(
            "pages.settings.account.api_keys_management.api_key_deleted",
          ),
          description: this.$t(
            "pages.settings.account.api_keys_management.api_key_deleted_description",
          ),
        });

        this.closeDeleteDialog();
      } catch (error) {
        console.error("Error deleting API key:", error);
        toast({
          title: this.$t(
            "pages.settings.account.api_keys_management.error_deleting",
          ),
          description: this.$t(
            "pages.settings.account.api_keys_management.error_deleting_description",
          ),
          variant: "destructive",
        });
      }
    },
  },
};
</script>
