import { describe, expect, it, vi } from "vitest";

// Every file boots the app, whose auth middleware asks the api who is signed
// in. There is no api here: left alone, that query retries in the background
// for the rest of the file and turns up in whichever test is spying on fetch.
describe("the app a test file boots", () => {
  it("leaves no query from its boot retrying in the background", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await new Promise((resolve) => setTimeout(resolve, 2_000));

    expect(
      fetchSpy.mock.calls
        .map(([input]) => String((input as Request)?.url ?? input))
        .filter((url) => url.includes("/v1/graphql")),
    ).toEqual([]);

    fetchSpy.mockRestore();
  });
});
