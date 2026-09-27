<script setup lang="ts">
import { computed, ref } from "vue";
import gql from "graphql-tag";
import { useI18n } from "vue-i18n";
import { Cloud, Server } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { toast } from "~/components/ui/toast";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

const { t } = useI18n();

const setting = (name: string) =>
  (
    useApplicationSettingsStore().settings as Array<{
      name: string;
      value: string | null;
    }>
  ).find((entry) => entry.name === name)?.value || null;

const workerUrl = computed(() => setting("playcast_relay_url"));
const relayDomain = computed(
  () => setting("relay_domain") ?? "https://relay.example.com",
);
const manualCommand = computed(
  () =>
    `npx wrangler deploy --config cloudflare-workers/playcast-relay/wrangler.toml --var ORIGIN:${relayDomain.value}`,
);

const accountId = ref("");
const apiToken = ref("");
const hostname = ref("");
const manualUrl = ref("");
const deploying = ref(false);
const saving = ref(false);
const manualOpen = ref(false);

// Errors from these mutations are already shown by the apollo error toast.
async function deploy() {
  if (deploying.value) {
    return;
  }
  deploying.value = true;
  try {
    const { data } = await getGraphqlClient().mutate({
      mutation: gql`
        mutation DeployPlaycastRelay(
          $accountId: String!
          $apiToken: String!
          $hostname: String!
        ) {
          deployPlaycastRelay(
            account_id: $accountId
            api_token: $apiToken
            hostname: $hostname
          ) {
            url
            ready
          }
        }
      `,
      variables: {
        accountId: accountId.value,
        apiToken: apiToken.value,
        hostname: hostname.value,
      },
    });
    apiToken.value = "";

    const result = data?.deployPlaycastRelay;
    if (result && !result.ready) {
      manualUrl.value = result.url;
      manualOpen.value = true;
      toast({
        title: t("pages.settings.application.streaming.relay_pending", {
          url: result.url,
        }),
      });
      return;
    }

    toast({ title: t("pages.settings.application.streaming.relay_deployed") });
  } catch {
  } finally {
    deploying.value = false;
  }
}

async function useWorker(url: string | null) {
  if (saving.value) {
    return;
  }
  saving.value = true;
  try {
    await getGraphqlClient().mutate({
      mutation: gql`
        mutation SetPlaycastRelay($url: String) {
          setPlaycastRelay(url: $url) {
            url
            ready
          }
        }
      `,
      variables: { url },
    });
    manualUrl.value = "";
    toast({ title: t("pages.settings.application.streaming.relay_updated") });
  } catch {
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <!-- Mounted inside the settings page's form: Enter in these fields would
       otherwise submit that form instead of anything here. -->
  <div
    class="space-y-4 rounded-md border border-border/60 p-4"
    @keydown.enter.prevent
  >
    <div class="space-y-1">
      <h4 class="text-sm font-medium">
        {{ $t("pages.settings.application.streaming.relay_title") }}
      </h4>
      <p class="text-xs text-muted-foreground">
        {{ $t("pages.settings.application.streaming.relay_description") }}
      </p>
    </div>

    <div
      class="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2 text-sm"
    >
      <div class="flex min-w-0 items-center gap-2">
        <Cloud v-if="workerUrl" class="size-4 shrink-0 text-primary" />
        <Server v-else class="size-4 shrink-0 text-muted-foreground" />
        <span class="truncate">
          {{
            workerUrl
              ? $t("pages.settings.application.streaming.relay_worker", {
                  url: workerUrl,
                })
              : $t("pages.settings.application.streaming.relay_builtin")
          }}
        </span>
      </div>
      <Button
        v-if="workerUrl"
        type="button"
        variant="outline"
        size="sm"
        :loading="saving"
        @click="useWorker(null)"
      >
        {{ $t("pages.settings.application.streaming.relay_use_builtin") }}
      </Button>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <div class="space-y-1.5 sm:col-span-2">
        <Label for="playcast-relay-hostname">
          {{ $t("pages.settings.application.streaming.relay_hostname") }}
        </Label>
        <Input
          id="playcast-relay-hostname"
          v-model="hostname"
          placeholder="playcast.example.com"
          autocomplete="off"
        />
        <p class="text-xs text-muted-foreground">
          {{ $t("pages.settings.application.streaming.relay_hostname_hint") }}
        </p>
      </div>
      <div class="space-y-1.5">
        <Label for="playcast-relay-account">
          {{ $t("pages.settings.application.streaming.relay_account_id") }}
        </Label>
        <Input
          id="playcast-relay-account"
          v-model="accountId"
          autocomplete="off"
        />
        <p class="text-xs text-muted-foreground">
          {{ $t("pages.settings.application.streaming.relay_account_id_hint") }}
        </p>
      </div>
      <div class="space-y-1.5">
        <Label for="playcast-relay-token">
          {{ $t("pages.settings.application.streaming.relay_api_token") }}
        </Label>
        <Input
          id="playcast-relay-token"
          v-model="apiToken"
          type="password"
          autocomplete="off"
        />
        <p class="text-xs text-muted-foreground">
          {{ $t("pages.settings.application.streaming.relay_api_token_hint") }}
        </p>
      </div>
    </div>

    <Button
      type="button"
      :loading="deploying"
      :disabled="!accountId || !apiToken || !hostname"
      @click="deploy"
    >
      <Cloud class="size-4" />
      {{ $t("pages.settings.application.streaming.relay_deploy") }}
    </Button>

    <details
      class="text-sm"
      :open="manualOpen"
      @toggle="manualOpen = ($event.target as HTMLDetailsElement).open"
    >
      <summary class="cursor-pointer text-muted-foreground">
        {{ $t("pages.settings.application.streaming.relay_manual") }}
      </summary>
      <div class="mt-3 space-y-3">
        <p class="text-xs text-muted-foreground">
          {{ $t("pages.settings.application.streaming.relay_manual_command") }}
        </p>
        <pre
          class="overflow-x-auto rounded-md bg-muted p-2 text-xs"
        ><code>{{ manualCommand }}</code></pre>
        <p class="text-xs text-muted-foreground">
          {{ $t("pages.settings.application.streaming.relay_manual_paste") }}
        </p>
        <div class="flex flex-col gap-2 sm:flex-row">
          <Input
            v-model="manualUrl"
            placeholder="https://playcast.example.com"
            autocomplete="off"
          />
          <Button
            type="button"
            variant="outline"
            :loading="saving"
            :disabled="!manualUrl"
            @click="useWorker(manualUrl)"
          >
            {{ $t("pages.settings.application.streaming.relay_use_worker") }}
          </Button>
        </div>
      </div>
    </details>
  </div>
</template>
