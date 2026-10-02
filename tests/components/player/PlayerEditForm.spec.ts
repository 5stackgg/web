import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayerEditForm from "~/components/player/PlayerEditForm.vue";
import ImageUploadTile from "~/components/ImageUploadTile.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast: toastMock,
}));

const HINT = "An admin approves name changes before they show.";

const player = {
  steam_id: "76561198000000001",
  name: "kairo",
  country: "US",
  avatar_url: null,
  custom_avatar_url: null,
  roster_image_url: null,
};

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;
let mutate: ReturnType<typeof vi.fn>;

function signIn(role: e_player_roles_enum) {
  useAuthStore().me = { steam_id: player.steam_id, role } as any;
}

async function mountForm(props: Record<string, unknown> = {}) {
  wrapper = await mountSuspended(PlayerEditForm, {
    props: { player, canEditName: true, canEditCountry: true, ...props },
    global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
  });
  await flushPromises();
  return wrapper;
}

function button(form: NonNullable<typeof wrapper>, label: string) {
  return form.findAll("button").find((b) => b.text().includes(label));
}

function mutationsSent() {
  return mutate.mock.calls.map(([options]) =>
    JSON.stringify(options.mutation),
  );
}

beforeEach(() => {
  toastMock.mockClear();
  mutate = vi
    .spyOn((useNuxtApp() as any).$apollo.defaultClient, "mutate")
    .mockResolvedValue({ data: {} }) as any;
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

describe("PlayerEditForm", () => {
  it("shows no save bar until something changes", async () => {
    signIn(e_player_roles_enum.user);
    const form = await mountForm();

    expect(button(form, "Save changes")).toBeUndefined();

    await form.find("#player-edit-name").setValue("kairo_");

    expect(button(form, "Save changes")).toBeDefined();
  });

  it("sends a player's new name as a request and marks it pending", async () => {
    signIn(e_player_roles_enum.user);
    const form = await mountForm();

    await form.find("#player-edit-name").setValue("kairo_");
    expect(form.text()).toContain(HINT);

    await button(form, "Save changes")!.trigger("click");
    await flushPromises();

    expect(mutationsSent()).toHaveLength(1);
    expect(mutationsSent()[0]).toContain("requestNameChange");
    expect(toastMock).toHaveBeenCalledWith({
      title: "Name change requested",
      description:
        "Your new name shows once an admin approves it. We'll notify you either way.",
    });
    expect(form.text()).toContain("Pending: kairo_");
    expect(
      (form.find("#player-edit-name").element as HTMLInputElement).value,
    ).toBe("kairo");
  });

  it("saves an admin's name change directly", async () => {
    signIn(e_player_roles_enum.administrator);
    const form = await mountForm();

    await form.find("#player-edit-name").setValue("kairo_");
    expect(form.text()).not.toContain(HINT);

    await button(form, "Save changes")!.trigger("click");
    await flushPromises();

    expect(mutationsSent()).toHaveLength(1);
    expect(mutationsSent()[0]).toContain("update_players_by_pk");
    expect(mutate.mock.calls[0][0].variables).toEqual({ name: "kairo_" });
    expect(toastMock).toHaveBeenCalledWith({ title: "Player updated" });
  });

  it("blocks saving a name that is too short and says why", async () => {
    signIn(e_player_roles_enum.user);
    const form = await mountForm();

    await form.find("#player-edit-name").setValue("ka");

    expect(form.text()).toContain("Names need 3 to 32 characters.");
    expect(
      button(form, "Save changes")!.attributes("disabled"),
    ).toBeDefined();
  });

  it("keeps an edit in progress when the player updates live", async () => {
    signIn(e_player_roles_enum.user);
    const form = await mountForm();

    await form.find("#player-edit-name").setValue("kairo_");
    await form.setProps({ player: { ...player, country: "DE" } });

    expect(
      (form.find("#player-edit-name").element as HTMLInputElement).value,
    ).toBe("kairo_");
  });

  it("discard restores the saved name", async () => {
    signIn(e_player_roles_enum.user);
    const form = await mountForm();

    await form.find("#player-edit-name").setValue("kairo_");
    await button(form, "Discard")!.trigger("click");

    expect(
      (form.find("#player-edit-name").element as HTMLInputElement).value,
    ).toBe("kairo");
    expect(button(form, "Save changes")).toBeUndefined();
  });

  it("explains the roster fallback and offers a reset only for custom avatars", async () => {
    signIn(e_player_roles_enum.user);
    const form = await mountForm({ canEditAvatar: true });

    expect(form.text()).toContain("Using avatar");
    expect(form.text()).not.toContain("Use Steam avatar");

    await form.setProps({
      player: { ...player, custom_avatar_url: "avatars/players/1.webp" },
    });

    expect(form.text()).toContain("Use Steam avatar");
  });

  it("offers to copy a new roster image to the player's teams after upload", async () => {
    signIn(e_player_roles_enum.user);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ path: "p" })));
    const form = await mountForm({
      canEditAvatar: true,
      bulkTeams: [
        { teamId: "t1", teamName: "Blue Rabbits", hasCustomImage: false },
        { teamId: "t2", teamName: "Night Owls", hasCustomImage: true },
      ],
    });

    expect(form.text()).not.toContain("Also apply to your teams");

    const roster = form
      .findAllComponents(ImageUploadTile)
      .find((tile) => tile.props("mode") === "roster")!;
    roster.vm.$emit("uploaded", "roster.webp", new Blob(["x"]));
    await flushPromises();

    expect(form.text()).toContain("Also apply to your teams");
    expect(button(form, "Blue Rabbits")!.attributes("aria-pressed")).toBe(
      "true",
    );
    expect(button(form, "Night Owls")!.attributes("aria-pressed")).toBe(
      "false",
    );

    await button(form, "Apply")!.trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/avatars/roster-teams/t1/76561198000000001",
    );
    expect(toastMock).toHaveBeenCalledWith({ title: "Applied to 1 team(s)" });
    expect(form.text()).not.toContain("Also apply to your teams");
  });
});
