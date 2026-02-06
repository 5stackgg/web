<script setup lang="ts">
import { Button } from "~/components/ui/button";
import ClipBoard from "~/components/ClipBoard.vue";
import { Alert, AlertTitle, AlertDescription } from "~/components/ui/alert";
import { Info, Loader2, Check } from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
</script>

<template>
  <Dialog :open="open" @update:open="handleUpdateOpen">
    <DialogContent class="max-w-2xl" v-if="createdNode">
      <DialogHeader>
        <DialogTitle>{{
          $t("pages.game_server_nodes.setup_dialog.title")
        }}</DialogTitle>
        <DialogDescription>
          {{ $t("pages.game_server_nodes.setup_dialog.description") }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <!-- Installation script -->
        <div
          v-if="setupGameServer"
          class="relative bg-gray-900 rounded-lg p-4"
        >
          <div class="flex justify-between items-start mb-2">
            <h3 class="text-white text-sm font-semibold">
              {{ $t("pages.game_server_nodes.setup_dialog.installation_script") }}
            </h3>
            <ClipBoard :data="setupGameServer.link" />
          </div>
          <code class="text-sm block text-gray-300 select-all cursor-text break-all">
            {{ setupGameServer.link }}
          </code>
        </div>

        <!-- Node Status -->
        <div class="space-y-2">
          <!-- Waiting for connection -->
          <Alert v-if="createdNode.status === 'Setup'" variant="default">
            <Loader2 class="h-4 w-4 animate-spin" />
            <AlertTitle>{{
              $t("pages.game_server_nodes.setup_dialog.waiting_title")
            }}</AlertTitle>
            <AlertDescription>
              {{
                $t("pages.game_server_nodes.setup_dialog.waiting_description")
              }}
            </AlertDescription>
          </Alert>

          <!-- Node connected -->
          <Alert v-else>
            <AlertDescription class="flex items-center gap-2">
              <Check class="h-4 w-4 text-green-500" />
              {{ $t("pages.game_server_nodes.setup_dialog.new_node") }}
            </AlertDescription>
          </Alert>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="handleClose">{{
          $t("pages.game_server_nodes.setup_dialog.close")
        }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $ } from "~/generated/zeus";

export default {
  props: {
    open: {
      type: Boolean,
      required: true,
    },
    setupGameServer: {
      required: true,
      type: Object as () => {
        link: string;
        label: string;
        gameServerId: string;
      },
    },
  },
  data() {
    return {
      createdNode: null,
    };
  },
  apollo: {
    $subscribe: {
      game_server_nodes_by_pk: {
        query: typedGql("subscription")({
          game_server_nodes_by_pk: [
            {
              id: $("nodeId", "String!"),
            },
            {
              id: true,
              label: true,
              status: true,
              region: true,
              enabled: true,
              build_id: true,
              pin_plugin_version: true,
              total_server_count: true,
              available_server_count: true,
              offline_at: true,
              e_region: {
                description: true,
              },
              e_status: {
                description: true,
              },
            },
          ],
        }),
        variables: function () {
          return {
            nodeId: this.setupGameServer.gameServerId,
          };
        },
        result: function ({ data }) {
          console.log(data);
          this.createdNode = data.game_server_nodes_by_pk;
        },
      },
    },
  },
  watch: {
    open(isOpen) {
      if (!isOpen) {
        setTimeout(() => {
          this.createdNode = null;
        }, 300);
      }
    },
  },
  methods: {
    handleClose() {
      this.$emit("close");
    },
    handleUpdateOpen(open: boolean) {
      this.$emit("update:open", open);
      if (!open) {
        this.handleClose();
      }
    },
  },
};
</script>
