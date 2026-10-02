import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayerChangeName from "~/components/PlayerChangeName.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast: toastMock,
}));

const HINT = "An admin approves name changes before they show.";

const player = { steam_id: "76561198000000001", name: "kairo" };

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;

function signIn(role: e_player_roles_enum) {
  useAuthStore().me = { steam_id: player.steam_id, role } as any;
}

async function mountField() {
  wrapper = await mountSuspended(PlayerChangeName, {
    props: { player },
    global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
  });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  toastMock.mockClear();
  vi.spyOn(
    (useNuxtApp() as any).$apollo.defaultClient,
    "mutate",
  ).mockResolvedValue({ data: {} });
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

describe("PlayerChangeName", () => {
  it("tells a player that an admin approves the new name", async () => {
    signIn(e_player_roles_enum.user);

    expect((await mountField()).text()).toContain(HINT);
  });

  it("shows no approval hint to an admin, whose change applies directly", async () => {
    signIn(e_player_roles_enum.administrator);

    expect((await mountField()).text()).not.toContain(HINT);
  });

  it("explains what happens next once the request is sent", async () => {
    signIn(e_player_roles_enum.user);
    const field = await mountField();

    await field.find("input").setValue("kairo_");
    await field.find("form").trigger("submit");
    await flushPromises();

    expect(toastMock).toHaveBeenCalledWith({
      title: "Name change requested",
      description:
        "Your new name shows once an admin approves it. We'll notify you either way.",
    });
  });
});
