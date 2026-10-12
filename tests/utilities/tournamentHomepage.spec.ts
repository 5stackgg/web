import { describe, expect, it } from "vitest";
import { tournamentHomepageLink } from "~/utilities/tournamentHomepage";

const own = ["5stack.gg", "panel.lan:3000"];

describe("tournamentHomepageLink", () => {
  it("adds https to an address typed without a scheme", () => {
    expect(tournamentHomepageLink("nordic-lan.example/open", own)).toBe(
      "https://nordic-lan.example/open",
    );
  });

  it("keeps a port on an address typed without a scheme", () => {
    expect(tournamentHomepageLink("nordic-lan.example:8080/cup", own)).toBe(
      "https://nordic-lan.example:8080/cup",
    );
  });

  it("reads an upper-case scheme as a scheme", () => {
    expect(tournamentHomepageLink("HTTPS://Nordic-LAN.example", own)).toBe(
      "https://nordic-lan.example/",
    );
  });

  it("hides this site, whatever the path, port, case or trailing dot", () => {
    for (const homepage of [
      "https://5stack.gg",
      "5stack.gg/tournaments/t-1",
      "http://5STACK.gg:8443/",
      "https://5stack.gg./",
      "panel.lan/tournaments",
    ]) {
      expect(tournamentHomepageLink(homepage, own), homepage).toBeNull();
    }
  });

  it("links another site on a sub-domain of ours", () => {
    expect(tournamentHomepageLink("https://events.5stack.gg", own)).toBe(
      "https://events.5stack.gg/",
    );
  });

  it("drops addresses carrying credentials", () => {
    for (const homepage of [
      "https://admin:hunter2@nordic-lan.example/",
      "https://admin@nordic-lan.example/",
      "nordic-lan.example@5stack.gg",
    ]) {
      expect(tournamentHomepageLink(homepage, own), homepage).toBeNull();
    }
  });

  it("drops anything that is not a web address", () => {
    for (const homepage of [
      "javascript:alert(1)",
      "data:text/html,hi",
      "https://",
      "   ",
    ]) {
      expect(tournamentHomepageLink(homepage, own), homepage).toBeNull();
    }
  });

  it("is empty for no homepage", () => {
    expect(tournamentHomepageLink(null, own)).toBeNull();
    expect(tournamentHomepageLink(undefined, own)).toBeNull();
  });
});
