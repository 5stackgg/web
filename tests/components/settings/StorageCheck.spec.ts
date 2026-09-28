import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import StorageCheck from "~/components/settings/StorageCheck.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

const TEST_FILE = "https://bucket.acme.gg/hello.txt?signature=abc";

const { mutations } = vi.hoisted(() => ({
  mutations: {} as Record<string, () => Promise<any>>,
}));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({
    client: {
      mutate: ({ mutation }: any) => {
        const query = print(mutation);
        const name = Object.keys(mutations).find((key) => query.includes(key));
        return mutations[name!]();
      },
    },
  }),
}));

const readFile = vi.fn();
const health = vi.fn();
const realFetch = globalThis.fetch;

const stage = (wrapper: any, id: string) =>
  wrapper.find(`[data-test="storage-check-${id}"]`);

async function runCheck(workerUrl: string | null) {
  useApplicationSettingsStore().settings = workerUrl
    ? [{ name: "cloudflare_worker_url", value: workerUrl }]
    : [];
  const wrapper = await mountSuspended(StorageCheck);
  await wrapper.find('[data-test="storage-check-run"]').trigger("click");
  await flushPromises();
  return wrapper;
}

describe("StorageCheck", () => {
  beforeEach(() => {
    mutations.testUpload = async () => ({ data: { testUpload: { error: null } } });
    mutations.getTestUploadLink = async () => ({
      data: { getTestUploadLink: { link: TEST_FILE, error: null } },
    });
    readFile
      .mockReset()
      .mockImplementation(
        async () => new Response("world : 2026-09-28T12:00:00.000Z"),
      );
    health.mockReset().mockImplementation(async () =>
      Response.json({
        ok: true,
        worker: "5stack-backblaze-proxy",
        version: "1",
        bucket: "ok",
        code: "AccessDenied",
      }),
    );
    globalThis.fetch = vi.fn(async (input: any) => {
      if (String(input) === TEST_FILE) {
        return readFile();
      }
      if (String(input) === "https://cf.acme.gg/demo/_health") {
        return health();
      }
      return new Response(null, { status: 404 });
    }) as any;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("writes, reads back and checks the worker", async () => {
    const wrapper = await runCheck("https://cf.acme.gg");

    expect(stage(wrapper, "write").attributes("data-state")).toBe("ok");
    expect(stage(wrapper, "read").attributes("data-state")).toBe("ok");
    expect(stage(wrapper, "edge").attributes("data-state")).toBe("ok");
    expect(stage(wrapper, "edge").text()).toContain("Through cf.acme.gg");
  });

  it("leaves out the edge stage without a worker", async () => {
    const wrapper = await runCheck(null);

    expect(stage(wrapper, "write").exists()).toBe(true);
    expect(stage(wrapper, "edge").exists()).toBe(false);
  });

  it("skips the read when the write fails", async () => {
    mutations.testUpload = async () => ({
      data: { testUpload: { error: "Access Denied" } },
    });

    const wrapper = await runCheck(null);

    expect(stage(wrapper, "write").attributes("data-state")).toBe("fail");
    expect(stage(wrapper, "write").text()).toContain("Access Denied");
    expect(stage(wrapper, "read").attributes("data-state")).toBe("skipped");
    expect(readFile).not.toHaveBeenCalled();
  });

  it("hands over the file when the browser can't read the bucket", async () => {
    readFile.mockRejectedValue(new TypeError("Failed to fetch"));

    const wrapper = await runCheck(null);

    expect(stage(wrapper, "read").attributes("data-state")).toBe("manual");
    expect(stage(wrapper, "read").find("a").attributes("href")).toBe(TEST_FILE);
  });

  it("fails the edge stage when Backblaze rejects the worker's keys", async () => {
    health.mockImplementation(async () =>
      Response.json({
        ok: false,
        worker: "5stack-backblaze-proxy",
        version: "1",
        bucket: "rejected",
        code: "InvalidAccessKeyId",
      }),
    );

    const wrapper = await runCheck("https://cf.acme.gg");

    expect(stage(wrapper, "edge").attributes("data-state")).toBe("fail");
    expect(stage(wrapper, "edge").text()).toContain(
      "Keys rejected (InvalidAccessKeyId)",
    );
  });
});
