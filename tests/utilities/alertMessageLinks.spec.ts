import { describe, expect, it } from "vitest";
import { parseAlertMessage } from "~/utilities/alertMessageLinks";

const ownHosts = ["5stack.gg", "localhost:3000"];

describe("parseAlertMessage", () => {
  it("leaves plain text as a single text segment", () => {
    expect(parseAlertMessage("Matchmaking is down.", ownHosts)).toEqual([
      { type: "text", text: "Matchmaking is down." },
    ]);
  });

  it("returns nothing for an empty message", () => {
    expect(parseAlertMessage("", ownHosts)).toEqual([]);
  });

  it("turns a markdown link to another site into an external link", () => {
    expect(
      parseAlertMessage(
        "Read [the notes](https://example.com/notes).",
        ownHosts,
      ),
    ).toEqual([
      { type: "text", text: "Read " },
      {
        type: "external",
        href: "https://example.com/notes",
        label: "the notes",
      },
      { type: "text", text: "." },
    ]);
  });

  it("keeps a markdown label with spaces and punctuation", () => {
    expect(
      parseAlertMessage("[Status page, live!](https://status.example.com)", []),
    ).toEqual([
      {
        type: "external",
        href: "https://status.example.com/",
        label: "Status page, live!",
      },
    ]);
  });

  it("keeps balanced parentheses inside a markdown target", () => {
    expect(
      parseAlertMessage("[wiki](https://en.wikipedia.org/wiki/Dust_(map))", []),
    ).toEqual([
      {
        type: "external",
        href: "https://en.wikipedia.org/wiki/Dust_(map)",
        label: "wiki",
      },
    ]);
  });

  it("links a bare url with the url as its label", () => {
    expect(parseAlertMessage("See https://example.com/a?b=1#c", [])).toEqual([
      { type: "text", text: "See " },
      {
        type: "external",
        href: "https://example.com/a?b=1#c",
        label: "https://example.com/a?b=1#c",
      },
    ]);
  });

  it("leaves trailing punctuation after a bare url in the text", () => {
    expect(
      parseAlertMessage(
        "Go to https://example.com/x. Then https://example.com/y!",
        [],
      ),
    ).toEqual([
      { type: "text", text: "Go to " },
      {
        type: "external",
        href: "https://example.com/x",
        label: "https://example.com/x",
      },
      { type: "text", text: ". Then " },
      {
        type: "external",
        href: "https://example.com/y",
        label: "https://example.com/y",
      },
      { type: "text", text: "!" },
    ]);
  });

  it("drops an unbalanced closing paren after a bare url but keeps a balanced one", () => {
    expect(
      parseAlertMessage(
        "(see https://example.com/x) and https://example.com/a_(b),",
        [],
      ),
    ).toEqual([
      { type: "text", text: "(see " },
      {
        type: "external",
        href: "https://example.com/x",
        label: "https://example.com/x",
      },
      { type: "text", text: ") and " },
      {
        type: "external",
        href: "https://example.com/a_(b)",
        label: "https://example.com/a_(b)",
      },
      { type: "text", text: "," },
    ]);
  });

  it("ends a bare url at CJK text and full-width punctuation", () => {
    expect(
      parseAlertMessage("请访问 https://5stack.gg/tournaments。谢谢", ownHosts),
    ).toEqual([
      { type: "text", text: "请访问 " },
      {
        type: "internal",
        path: "/tournaments",
        label: "https://5stack.gg/tournaments",
      },
      { type: "text", text: "。谢谢" },
    ]);
    expect(
      parseAlertMessage("詳細は https://example.com/faq、または", []),
    ).toEqual([
      { type: "text", text: "詳細は " },
      {
        type: "external",
        href: "https://example.com/faq",
        label: "https://example.com/faq",
      },
      { type: "text", text: "、または" },
    ]);
    expect(
      parseAlertMessage("https://example.com/faq에서 확인하세요", []),
    ).toEqual([
      {
        type: "external",
        href: "https://example.com/faq",
        label: "https://example.com/faq",
      },
      { type: "text", text: "에서 확인하세요" },
    ]);
  });

  it("leaves markdown emphasis around a bare url in the text", () => {
    expect(parseAlertMessage("**https://example.com/faq**", [])).toEqual([
      { type: "text", text: "**" },
      {
        type: "external",
        href: "https://example.com/faq",
        label: "https://example.com/faq",
      },
      { type: "text", text: "**" },
    ]);
  });

  it("makes a root-relative target an internal link", () => {
    expect(
      parseAlertMessage(
        "[Tournaments](/tournaments?status=live#top)",
        ownHosts,
      ),
    ).toEqual([
      {
        type: "internal",
        path: "/tournaments?status=live#top",
        label: "Tournaments",
      },
    ]);
  });

  it("makes a link to this site an internal link, keeping query and hash", () => {
    expect(
      parseAlertMessage(
        "[Match](https://5stack.gg/matches/abc?tab=stats#round-3) or https://5STACK.gg/me",
        ownHosts,
      ),
    ).toEqual([
      {
        type: "internal",
        path: "/matches/abc?tab=stats#round-3",
        label: "Match",
      },
      { type: "text", text: " or " },
      { type: "internal", path: "/me", label: "https://5STACK.gg/me" },
    ]);
  });

  it("matches own hosts by port too", () => {
    expect(parseAlertMessage("http://localhost:3000/play", ownHosts)).toEqual([
      { type: "internal", path: "/play", label: "http://localhost:3000/play" },
    ]);
    expect(parseAlertMessage("http://localhost:4000/play", ownHosts)).toEqual([
      {
        type: "external",
        href: "http://localhost:4000/play",
        label: "http://localhost:4000/play",
      },
    ]);
  });

  it("treats a lookalike host as external", () => {
    expect(
      parseAlertMessage(
        "[a](https://5stack.gg.evil.test/x) [b](https://5stack.gg@evil.test/x)",
        ownHosts,
      ),
    ).toEqual([
      { type: "external", href: "https://5stack.gg.evil.test/x", label: "a" },
      { type: "text", text: " " },
      { type: "external", href: "https://5stack.gg@evil.test/x", label: "b" },
    ]);
  });

  it("never treats a protocol-relative target as internal", () => {
    expect(parseAlertMessage("[x](//evil.test/phish)", ownHosts)).toEqual([
      { type: "external", href: "https://evil.test/phish", label: "x" },
    ]);
    expect(parseAlertMessage("[x](/\\evil.test/phish)", ownHosts)).toEqual([
      { type: "external", href: "https://evil.test/phish", label: "x" },
    ]);
  });

  it("collapses a doubled leading slash on an own-host path", () => {
    expect(
      parseAlertMessage("[x](https://5stack.gg//evil.test/phish)", ownHosts),
    ).toEqual([{ type: "internal", path: "/evil.test/phish", label: "x" }]);
  });

  it("leaves javascript, data and other schemes as literal text", () => {
    const message =
      "[click](javascript:alert(1)) [img](data:text/html,hi) [mail](mailto:a@b.c) javascript:alert(1)";
    expect(parseAlertMessage(message, ownHosts)).toEqual([
      { type: "text", text: message },
    ]);
  });

  it("leaves a relative target without a leading slash as literal text", () => {
    expect(parseAlertMessage("[x](matches/abc)", ownHosts)).toEqual([
      { type: "text", text: "[x](matches/abc)" },
    ]);
  });

  it("does not link a bare url inside a markdown link twice", () => {
    expect(
      parseAlertMessage("[https://a.example](https://b.example)", []),
    ).toEqual([
      {
        type: "external",
        href: "https://b.example/",
        label: "https://a.example",
      },
    ]);
  });

  it("splits mixed text, markdown links, bare urls and newlines", () => {
    expect(
      parseAlertMessage(
        "Maintenance at 20:00.\nDetails: [status](/status), updates https://x.example/u.",
        ownHosts,
      ),
    ).toEqual([
      { type: "text", text: "Maintenance at 20:00.\nDetails: " },
      { type: "internal", path: "/status", label: "status" },
      { type: "text", text: ", updates " },
      {
        type: "external",
        href: "https://x.example/u",
        label: "https://x.example/u",
      },
      { type: "text", text: "." },
    ]);
  });

  it("ignores empty own hosts", () => {
    expect(
      parseAlertMessage("https://5stack.gg/x", ["", null, undefined]),
    ).toEqual([
      {
        type: "external",
        href: "https://5stack.gg/x",
        label: "https://5stack.gg/x",
      },
    ]);
  });
});
