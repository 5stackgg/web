import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ScrimHoursGrid from "~/components/scrims/ScrimHoursGrid.vue";

const empty = () => Array.from({ length: 7 }, () => [] as Array<[number, number]>);
// Rows run Monday first; slots are 15 minutes.
const cell = (wrapper: any, row: number, slot: number) =>
  wrapper.find(`[data-row="${row}"][data-slot="${slot}"]`);

async function drag(wrapper: any, from: [number, number], to: [number, number]) {
  await cell(wrapper, ...from).trigger("pointerdown", { button: 0 });
  await cell(wrapper, ...to).trigger("pointermove");
  window.dispatchEvent(new Event("pointerup"));
}

describe("ScrimHoursGrid", () => {
  it("paints a rectangle across days", async () => {
    const wrapper = await mountSuspended(ScrimHoursGrid, { props: { modelValue: empty() } });
    await drag(wrapper, [1, 80], [2, 87]);
    const ranges = wrapper.emitted("update:modelValue")!.at(-1)![0] as any;
    expect(ranges[2]).toEqual([[1200, 1320]]);
    expect(ranges[3]).toEqual([[1200, 1320]]);
    expect(ranges[1]).toEqual([]);
  });

  it("erases when the drag starts on a painted slot", async () => {
    const modelValue = empty();
    modelValue[3] = [[1200, 1320]];
    const wrapper = await mountSuspended(ScrimHoursGrid, { props: { modelValue } });
    await drag(wrapper, [2, 84], [2, 85]);
    const ranges = wrapper.emitted("update:modelValue")!.at(-1)![0] as any;
    expect(ranges[3]).toEqual([
      [1200, 1260],
      [1290, 1320],
    ]);
  });

  it("keeps a stretch across midnight as one range", async () => {
    const wrapper = await mountSuspended(ScrimHoursGrid, { props: { modelValue: empty() } });
    await drag(wrapper, [6, 92], [6, 95]);
    await wrapper.setProps({ modelValue: wrapper.emitted("update:modelValue")!.at(-1)![0] as any });
    await drag(wrapper, [0, 0], [0, 3]);
    const ranges = wrapper.emitted("update:modelValue")!.at(-1)![0] as any;
    expect(ranges[0]).toEqual([[1380, 1500]]);
    expect(ranges[1]).toEqual([]);
  });
});
