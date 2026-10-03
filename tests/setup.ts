import { afterAll, beforeEach } from "vitest";

// The app boots into its auth middleware, which asks the api who is signed in.
// There is no api here, and the retry link keeps re-sending a failed request
// for the rest of the file -- where it lands in whichever test is spying on
// fetch. So the boot is answered the way a signed-out visitor is, with a 401,
// which the retry link gives up on. Requests made once tests run are left
// alone.
let booting = true;

beforeEach(() => {
  booting = false;
});

if (typeof globalThis.fetch === "function") {
  const fetchFromEnvironment = globalThis.fetch;

  globalThis.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const url = String((input as Request)?.url ?? input);

    if (booting && url.includes("/v1/graphql")) {
      return Promise.resolve(
        new Response("{}", {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    return fetchFromEnvironment.call(globalThis, input, init);
  } as typeof fetch;
}

// vaul-vue's Drawer and plugins/preloader.client.ts leave real timers (up to
// 300ms) that read `document`, which the environment deletes on teardown.
afterAll(async () => {
  if (typeof document === "undefined") {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
});
