// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { ApolloLink, execute, from, type Operation } from "@apollo/client/core";
import { Observable, type Observer } from "@apollo/client/utilities";
import {
  OperationTypeNode,
  parse,
  type OperationDefinitionNode,
} from "graphql";
import { createSeedLink } from "~/graphql/seedLink";

const subscription = parse(
  "subscription Match($id: uuid!) { matches_by_pk(id: $id) { id status } }",
);

function endpoint() {
  const operations: Operation[] = [];
  const observers: Observer<any>[] = [];
  const closed = vi.fn();
  const link = new ApolloLink(
    (operation) =>
      new Observable((observer) => {
        operations.push(operation);
        observers.push(observer);
        return closed;
      }),
  );
  return {
    link,
    operations,
    closed,
    answer: (data: unknown) => observers.at(-1)!.next!({ data }),
    answerWith: (result: unknown) => observers.at(-1)!.next!(result),
    fail: (error: unknown) => observers.at(-1)!.error!(error),
  };
}

let matchNumber = 0;

function seeded(
  seed: unknown = true,
  query = subscription,
  variables: Record<string, unknown> = { id: `m${++matchNumber}` },
) {
  const http = endpoint();
  const socket = endpoint();
  const results: unknown[] = [];
  const errors: unknown[] = [];
  const subscriptionHandle = execute(
    from([createSeedLink(http.link), socket.link]),
    { query, variables, context: { seed } },
  ).subscribe({
    next: (result) => results.push(result.data),
    error: (error) => errors.push(error),
  });
  return { http, socket, results, errors, subscriptionHandle, variables };
}

const row = (status: string) => ({ matches_by_pk: { id: "m1", status } });

describe("seed link", () => {
  it("sends the subscription's selection as an HTTP query", () => {
    const { http, socket, variables } = seeded();

    const operation = http.operations[0].query
      .definitions[0] as OperationDefinitionNode;
    expect(operation.operation).toBe(OperationTypeNode.QUERY);
    expect(operation.selectionSet).toBe(
      (subscription.definitions[0] as OperationDefinitionNode).selectionSet,
    );
    expect(http.operations[0].variables).toEqual(variables);
    expect(socket.operations).toHaveLength(1);
  });

  it("renders the HTTP answer when it beats the socket", () => {
    const { http, results } = seeded();

    http.answer(row("Live"));

    expect(results).toEqual([row("Live")]);
  });

  it("drops the HTTP answer once the socket has answered", () => {
    const { http, socket, results } = seeded();

    socket.answer(row("Live"));
    http.answer(row("Veto"));

    expect(results).toEqual([row("Live")]);
  });

  it("skips a first socket payload that repeats the HTTP answer", () => {
    const { http, socket, results } = seeded();

    http.answer(row("Live"));
    socket.answer(row("Live"));
    socket.answer(row("Live"));

    expect(results).toEqual([row("Live"), row("Live")]);
  });

  it("delivers a first socket payload that differs from it", () => {
    const { http, socket, results } = seeded();

    http.answer(row("Live"));
    socket.answer(row("Finished"));

    expect(results).toEqual([row("Live"), row("Finished")]);
  });

  it("lets a refused HTTP answer through to the socket instead", () => {
    const seed = vi.fn((data: any) => data.matches_by_pk.status !== "Veto");
    const { http, socket, results } = seeded(seed);

    http.answer(row("Veto"));
    socket.answer(row("Veto"));

    expect(seed).toHaveBeenCalledWith(row("Veto"));
    expect(results).toEqual([row("Veto")]);
  });

  it("ignores an HTTP failure and still delivers the socket", () => {
    const { http, socket, results, errors } = seeded();

    http.fail(new Error("offline"));
    socket.answer(row("Live"));

    expect(errors).toEqual([]);
    expect(results).toEqual([row("Live")]);
  });

  it("passes socket errors through", () => {
    const { socket, errors } = seeded();
    const error = new Error("socket closed");

    socket.fail(error);

    expect(errors).toEqual([error]);
  });

  it("stops seeding while the socket is failing, until it recovers", () => {
    const first = seeded();
    first.socket.fail(new Error("poll failed"));

    const restart = seeded(true, subscription, first.variables);
    expect(restart.http.operations).toHaveLength(0);
    restart.socket.answer(row("Live"));
    expect(restart.results).toEqual([row("Live")]);

    const afterRecovery = seeded(true, subscription, first.variables);
    expect(afterRecovery.http.operations).toHaveLength(1);
  });

  it("counts a socket payload carrying errors as a failure", () => {
    const first = seeded();
    first.socket.answerWith({ data: null, errors: [{ message: "timeout" }] });

    const restart = seeded(true, subscription, first.variables);

    expect(restart.http.operations).toHaveLength(0);
  });

  it("closes both requests when the caller unsubscribes", () => {
    const { http, socket, subscriptionHandle } = seeded();

    subscriptionHandle.unsubscribe();

    expect(http.closed).toHaveBeenCalled();
    expect(socket.closed).toHaveBeenCalled();
  });

  it("leaves unseeded subscriptions and queries alone", () => {
    const unseeded = seeded(false);
    const query = seeded(true, parse("query { matches { id } }"));

    expect(unseeded.http.operations).toHaveLength(0);
    expect(query.http.operations).toHaveLength(0);
    expect(unseeded.socket.operations).toHaveLength(1);
    expect(query.socket.operations).toHaveLength(1);
  });
});
