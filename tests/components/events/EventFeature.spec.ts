import { describe, expect, it } from "vitest";
import EventFeature from "~/components/events/EventFeature.vue";

// A live tournament's bracket is the same for every viewer, so it is read as a
// guest and everyone watching shares one Hasura poll.
describe("EventFeature", () => {
  it("follows live brackets on the public client", () => {
    const { liveTournaments } = (EventFeature as any).apollo.$subscribe;

    expect(liveTournaments.client).toBe("public");
  });
});
