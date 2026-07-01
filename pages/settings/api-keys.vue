<script setup lang="ts">
import {
  TrashIcon,
  PlusIcon,
  TriangleAlert,
  ExternalLink,
} from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
import ClipBoard from "~/components/ClipBoard.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
</script>

<template>
  <!-- API Keys -->
  <PageTransition :delay="0">
    <div class="space-y-5">
      <!-- Section header -->
      <div class="flex items-start justify-between gap-4">
        <p class="max-w-prose text-sm text-muted-foreground">
          {{ $t("pages.settings.account.api_keys_management.description") }}
          <a
            href="https://docs.5stack.gg/advanced/api"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1 font-medium text-[hsl(var(--tac-amber))] underline-offset-2 hover:underline"
          >
            {{ $t("pages.settings.account.api_keys_management.view_docs") }}
            <ExternalLink class="h-3.5 w-3.5" />
          </a>
        </p>
        <Button
          v-if="loaded && apiKeys.length > 0"
          variant="tactical"
          size="sm"
          class="shrink-0"
          @click="openAddDialog"
        >
          <PlusIcon class="h-4 w-4" />
          {{ $t("pages.settings.account.api_keys_management.add_api_key") }}
        </Button>
      </div>

      <!-- Loading skeleton -->
      <div v-if="!loaded" class="space-y-3">
        <div
          v-for="n in 3"
          :key="n"
          class="flex items-center gap-4 rounded-lg border border-border/60 bg-card/40 p-4"
        >
          <div class="min-w-0 flex-1 space-y-2">
            <div class="h-4 w-40 animate-pulse rounded bg-muted" />
            <div class="h-3 w-56 animate-pulse rounded bg-muted/60" />
          </div>
          <div class="h-8 w-8 shrink-0 animate-pulse rounded bg-muted" />
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="apiKeys.length === 0"
        class="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border/60 bg-card/20 py-14 text-center"
      >
        <div class="space-y-1">
          <p class="text-sm font-medium">
            {{ $t("pages.settings.account.api_keys_management.no_api_keys") }}
          </p>
          <p class="mx-auto max-w-sm text-xs text-muted-foreground">
            {{
              $t("pages.settings.account.api_keys_management.no_api_keys_hint")
            }}
          </p>
        </div>
        <Button variant="tactical" size="sm" @click="openAddDialog">
          <PlusIcon class="h-4 w-4" />
          {{
            $t("pages.settings.account.api_keys_management.add_first_api_key")
          }}
        </Button>
      </div>

      <!-- Key list -->
      <div v-else class="space-y-3">
        <div
          v-for="apiKey in apiKeys"
          :key="apiKey.id"
          class="group flex items-center gap-4 rounded-lg border border-border/60 bg-card/40 p-4 transition-colors hover:border-[hsl(var(--tac-amber))]/40"
        >
          <div class="min-w-0 flex-1">
            <div class="truncate font-medium">{{ apiKey.label }}</div>
            <div
              class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground"
            >
              <span class="inline-flex items-center gap-1.5">
                <span
                  class="text-[10px] uppercase tracking-widest text-muted-foreground/60"
                >
                  {{ $t("pages.settings.account.api_keys_management.created") }}
                </span>
                <TimeAgo :date="apiKey.created_at" />
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span
                  class="text-[10px] uppercase tracking-widest text-muted-foreground/60"
                >
                  {{
                    $t("pages.settings.account.api_keys_management.last_used")
                  }}
                </span>
                <TimeAgo v-if="apiKey.last_used_at" :date="apiKey.last_used_at" />
                <span v-else class="italic text-muted-foreground/70">
                  {{ $t("pages.settings.account.api_keys_management.never") }}
                </span>
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            class="shrink-0 text-muted-foreground opacity-70 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            :aria-label="
              $t(
                'pages.settings.account.api_keys_management.delete_api_key_action',
              )
            "
            @click="openDeleteDialog(apiKey)"
          >
            <TrashIcon class="h-4 w-4" />
          </Button>
        </div>
      </div>
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
            <Button type="submit" variant="tactical" :loading="submitting">
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

          <div
            class="flex gap-2.5 rounded-md border border-[hsl(var(--tac-amber))]/30 bg-[hsl(var(--tac-amber))]/5 p-3"
          >
            <TriangleAlert
              class="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--tac-amber))]"
            />
            <div class="space-y-0.5 text-sm">
              <p class="font-medium text-foreground">
                {{
                  $t(
                    "pages.settings.account.api_keys_management.copy_key_dialog.warning_title",
                  )
                }}
              </p>
              <p class="text-muted-foreground">
                {{
                  $t(
                    "pages.settings.account.api_keys_management.copy_key_dialog.warning_message",
                  )
                }}
              </p>
            </div>
          </div>

          <p class="text-sm text-muted-foreground">
            {{
              $t(
                "pages.settings.account.api_keys_management.copy_key_dialog.docs_hint",
              )
            }}
            <a
              href="https://docs.5stack.gg/advanced/api"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1 font-medium text-[hsl(var(--tac-amber))] underline-offset-2 hover:underline"
            >
              {{
                $t(
                  "pages.settings.account.api_keys_management.copy_key_dialog.docs_link",
                )
              }}
              <ExternalLink class="h-3.5 w-3.5" />
            </a>
          </p>
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
          this.loaded = true;
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
              .min(1, this.$t("validation.label_required"))
              .max(50, this.$t("validation.label_too_long")),
          }),
        ),
      }),
      submitting: false,
      showAddDialog: false,
      showDeleteDialog: false,
      showingNewApiKey: false,
      apiKeyToDelete: null,
      newApiKey: null,
      apiKeys: [],
      loaded: false,
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
      if (this.submitting) {
        return;
      }

      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }

      this.submitting = true;
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
      } finally {
        this.submitting = false;
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
