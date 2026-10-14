// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { newsOutline, renderNewsArticle } from "~/utilities/newsMarkdown";

const post = [
  "<!--",
  "  Suggested Title  : Utility Library",
  "-->",
  "",
  "## Utility Library & Practice Servers",
  "",
  "Where to stand, where to aim, where it lands.",
  "",
  "### A library per map",
  "",
  "- **Filter it down** — utility type, side, technique.",
  "",
  "### Practice servers, one click",
  "",
  "Press **Practice** and you get your own server.",
  "",
  "### Practice servers, one click",
  "",
  "Twice, to check ids stay unique.",
  "",
  "---",
  "",
  "**Ready to stop guessing at smokes?** Open **Utility** and hit **Practice**.",
].join("\r\n");

describe("renderNewsArticle", () => {
  const article = renderNewsArticle(post, {
    anchorLabel: "Link to this section",
  });

  it("drops the heading that repeats the title, even under a comment and CRLF", () => {
    expect(article.html).not.toContain(
      "Utility Library &amp; Practice Servers",
    );
    expect(article.html).not.toContain("<h2");
    expect(article.html).not.toContain("Suggested Title");
    // (happy-dom's DOMPurify drops the first <p> wrapper; browsers keep it.)
    expect(article.html.indexOf("Where to stand")).toBeGreaterThan(-1);
    expect(article.html.indexOf("Where to stand")).toBeLessThan(
      article.html.indexOf("<h3"),
    );
  });

  it("lists ### headings as sections with unique ids", () => {
    expect(article.sections).toEqual([
      { id: "a-library-per-map", text: "A library per map" },
      { id: "practice-servers-one-click", text: "Practice servers, one click" },
      {
        id: "practice-servers-one-click-2",
        text: "Practice servers, one click",
      },
    ]);
    expect(article.html).toContain('<h3 id="a-library-per-map">');
    expect(article.html).toContain('<h3 id="practice-servers-one-click-2">');
    expect(article.html).toContain('aria-label="Link to this section"');
  });

  it("splits the closing line after the last rule into its own block", () => {
    expect(article.html).not.toContain("<hr");
    expect(article.html).not.toContain("Ready to stop guessing");
    expect(article.closingHtml).toContain(
      "<strong>Ready to stop guessing at smokes?</strong>",
    );
  });

  it("keeps a rule that is followed by more than a short sign-off", () => {
    const longTail = renderNewsArticle(
      "Intro\n\n---\n\n### After\n\nMore text\n\n- a\n- b",
      { anchorLabel: "" },
    );
    expect(longTail.closingHtml).toBe("");
    expect(longTail.html).toContain("<hr");
  });

  it("reads at least one minute", () => {
    expect(article.minutes).toBe(1);
  });
});

describe("newsOutline", () => {
  it("gives sections and read time without rendering", () => {
    const outline = newsOutline(post);
    expect(outline.sections.map((section) => section.text)).toEqual([
      "A library per map",
      "Practice servers, one click",
      "Practice servers, one click",
    ]);
    expect(outline.minutes).toBe(1);
  });

  it("estimates longer posts at 230 words a minute", () => {
    expect(newsOutline(Array(920).fill("word").join(" ")).minutes).toBe(4);
  });

  it("handles an empty post", () => {
    expect(newsOutline(null)).toEqual({ sections: [], minutes: 1 });
  });
});
