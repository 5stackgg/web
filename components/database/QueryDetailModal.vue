<template>
  <Dialog :open="true" @update:open="(open) => !open && $emit('close')">
    <DialogContent class="w-[80vw] max-w-none max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{{ $t('pages.database.query_detail.title') }}</DialogTitle>
      </DialogHeader>

      <!-- Loading State -->
      <div v-if="$apollo.queries.queryDetail.loading" class="p-8 text-center">
        <p class="text-muted-foreground">{{ $t('common.loading') }}</p>
      </div>

      <!-- Content -->
      <div v-else-if="queryDetail" class="space-y-6">
        <!-- Query Text -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold">{{ $t('pages.database.query_detail.query') }}</h3>
            <Button
              variant="ghost"
              size="sm"
              @click="copyToClipboard(queryDetail.query, 'query')"
            >
              <CopyIcon class="w-4 h-4 mr-2" />
              {{ $t('pages.database.query_detail.copy') }}
            </Button>
          </div>
          <Card>
            <CardContent class="pt-6">
              <pre class="text-xs font-mono whitespace-pre-wrap">{{ queryDetail.query }}</pre>
            </CardContent>
          </Card>
        </div>

        <!-- Statistics Grid -->
        <div>
          <h3 class="text-sm font-semibold mb-3">{{ $t('pages.database.query_detail.statistics') }}</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent class="pt-6">
                <div class="text-xs text-muted-foreground">{{ $t('pages.database.query_detail.calls') }}</div>
                <div class="text-2xl font-bold">
                  {{ queryDetail.stats.calls.toLocaleString() }}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent class="pt-6">
                <div class="text-xs text-muted-foreground">{{ $t('pages.database.query_detail.avg_time') }}</div>
                <div class="text-2xl font-bold">
                  {{ queryDetail.stats.mean_exec_time.toFixed(2) }}ms
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent class="pt-6">
                <div class="text-xs text-muted-foreground">{{ $t('pages.database.query_detail.max_time') }}</div>
                <div class="text-2xl font-bold">
                  {{ queryDetail.stats.max_exec_time.toFixed(2) }}ms
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent class="pt-6">
                <div class="text-xs text-muted-foreground">{{ $t('pages.database.query_detail.total_rows') }}</div>
                <div class="text-2xl font-bold">
                  {{ queryDetail.stats.total_rows.toLocaleString() }}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <!-- Execution Times -->
        <div>
          <h3 class="text-sm font-semibold mb-3">{{ $t('pages.database.query_detail.execution_times') }}</h3>
          <Card>
            <CardContent class="pt-6">
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span class="text-muted-foreground">{{ $t('pages.database.query_detail.min') }}:</span>
                  <span class="ml-2 font-medium">{{ queryDetail.stats.min_exec_time.toFixed(2) }}ms</span>
                </div>
                <div>
                  <span class="text-muted-foreground">{{ $t('pages.database.query_detail.mean') }}:</span>
                  <span class="ml-2 font-medium">{{ queryDetail.stats.mean_exec_time.toFixed(2) }}ms</span>
                </div>
                <div>
                  <span class="text-muted-foreground">{{ $t('pages.database.query_detail.max') }}:</span>
                  <span class="ml-2 font-medium">{{ queryDetail.stats.max_exec_time.toFixed(2) }}ms</span>
                </div>
                <div v-if="queryDetail.stats.stddev_exec_time !== null">
                  <span class="text-muted-foreground">{{ $t('pages.database.query_detail.std_dev') }}:</span>
                  <span class="ml-2 font-medium">{{ queryDetail.stats.stddev_exec_time.toFixed(2) }}ms</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- Buffer Stats -->
        <div>
          <h3 class="text-sm font-semibold mb-3">{{ $t('pages.database.query_detail.buffer_stats') }}</h3>
          <Card>
            <CardContent class="pt-6">
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div class="space-y-2">
                  <div>
                    <span class="text-muted-foreground">{{ $t('pages.database.query_detail.shared_blocks_hit') }}:</span>
                    <span class="ml-2 font-medium">{{ queryDetail.stats.shared_blks_hit.toLocaleString() }}</span>
                  </div>
                  <div>
                    <span class="text-muted-foreground">{{ $t('pages.database.query_detail.shared_blocks_read') }}:</span>
                    <span class="ml-2 font-medium">{{ queryDetail.stats.shared_blks_read.toLocaleString() }}</span>
                  </div>
                  <div>
                    <span class="text-muted-foreground">{{ $t('pages.database.query_detail.cache_hit_ratio') }}:</span>
                    <span class="ml-2 font-medium" v-if="queryDetail.stats.cache_hit_ratio !== null">
                      {{ (queryDetail.stats.cache_hit_ratio * 100).toFixed(1) }}%
                    </span>
                    <span class="ml-2 text-muted-foreground" v-else>N/A</span>
                  </div>
                </div>
                <div class="space-y-2">
                  <div>
                    <span class="text-muted-foreground">{{ $t('pages.database.query_detail.local_blocks_hit') }}:</span>
                    <span class="ml-2 font-medium">{{ queryDetail.stats.local_blks_hit.toLocaleString() }}</span>
                  </div>
                  <div>
                    <span class="text-muted-foreground">{{ $t('pages.database.query_detail.local_blocks_read') }}:</span>
                    <span class="ml-2 font-medium">{{ queryDetail.stats.local_blks_read.toLocaleString() }}</span>
                  </div>
                  <div>
                    <span class="text-muted-foreground">{{ $t('pages.database.query_detail.temp_blocks_written') }}:</span>
                    <Badge v-if="queryDetail.stats.temp_blks_written > 0" variant="destructive" class="ml-2">
                      {{ queryDetail.stats.temp_blks_written.toLocaleString() }}
                    </Badge>
                    <span v-else class="ml-2 font-medium">{{ queryDetail.stats.temp_blks_written }}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- Explain Plan -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold">{{ $t('pages.database.query_detail.execution_plan') }}</h3>
            <Button
              v-if="queryDetail.explain_plan"
              variant="ghost"
              size="sm"
              @click="copyToClipboard(queryDetail.explain_plan, 'plan')"
            >
              <CopyIcon class="w-4 h-4 mr-2" />
              {{ $t('pages.database.query_detail.copy') }}
            </Button>
          </div>
          <Card v-if="queryDetail.explain_plan">
            <CardContent class="pt-6 bg-muted">
              <pre class="text-xs font-mono whitespace-pre-wrap">{{ queryDetail.explain_plan }}</pre>
            </CardContent>
          </Card>
          <Card v-else>
            <CardContent class="pt-6">
              <p class="text-sm text-muted-foreground">
                {{ $t('pages.database.query_detail.no_explain_plan') }}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <!-- Error State -->
      <div v-else class="p-8 text-center">
        <p class="text-muted-foreground">{{ $t('pages.database.query_detail.not_found') }}</p>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script lang="ts">
