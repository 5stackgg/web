// @vitest-environment node
import { describe, expect, it } from "vitest";
import { connectAddress } from "~/utilities/connectAddress";

describe("connectAddress", () => {
  // The page printed host:port while Copy and Join used the relay.
  it("shows the Steam relay address the connect string uses", () => {
    expect(
      connectAddress(
        "connect 90270873413369866; password hunter2",
        "76.139.106.28",
        30026,
      ),
    ).toEqual("90270873413369866");
  });

  it("shows host and port when the server is not on the relay", () => {
    expect(
      connectAddress("connect 76.139.106.28:30026", "76.139.106.28", 30026),
    ).toEqual("76.139.106.28:30026");
  });

  it("falls back to host and port when there is no connect string", () => {
    expect(connectAddress(null, "76.139.106.28", 30026)).toEqual(
      "76.139.106.28:30026",
    );
  });
});
