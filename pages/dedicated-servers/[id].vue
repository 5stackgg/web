<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Trash } from "lucide-vue-next";
import PageHeading from "~/components/PageHeading.vue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { ref } from "vue";
import ServerForm from "~/components/servers/ServerForm.vue";
import RconCommander from "~/components/servers/RconCommander.vue";
import { Eye, EyeOff } from "lucide-vue-next";
import { Copy } from "lucide-vue-next";
import Clipboard from "~/components/ClipBoard.vue";

const serverMenu = ref(false);
</script>
<template>
  <PageHeading v-if="server">
    <template #title>
      <div class="flex items-center justify-between gap-4">
        <div class="flex flex-col">
          <div>
            <Badge>{{ server.region }}</Badge>
          </div>
          <div class="flex gap-4">
            <div class="flex gap-2 items-center">
              <div
                class="h-2 w-2 rounded-full relative"
                :class="{
                  'bg-red-600': !server.connected,
                  'bg-green-600': server.connected,
                }"
              >
                <span
                  class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-red-600"
                  v-if="!server.connected"
                ></span>
              </div>
              <span class="truncate">
                {{ server.label }}
                ({{ server.host }}:{{ server.port }})
              </span>
            </div>

            <div class="flex items-center space-x-2">
              <Switch @click="toggleServerEnabled" :checked="server.enabled" />
              <Label>{{ $t("pages.dedicated_servers.detail.enabled") }}</Label>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #description>
      <div class="bg-muted rounded-md p-4 my-4">
        <div class="flex flex-col space-y-2">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">
              {{ $t("pages.dedicated_servers.detail.server_plugin_config") }}
            </h3>
            <div class="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                @click="showConfig = !showConfig"
              >
                <Eye v-if="!showConfig" class="mr-2 h-4 w-4" />
                <EyeOff v-else class="mr-2 h-4 w-4" />
                {{
                  showConfig
                    ? $t("pages.dedicated_servers.detail.hide_config")
                    : $t("pages.dedicated_servers.detail.show_config")
                }}
              </Button>
            </div>
          </div>

          <p class="text-sm text-muted-foreground">
            {{ $t("pages.dedicated_servers.detail.config_location") }}
            <Badge>
              addons/counterstrikesharp/config/plugins/FiveStack/FiveStack.json
            </Badge>
          </p>

          <div v-if="showConfig" class="relative">
            <pre
              class="bg-secondary p-4 rounded-lg text-sm font-mono whitespace-pre-wrap w-full"
              >{{ config }}</pre
            >
            <div class="absolute top-2 right-2">
              <Clipboard :data="config">
                <Button variant="ghost" size="sm">
                  <Copy class="mr-2 h-4 w-4" />
                  {{ $t("pages.dedicated_servers.detail.copy") }}
                </Button>
              </Clipboard>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #actions>
      <DropdownMenu v-model:open="serverMenu">
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="icon">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-[200px]">
          <DropdownMenuGroup>
            <DropdownMenuItem @click="editServerSheet = true">
              {{ $t("pages.dedicated_servers.detail.edit") }}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              class="text-red-600"
              @click="deleteServerAlertDialog = true"
            >
              <Trash class="mr-2 h-4 w-4 inline" />
              {{ $t("pages.dedicated_servers.detail.delete") }}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </template>
  </PageHeading>

  <RconCommander :server-id="$route.params.id as string" :online="true" />

  <Sheet
    :open="editServerSheet"
    @update:open="(open) => (editServerSheet = open)"
  >
    <SheetContent>
      <SheetHeader>
        <SheetTitle>{{ $t("pages.dedicated_servers.detail.edit") }}</SheetTitle>
        <SheetDescription>
          <ServerForm :server="server" @updated="editServerSheet = false" />
        </SheetDescription>
      </SheetHeader>
    </SheetContent>
  </Sheet>

  <AlertDialog
    :open="deleteServerAlertDialog"
    @update:open="(open) => (deleteServerAlertDialog = open)"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{
          $t("pages.dedicated_servers.detail.delete_confirm.title")
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("pages.dedicated_servers.detail.delete_confirm.description") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{
          $t("pages.dedicated_servers.detail.delete_confirm.cancel")
        }}</AlertDialogCancel>
        <AlertDialogAction @click="deleteServer">{{
          $t("pages.dedicated_servers.detail.delete_confirm.continue")
        }}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script lang="ts">
import { $ } from "~/generated/zeus";
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";

export default {
  apollo: {
    $subscribe: {
      server: {
        query: generateSubscription({
          servers_by_pk: [
            {
              id: $("serverId", "uuid!"),
            },
            {
              id: true,
              host: true,
              region: true,
              port: true,
              label: true,
              tv_port: true,
              enabled: true,
              connected: true,
              api_password: true,
            },
          ],
        }),
        variables: function () {
          return {
            serverId: this.$route.params.id,
          };
        },
        result: function ({ data }) {
          this.server = data.servers_by_pk;
        },
      },
    },
  },
  data() {
    return {
      server: undefined,
      showConfig: false,
      editServerSheet: false,
      deleteServerAlertDialog: false,
    };
  },
  computed: {
    config() {
      return `
{
  "WS_DOMAIN": "wss://${useRuntimeConfig().public.wsDomain}",
  "API_DOMAIN": "https://${useRuntimeConfig().public.apiDomain}", 
  "DEMOS_DOMAIN": "https://${useRuntimeConfig().public.demosDomain}",
  "SERVER_ID": "${this.server.id}",
  "SERVER_API_PASSWORD": "${this.server.api_password}"
}
`;
    },
  },
  methods: {
    async toggleServerEnabled() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_servers_by_pk: [
            {
              pk_columns: {
                id: this.server.id,
              },
              _set: {
                enabled: !this.server.enabled,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async deleteServer() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_servers_by_pk: [
            {
              id: this.$route.params.id,
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      this.$router.push("/dedicated-servers");
    },
  },
};
</script>
