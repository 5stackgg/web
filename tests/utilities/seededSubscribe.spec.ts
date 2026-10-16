// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  OperationTypeNode,
  parse,
  type OperationDefinitionNode,
} from "graphql";
import { seededSubscribe } from "~/utilities/seededSubscribe";

const subscription = parse(
  "subscription Match($id: uuid!) { matches_by_pk(id: $id) { id } }",
);

function fakeClient() {
  let push: ((result: unknown) => void) | undefined;
  let resolveQuery: ((result: unknown) => void) | undefined;
  const subscriptionHandle = {
    closed: false,
    unsubscribe() {
      subscriptionHandle.closed = true;
    },
  };
  const client = {
    subscribe: vi.fn(() => ({
      subscribe(observer: { next: (result: unknown) => void }) {
        push = observer.next;
        return subscriptionHandle;
      },
    })),
    query: vi.fn(
      () =>
        new Promise((resolve) => {
          resolveQuery = resolve;
        }),
    ),
  };
  return {
    client: client as any,
    live: (data: unknown) => push!({ data }),
    answer: async (data: unknown) => {
      resolveQuery!({ data });
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

describe("seededSubscribe", () => {
  it("asks for the same selection as an uncached query", () => {
    const { client } = fakeClient();

    seededSubscribe(
      client,
      { query: subscription, variables: { id: "m1" } },
      { next: () => {} },
    );

    const options = client.query.mock.calls[0][0];
    const operation = options.query.definitions[0] as OperationDefinitionNode;
    expect(operation.operation).toBe(OperationTypeNode.QUERY);
    expect(operation.selectionSet).toBe(
      (subscription.definitions[0] as OperationDefinitionNode).selectionSet,
    );
    expect(options.variables).toEqual({ id: "m1" });
    expect(options.fetchPolicy).toBe("no-cache");
  });

  it("renders from the query when it answers before the socket", async () => {
    const { client, answer } = fakeClient();
    const next = vi.fn();

    seededSubscribe(client, { query: subscription }, { next });
    await answer({ matches_by_pk: { id: "m1" } });

    expect(next).toHaveBeenCalledWith({
      data: { matches_by_pk: { id: "m1" } },
    });
  });

  it("ignores the query once the subscription has answered", async () => {
    const { client, live, answer } = fakeClient();
    const next = vi.fn();

    seededSubscribe(client, { query: subscription }, { next });
    live({ matches_by_pk: { id: "m1", status: "Live" } });
    await answer({ matches_by_pk: { id: "m1", status: "Veto" } });

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith({
      data: { matches_by_pk: { id: "m1", status: "Live" } },
    });
  });

  it("skips a first live payload that repeats the query's answer", async () => {
    const { client, live, answer } = fakeClient();
    const next = vi.fn();

    seededSubscribe(client, { query: subscription }, { next });
    await answer({ matches_by_pk: { id: "m1", status: "Live" } });
    live({ matches_by_pk: { id: "m1", status: "Live" } });
    live({ matches_by_pk: { id: "m1", status: "Finished" } });

    expect(next.mock.calls.map(([result]) => result.data)).toEqual([
      { matches_by_pk: { id: "m1", status: "Live" } },
      { matches_by_pk: { id: "m1", status: "Finished" } },
    ]);
  });

  it("delivers a first live payload that differs from it", async () => {
    const { client, live, answer } = fakeClient();
    const next = vi.fn();

    seededSubscribe(client, { query: subscription }, { next });
    await answer({ matches_by_pk: { id: "m1", status: "Live" } });
    live({ matches_by_pk: { id: "m1", status: "Finished" } });

    expect(next).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenLastCalledWith({
      data: { matches_by_pk: { id: "m1", status: "Finished" } },
    });
  });

  it("ignores the query after the subscription is closed", async () => {
    const { client, answer } = fakeClient();
    const next = vi.fn();

    seededSubscribe(client, { query: subscription }, { next }).unsubscribe();
    await answer({ matches_by_pk: { id: "m1" } });

    expect(next).not.toHaveBeenCalled();
  });
});
