// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { parse } from "graphql";
import { seededSubscribe } from "~/utilities/seededSubscribe";

const query = parse("subscription { settings { name } }");

function fakeClient() {
  const handle = { unsubscribe: vi.fn() };
  const client = {
    subscribe: vi.fn(() => ({ subscribe: vi.fn(() => handle) })),
  };
  return { client: client as any, handle };
}

describe("seededSubscribe", () => {
  it("marks the subscription for the seed link", () => {
    const { client, handle } = fakeClient();

    const subscription = seededSubscribe(
      client,
      { query, variables: { limit: 5 } },
      { next: () => {} },
    );

    expect(client.subscribe).toHaveBeenCalledWith({
      query,
      variables: { limit: 5 },
      context: { seed: true },
    });
    expect(subscription).toBe(handle);
  });

  it("passes a seed check through", () => {
    const { client } = fakeClient();
    const seed = () => false;

    seededSubscribe(client, { query, seed }, { next: () => {} });

    expect(client.subscribe.mock.calls[0][0].context).toEqual({ seed });
  });
});
