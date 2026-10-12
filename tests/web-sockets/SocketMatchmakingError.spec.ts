import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import socket from "~/web-sockets/Socket";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast,
}));

const i18n = () => (useNuxtApp() as any).$i18n;

const description = () => toast.mock.calls.at(-1)?.[0]?.description;

describe("Socket matchmaking:error", () => {
  beforeEach(() => {
    toast.mockClear();
  });

  afterEach(async () => {
    await i18n().setLocale("en");
  });

  it("says the lobby is already queued in the viewer's language", async () => {
    await i18n().setLocale("de");

    socket.emit("matchmaking:error", {
      code: "already_queued",
      message: "Your lobby is already in the queue",
    });

    expect(description()).toBe("Deine Lobby ist bereits in der Queue.");
    expect(toast.mock.calls.at(-1)?.[0]).toMatchObject({
      variant: "destructive",
      title: "Fehler",
    });
  });

  it("names the player who is already in a match", async () => {
    await i18n().setLocale("pl");

    socket.emit("matchmaking:error", {
      code: "player_in_match",
      name: "kairo",
      message: "kairo is already in a match",
    });

    expect(description()).toBe("kairo jest już w meczu.");
  });

  it("reads the same in English", () => {
    socket.emit("matchmaking:error", {
      code: "player_in_match",
      name: "kairo",
      message: "kairo is already in a match",
    });

    expect(description()).toBe("kairo is already in a match.");
  });

  it("shows the api's own words for a code it does not know", async () => {
    await i18n().setLocale("de");

    socket.emit("matchmaking:error", {
      code: "region_closed",
      message: "That region is closed",
    });

    expect(description()).toBe("That region is closed");
  });

  it("shows the api's own words when an older api sends no code", () => {
    socket.emit("matchmaking:error", { message: "Unknown Error" });

    expect(description()).toBe("Unknown Error");
  });

  it("shows the api's own words when the player's name is missing", () => {
    socket.emit("matchmaking:error", {
      code: "player_in_match",
      message: "A teammate is already in a match",
    });

    expect(description()).toBe("A teammate is already in a match");
  });
});
