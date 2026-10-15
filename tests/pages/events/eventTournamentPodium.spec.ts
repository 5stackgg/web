import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { provideApolloClient } from "@vue/apollo-composable";
import { print } from "graphql";
import type { FieldNode, OperationDefinitionNode } from "graphql";
import EventPage from "~/pages/events/[eventId]/index.vue";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";

const { schema } = vi.hoisted(() => ({
  schema: { podium: false, asked: [] as string[] },
}));

vi.mock("~/utilities/schemaHasType", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/utilities/schemaHasType")>()),
  schemaHasField: vi.fn(async (_client: unknown, type: string, field: string) => {
    schema.asked.push(`${type}.${field}`);
    return type === "tournaments" && field === "podium" && schema.podium;
  }),
}));

let subscriptions: string[] = [];
let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;

function rootField(query: any) {
  const operation = query.definitions[0] as OperationDefinitionNode;
  return (operation.selectionSet.selections[0] as FieldNode).name.value;
}

// The fields the event's tournaments are asked for.
function tournamentFields(query: string) {
  const start = query.indexOf("tournament {");
  return query.slice(start, query.indexOf("\n      }", start));
}

async function mountEvent() {
  wrapper = await mountSuspended(EventPage, {
    route: `/events/${EVENT_ID}`,
    global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
  });
  await flushPromises();
  return subscriptions;
}

beforeEach(() => {
  subscriptions = [];
  schema.asked = [];
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  provideApolloClient(client);
  vi.spyOn(client, "query").mockResolvedValue({ data: {} } as any);
  vi.spyOn(client, "subscribe").mockImplementation((options: any) => {
    if (rootField(options.query) === "events_by_pk") {
      subscriptions.push(print(options.query));
    }
    return {
      subscribe: () => ({ unsubscribe() {}, closed: false }),
    } as any;
  });
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.restoreAllMocks();
});

describe("event page tournaments", () => {
  it("asks for each tournament's podium when the api has it", async () => {
    schema.podium = true;

    const sent = await mountEvent();

    expect(schema.asked).toContain("tournaments.podium");
    expect(sent).toHaveLength(1);
    expect(tournamentFields(sent[0])).toMatch(/\bpodium\b/);
  });

  it("leaves the podium out when the api doesn't have it", async () => {
    schema.podium = false;

    const sent = await mountEvent();

    expect(sent).toHaveLength(1);
    expect(tournamentFields(sent[0])).toContain("awards_enabled");
    expect(tournamentFields(sent[0])).not.toMatch(/\bpodium\b/);
  });
});
