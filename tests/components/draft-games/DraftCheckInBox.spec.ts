import { afterEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import DraftCheckInBox from "~/components/draft-games/DraftCheckInBox.vue";

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;

const match = {
  id: "m-1",
  is_in_lineup: true,
  options: { camera_required: false },
};

const inSeconds = (seconds: number) =>
  new Date(Date.now() + seconds * 1000).toISOString();

async function mountBox(props: Record<string, any>) {
  wrapper = await mountSuspended(DraftCheckInBox, {
    props: {
      match,
      deadline: inSeconds(50),
      ready: 3,
      total: 10,
      canCheckIn: false,
      checkedIn: false,
      ...props,
    },
  });
  return wrapper.find(".checkin-box");
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe("DraftCheckInBox", () => {
  it("is the check-in button while you still have to check in", async () => {
    const box = await mountBox({ canCheckIn: true });

    expect(box.element.tagName).toBe("BUTTON");
    expect(box.text()).toContain("Check In");
    expect(box.find(".checkin-box-clock").text()).toBe("0:50");
  });

  it("stays the same box once you're in, with a dash lit per player checked in", async () => {
    const box = await mountBox({ checkedIn: true, ready: 4 });

    expect(box.element.tagName).toBe("DIV");
    expect(box.text()).toContain("Checked In");
    expect(box.findAll(".checkin-box-seats i")).toHaveLength(10);
    expect(box.findAll(".checkin-box-seats i.is-in")).toHaveLength(4);
  });

  it("drops the amber once there is nothing left for you to press", async () => {
    expect((await mountBox({ canCheckIn: true })).classes()).toContain(
      "is-action",
    );
    wrapper?.unmount();

    const checkedIn = (await mountBox({ checkedIn: true })).classes();
    expect(checkedIn).toContain("is-checked-in");
    expect(checkedIn).not.toContain("is-action");
    wrapper?.unmount();

    const watching = (await mountBox({})).classes();
    expect(watching).toContain("is-watching");
    expect(watching).not.toContain("is-checked-in");
  });

  it("turns red only for the last ten seconds", async () => {
    expect((await mountBox({})).classes()).not.toContain("is-final");
    wrapper?.unmount();

    expect((await mountBox({ deadline: inSeconds(8) })).classes()).toContain(
      "is-final",
    );
  });

  it("drops the clock when nothing will auto-cancel", async () => {
    const box = await mountBox({ deadline: null });

    expect(box.find(".checkin-box-clock").exists()).toBe(false);
  });
});
