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
  SheetTrigger,
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
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { ref } from "vue";
import ServerForm from "~/components/servers/ServerForm.vue";
import PasswordInput from "~/components/PasswordInput.vue";
import RconCommander from "~/components/servers/RconCommander.vue";

const serverMenu = ref(false);
</script>

<template>
  <PageHeading v-if="server">
    {{ server.label }} ({{ server.host }}:{{ server.port }})
    <div class="flex items-center space-x-2">
      <Switch @click="toggleServerEnabled" :checked="server.enabled" />
      <Label>Enabled</Label>
    </div>

    <DropdownMenu v-model:open="serverMenu">
      <DropdownMenuTrigger as-child>
        <Button variant="ghost" size="sm">
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

    <PasswordInput
      v-model="server.api_password"
      description="Server API Key use to get matches / connect to redis for match events."
      :disabled="true"
    ></PasswordInput>
  </PageHeading>

  <rcon-commander :server-id="$route.params.id"></rcon-commander>

  <Sheet
    :open="editServerSheet"
    @update:open="(open) => (editServerSheet = open)"
  >
    <SheetTrigger></SheetTrigger>
    <SheetContent>
      <SheetHeader>
        <SheetTitle>Editing Team</SheetTitle>
        <SheetDescription>
          <server-form
            :server="server"
            @updated="editServerSheet = false"
          ></server-form>
        </SheetDescription>
      </SheetHeader>
    </SheetContent>
  </Sheet>

  <AlertDialog
    :open="deleteServerAlertDialog"
    @update:open="(open) => (deleteServerAlertDialog = open)"
  >
    <AlertDialogTrigger class="w-full"> </AlertDialogTrigger>
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
              port: true,
              label: true,
              tv_port: true,
              enabled: true,
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

      this.$router.push("/servers");
    },
  },
};
</script>
