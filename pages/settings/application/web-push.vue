<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <SettingsSection
        id="web-push"
        :title="$t('pages.settings.application.web_push.section')"
        :description="$t('pages.settings.application.web_push.description')"
      >
        <div
          v-if="loading && !status"
          class="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground"
        >
          {{ $t("common.loading") }}
        </div>

        <p v-else-if="error" class="text-sm text-destructive">
          {{ error }}
        </p>

        <template v-else-if="status">
          <!-- Status readout. Deliberately one dense strip rather than large
               tiles: there are only two values here, and giving each a hero
               card left the page mostly empty space. -->
          <div
            class="flex flex-wrap items-stretch overflow-hidden rounded-lg border border-border bg-card/40 [backdrop-filter:blur(6px)]"
          >
            <div class="flex items-center gap-3 px-4 py-3">
              <span
                class="inline-block h-[9px] w-[9px] rotate-45"
                :class="
                  status.configured
                    ? 'bg-success [box-shadow:0_0_10px_hsl(var(--success)/0.7)]'
                    : 'bg-destructive'
                "
              ></span>
              <div class="grid gap-0.5">
                <span
                  class="font-sans text-sm font-bold uppercase leading-none tracking-[0.1em]"
                  :class="status.configured ? 'text-success' : 'text-destructive'"
                >
                  {{
                    status.configured
                      ? $t("pages.settings.application.web_push.active")
                      : $t("pages.settings.application.web_push.inactive")
                  }}
                </span>
                <span
                  class="font-mono text-[0.6rem] uppercase leading-none tracking-[0.18em] text-muted-foreground/70"
                >
                  {{ $t("pages.settings.application.web_push.status") }}
                </span>
              </div>
            </div>

            <div class="w-px self-stretch bg-border"></div>

            <div class="flex items-center gap-3 px-4 py-3">
              <span
                class="font-sans text-sm font-bold leading-none tabular-nums"
                :class="
                  status.subscriptions > 0
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                "
              >
                {{ status.subscriptions }}
              </span>
              <span
                class="font-mono text-[0.6rem] uppercase leading-none tracking-[0.18em] text-muted-foreground/70"
              >
                {{ $t("pages.settings.application.web_push.subscribed") }}
              </span>
            </div>

            <!-- Key provenance rides in the same strip so it reads as part of
                 the readout instead of a stray sentence under it. -->
            <div
              class="ml-auto flex items-center px-4 py-3 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground/60"
            >
              {{
                status.managed_by_environment
                  ? $t("pages.settings.application.web_push.source_env")
                  : $t("pages.settings.application.web_push.source_generated")
              }}
            </div>
          </div>

          <div
            v-if="!status.managed_by_environment"
            class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/[0.06] px-4 py-3"
          >
            <div class="grid min-w-0 gap-1">
              <span
                class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-destructive"
              >
                {{ $t("pages.settings.application.web_push.regenerate") }}
              </span>
              <p class="max-w-prose text-xs text-muted-foreground">
                {{
                  $t("pages.settings.application.web_push.regenerate_warning")
                }}
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              class="shrink-0 font-sans text-[0.68rem] font-bold uppercase tracking-[0.14em]"
              :loading="regenerating"
              @click="regenerate"
            >
              {{ $t("pages.settings.application.web_push.regenerate_action") }}
            </Button>
          </div>
        </template>
      </SettingsSection>
    </PageTransition>
  </SettingsPage>
</template>

<script lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import { Button } from "~/components/ui/button";
import { generateQuery, generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

type WebPushStatus = {
  configured: boolean;
  managed_by_environment: boolean;
  subscriptions: number;
};

export default {
  components: {
    PageTransition,
    SettingsPage,
    SettingsSection,
    Button,
  },
  data() {
    return {
      status: null as WebPushStatus | null,
      loading: false,
      regenerating: false,
      error: null as string | null,
    };
  },
  mounted() {
    void this.fetchStatus();
  },
  methods: {
    async fetchStatus() {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await this.$apollo.query({
          fetchPolicy: "no-cache",
          query: generateQuery({
            webPushStatus: {
              configured: true,
              managed_by_environment: true,
              subscriptions: true,
            },
          }),
        });
        this.status = data.webPushStatus;
      } catch (error) {
        this.error = (error as Error)?.message ?? String(error);
      } finally {
        this.loading = false;
      }
    },
    async regenerate() {
      this.regenerating = true;
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            generateWebPushKeys: {
              success: true,
            },
          }),
        });
        await this.fetchStatus();
        toast({
          title: this.$t(
            "pages.settings.application.web_push.regenerate_success",
          ),
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: (error as Error)?.message ?? String(error),
        });
      } finally {
        this.regenerating = false;
      }
    },
  },
};
</script>
