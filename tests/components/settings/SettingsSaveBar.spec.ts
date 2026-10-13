import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";

const REASON =
  "Best of 5 needs at least 5 maps. The tournament's map pool has 4.";
const GENERIC = "Fix the highlighted fields to save";

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
});

async function mountBar(props: Record<string, unknown>) {
  const wrapper = await mountSuspended(SettingsSaveBar, {
    props: { contained: true, dirty: true, ...props },
    attachTo: document.body,
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountBar>>;

const saveButton = (wrapper: Wrapper) =>
  wrapper
    .findAll("button")
    .find((button) => button.text().includes("Save changes"))!;

const isDisabled = (wrapper: Wrapper) =>
  saveButton(wrapper).attributes("disabled") !== undefined;

const tooltipWrapper = (wrapper: Wrapper) =>
  saveButton(wrapper).element.closest<HTMLElement>("span[tabindex]");

const secondLine = (wrapper: Wrapper) => wrapper.get("span.truncate").text();

async function html(props: Record<string, unknown>) {
  const wrapper = await mountBar(props);
  const markup = wrapper.html();
  wrapper.unmount();
  unmount = null;
  return markup;
}

describe("SettingsSaveBar", () => {
  it("says why the settings can't be saved, on its second line and on the disabled Save", async () => {
    const wrapper = await mountBar({ invalid: true, invalidReason: REASON });

    expect(wrapper.text()).toContain("Invalid settings");
    expect(secondLine(wrapper)).toBe(REASON);
    expect(wrapper.text()).not.toContain(GENERIC);
    expect(isDisabled(wrapper)).toBe(true);

    const trigger = tooltipWrapper(wrapper);
    expect(trigger).not.toBeNull();
    expect(trigger!.getAttribute("tabindex")).toBe("0");

    trigger!.focus();
    await flushPromises();
    expect(
      document.body.querySelector('[role="tooltip"]')?.textContent,
    ).toContain(REASON);
  });

  it("keeps the generic line and a bare Save when no reason is given", async () => {
    const wrapper = await mountBar({ invalid: true });

    expect(wrapper.text()).toContain("Invalid settings");
    expect(secondLine(wrapper)).toBe(GENERIC);
    expect(isDisabled(wrapper)).toBe(true);
    expect(tooltipWrapper(wrapper)).toBeNull();
  });

  it("ignores a reason while the settings can be saved", async () => {
    const wrapper = await mountBar({ invalid: false, invalidReason: REASON });

    expect(wrapper.text()).toContain("Unsaved changes");
    expect(secondLine(wrapper)).toBe("Review your edits, then save");
    expect(wrapper.text()).not.toContain(REASON);
    expect(isDisabled(wrapper)).toBe(false);
    expect(tooltipWrapper(wrapper)).toBeNull();
  });

  it("ignores a reason on a bar driven by a form's own errors", async () => {
    const wrapper = await mountBar({
      form: { values: {}, errors: { name: "Required" } },
      forceVisible: true,
      valid: false,
      invalid: true,
      invalidReason: REASON,
    });

    expect(wrapper.text()).toContain("Invalid settings");
    expect(secondLine(wrapper)).toBe(GENERIC);
    expect(tooltipWrapper(wrapper)).toBeNull();
  });

  it("renders the same bar with or without a reason unless it is invalid", async () => {
    expect(await html({ invalidReason: REASON })).toBe(await html({}));
    expect(await html({ invalid: true, invalidReason: "" })).toBe(
      await html({ invalid: true }),
    );
  });
});
