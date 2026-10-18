<script lang="ts">
import { $ } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";

// One getNodeStats poll per online node: CPU, memory, disks and GPUs in a
// single query, handed up to the page. Renders nothing. Network is left out --
// nothing on System Metrics draws it, and Game Server Nodes has the full view.
export default {
  props: {
    nodeId: {
      type: String,
      required: true,
    },
  },
  emits: ["stats"],
  render() {
    return null;
  },
  apollo: {
    getNodeStats: {
      query: generateQuery({
        getNodeStats: [
          { node: $("node", "String!") },
          {
            node: true,
            cpu: [{}, { time: true, total: true, used: true }],
            memory: [{}, { time: true, total: true, used: true }],
            disks: [
              {},
              {
                time: true,
                disks: {
                  filesystem: true,
                  size: true,
                  used: true,
                  usedPercent: true,
                  mountpoint: true,
                },
              },
            ],
            gpu: [
              {},
              {
                time: true,
                devices: {
                  index: true,
                  name: true,
                  memory_mb: true,
                  memory_used_mb: true,
                  temperature_c: true,
                  power_w: true,
                  utilization_percent: true,
                },
              },
            ],
          },
        ],
      }),
      pollInterval: 30 * 1000,
      variables(this: any) {
        return { node: this.nodeId };
      },
      result(this: any, { data }: any) {
        this.$emit("stats", this.nodeId, data?.getNodeStats ?? null);
      },
      error(this: any) {
        // Still counts as answered, so the verdict does not wait on it forever.
        this.$emit("stats", this.nodeId, null);
      },
    },
  },
};
</script>
