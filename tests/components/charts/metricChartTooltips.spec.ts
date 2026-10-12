import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { Tooltip } from "chart.js";
import { pinBrowserLocale } from "../../helpers/browserLocale";
import CpuChart from "~/components/charts/CpuChart.vue";
import DiskChart from "~/components/charts/DiskChart.vue";
import GpuChart from "~/components/charts/GpuChart.vue";
import MemoryChart from "~/components/charts/MemoryChart.vue";
import NetworkChart from "~/components/charts/NetworkChart.vue";

const at = new Date(2026, 9, 17, 21, 30);

const metrics = [
  {
    time: at.toISOString(),
    used: 1_000_000_000,
    total: 4_000_000_000,
    disks: [],
    nics: [],
    devices: [],
  },
];

// Chart.js titles a tooltip with '' + the label, so a Date label reads as
// Date.prototype.toString() unless the chart formats it itself.
async function tooltipTitle(component: any) {
  const wrapper = await mountSuspended(component, {
    props: { metrics },
    global: { stubs: { Line: true } },
  });
  const vm = wrapper.vm as any;
  const item = {
    chart: { data: { labels: vm.labels } },
    dataIndex: 0,
    label: "" + vm.labels[0],
  };
  const title =
    vm.options.plugins.tooltip.callbacks.title ??
    (Tooltip as any).defaults.callbacks.title;
  return title.call({ options: {} }, [item]);
}

const charts = [
  ["CPU", CpuChart],
  ["Disk", DiskChart],
  ["Memory", MemoryChart],
  ["Network", NetworkChart],
  ["GPU", GpuChart],
] as const;

describe.each(charts)("%s chart tooltip", (_, chart) => {
  describe("on a 12-hour browser", () => {
    pinBrowserLocale("en-US");

    it("reads the time on the browser's clock", async () => {
      expect(await tooltipTitle(chart)).toBe("Oct 17, 9:30 PM");
    });
  });

  describe("on a 24-hour browser", () => {
    pinBrowserLocale("en-GB");

    it("reads the time on the browser's clock", async () => {
      expect(await tooltipTitle(chart)).toBe("17 Oct, 21:30");
    });
  });
});
