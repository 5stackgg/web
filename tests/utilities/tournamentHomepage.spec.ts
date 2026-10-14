// @vitest-environment node
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

  it("hides this site's bare address, whatever the port, case or trailing dot", () => {
    for (const homepage of [
      "https://5stack.gg",
      "5stack.gg",
      "http://5STACK.gg:8443/",
      "https://5stack.gg./",
      "https://5stack.gg/#top",
      "panel.lan",
    ]) {
      expect(tournamentHomepageLink(homepage, own), homepage).toBeNull();
    }
  });

  it("links a page on this site, like the event page the form suggests", () => {
    expect(tournamentHomepageLink("5stack.gg/events/abc", own)).toBe(
      "https://5stack.gg/events/abc",
    );
    expect(tournamentHomepageLink("https://panel.lan:3000/events/abc", own)).toBe(
      "https://panel.lan:3000/events/abc",
    );
    expect(tournamentHomepageLink("https://5stack.gg/?ref=cup", own)).toBe(
      "https://5stack.gg/?ref=cup",
    );
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

  it("drops an address with any scheme but http or https", () => {
    for (const homepage of [
      "ftp://files.nordic-lan.example/cup",
      "javascript://nordic-lan.example/%0Aalert(1)",
      "javascript:alert(1)",
      "data:text/html,hi",
      "mailto:cup@nordic-lan.example",
    ]) {
      expect(tournamentHomepageLink(homepage, own), homepage).toBeNull();
    }
  });

  it("does not mistake a host and port for a scheme", () => {
    expect(tournamentHomepageLink("localhost:8080/cup", own)).toBe(
      "https://localhost:8080/cup",
    );
  });

  it("drops what can't be read as an address", () => {
    for (const homepage of ["https://", "   "]) {
      expect(tournamentHomepageLink(homepage, own), homepage).toBeNull();
    }
  });

  it("is empty for no homepage", () => {
    expect(tournamentHomepageLink(null, own)).toBeNull();
    expect(tournamentHomepageLink(undefined, own)).toBeNull();
  });
});
