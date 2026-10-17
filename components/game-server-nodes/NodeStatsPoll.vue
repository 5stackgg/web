<script lang="ts">
import {
  fetchNodeStats,
  SAMPLE_INTERVAL_MS,
} from "~/components/game-server-nodes/nodeMetrics";

// One getNodeStats poll for one node, at the rate the node reports. Renders
// nothing; the page keeps the result so the row and the inspector share it.
export default {
  props: {
    nodeId: { type: String, required: true },
    full: { type: Boolean, default: false },
  },
  emits: ["stats"],
  data() {
    return {
      timer: null as ReturnType<typeof setInterval> | null,
      alive: true,
    };
  },
  mounted() {
    this.poll();
    this.timer = setInterval(() => this.poll(), SAMPLE_INTERVAL_MS);
  },
  beforeUnmount() {
    this.alive = false;
    if (this.timer) {
      clearInterval(this.timer);
    }
  },
  methods: {
    async poll() {
      try {
        const stats = await fetchNodeStats(
          (this as any).$apollo,
          this.nodeId,
          this.full,
        );
        if (this.alive) {
          this.$emit("stats", this.nodeId, stats, this.full);
        }
      } catch {
        // a missed poll keeps the last numbers; the next one tries again
      }
    },
  },
  render() {
    return null;
  },
};
</script>
