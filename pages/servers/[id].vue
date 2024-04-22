<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CornerDownLeft, MoreHorizontal, Trash } from "lucide-vue-next";
import { Badge } from "~/components/ui/badge";
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

  <div
    class="relative flex h-full min-h-[50vh] flex-col rounded-xl bg-muted/50 p-4 lg:col-span-2"
  >
    <Badge variant="outline" class="absolute right-3 top-3"> Output </Badge>
    <div class="flex-1 overflow-scroll max-h-screen">
      <p v-for="log in logs" :key="log" class="whitespace-pre mt-2 mb-2">
        {{ log }}
      </p>
    </div>
    <form
      class="relative overflow-hidden rounded-lg border bg-background focus-within:ring-1 focus-within:ring-ring"
      @submit.prevent="sendCommand"
    >
      <FormField v-slot="{ componentField }" name="command">
        <FormItem>
          <FormControl>
            <Input
              placeholder="..."
              v-bind="componentField"
              class="min-h-12 resize-none border-0 p-3 shadow-none focus-visible:ring-0"
            />
          </FormControl>
        </FormItem>
      </FormField>
      <div class="flex items-center p-3 pt-0">
        <Button type="submit" size="sm" class="ml-auto gap-1.5">
          Send Command
          <CornerDownLeft class="size-3.5" />
        </Button>
      </div>
    </form>
  </div>

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
import { v4 as uuidv4 } from "uuid";
import { $ } from "~/generated/zeus";
import socket from "~/web-sockets/Socket";
import {
  generateMutation,
  generateQuery,
  generateSubscription,
} from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";

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
      logs: [],
      server: undefined,
      uuid: undefined,
      rconListener: undefined,
      editServerSheet: false,
      deleteServerAlertDialog: false,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            command: z.string().min(1),
          })
        ),
      }),
    };
  },
  watch: {
    $route: {
      immediate: true,
      handler() {
        if (this.rconListener) {
          this.rconListener.stop();
          this.rconListener = undefined;
        }

        this.uuid = uuidv4();

        this.rconListener = socket.listen("rcon", (data) => {
          if (data.uuid === this.uuid) {
            this.logs.unshift(data.result);
          }
        });
      },
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

      this.$router.push("/servers");
    },
    sendCommand() {
      const { command } = this.form.values;
      if (command?.length === 0) {
        return;
      }

      socket.event("rcon", {
        uuid: this.uuid,
        serverId: this.$route.params.id,
        command: command,
      });
      this.form.resetForm();
    },
  },
  beforeUnmount() {
    this.rconListener?.stop();
  },
};
</script>
