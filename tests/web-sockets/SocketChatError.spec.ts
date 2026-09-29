import { beforeEach, describe, expect, it, vi } from "vitest";
import socket from "~/web-sockets/Socket";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast,
}));

describe("Socket chat:error", () => {
  beforeEach(() => {
    toast.mockClear();
  });

  it("toasts the limit for a message that is too long", () => {
    socket.emit("chat:error", { code: "too_long", max: 2000, requestId: "r" });

    expect(toast).toHaveBeenCalledWith({
      title: "Failed to send message",
      description: "Messages can be up to 2000 characters.",
      variant: "destructive",
    });
  });

  it.each(["not_allowed", "invalid", "gagged"])(
    "toasts a failed send for %s",
    (code) => {
      socket.emit("chat:error", { code });

      expect(toast).toHaveBeenCalledWith({
        title: "Failed to send message",
        description: undefined,
        variant: "destructive",
      });
    },
  );
});
