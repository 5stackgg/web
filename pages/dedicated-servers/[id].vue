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
import PasswordInput from "~/components/PasswordInput.vue";
import RconCommander from "~/components/servers/RconCommander.vue";

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
            <div>
              {{ server.label }}
              ({{ server.host }}:{{ server.port }})
            </div>
            <div class="flex items-center space-x-2">
              <Switch @click="toggleServerEnabled" :checked="server.enabled" />
              <Label>Enabled</Label>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #description>
      <div class="bg-muted rounded-md p-4 my-4">
        <h3 class="text-lg font-semibold mb-2">Server API Key</h3>
        <PasswordInput
          v-model="server.api_password"
          description="Used to get matches & connect to redis for match events."
          :disabled="true"
        />
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
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              class="text-red-600"
              @click="deleteServerAlertDialog = true"
            >
              <Trash class="mr-2 h-4 w-4 inline" /> Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </template>
  </PageHeading>

  <RconCommander
    :server-id="$route.params.id as string"
    :online="server?.connected || false"
  />

  <Sheet
    :open="editServerSheet"
    @update:open="(open) => (editServerSheet = open)"
  >
    <SheetContent>
      <SheetHeader>
        <SheetTitle>Edit Server</SheetTitle>
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
        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
        <AlertDialogDescription>
          This action cannot be undone. This will permanently delete your server
          and remove associated data from our servers.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction @click="deleteServer">Continue</AlertDialogAction>
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
      editServerSheet: false,
      deleteServerAlertDialog: false,
    };
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