import { CopyIcon } from 'lucide-vue-next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { generateQuery } from "~/graphql/graphqlGen";

export default {
  components: {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    Card,
    CardContent,
    Badge,
    Button,
    CopyIcon,
  },
  props: {
    queryid: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      queryDetail: null as any,
    };
  },
  methods: {
    async copyToClipboard(text: string, type: string) {
      try {
        await navigator.clipboard.writeText(text);
        // Show success notification
        this.$toast?.success(
          type === 'query'
            ? this.$t('pages.database.query_detail.query_copied')
            : this.$t('pages.database.query_detail.plan_copied')
        );
      } catch (error) {
        console.error('Failed to copy:', error);
        this.$toast?.error(this.$t('pages.database.query_detail.copy_failed'));
      }
    },
  },
  apollo: {
    queryDetail: {
      query() {
        return generateQuery({
          getQueryDetail: [
            { queryid: this.queryid },
            {
              queryid: true,
              query: true,
              explain_plan: true,
              stats: {
                queryid: true,
                query: true,
                calls: true,
                total_exec_time: true,
                mean_exec_time: true,
                stddev_exec_time: true,
                min_exec_time: true,
                max_exec_time: true,
                total_rows: true,
                shared_blks_hit: true,
                shared_blks_read: true,
                cache_hit_ratio: true,
                temp_blks_written: true,
                local_blks_hit: true,
                local_blks_read: true,
              },
            },
          ],
        });
      },
      update: (data: any) => data.getQueryDetail,
    },
  },
};
</script>
