import { describe, expect, it } from "vitest";
import { bionicizeHtmlFragment, toBionicHtmlText, toBionicPlainText } from "../src/bionic/engine";

describe("Bionic Reading engine", () => {
  it("preserves punctuation, capitalization, and spacing", () => {
    const input = "Hello,  world!\nThis is a test.";
    const html = toBionicHtmlText(input, { intensity: "medium" });

    expect(html).toContain(",  ");
    expect(html).toContain("!\n");
    expect(html.replace(/<[^>]+>/g, "")).toBe(input);
  });

  it("skips very short words at medium strength", () => {
    const html = toBionicHtmlText("go to the library", { intensity: "medium" });

    expect(html).toContain("go");
    expect(html).toContain("to");
    expect(html).toContain("<strong class=\"br-fixation\">th</strong>e");
    expect(html).toContain("<strong class=\"br-fixation\">libr</strong>ary");
  });

  it("escapes unsafe text while preserving readable content", () => {
    const html = toBionicHtmlText("Read <this> & that", { intensity: "strong" });

    expect(html).toContain("&lt;");
    expect(html).toContain("&amp;");
    expect(html).not.toContain("<this>");
  });

  it("transforms text nodes without removing document structure", () => {
    const html = bionicizeHtmlFragment("<h1>Chapter One</h1><p>Readable words stay ordered.</p>");

    expect(html).toContain("<h1>");
    expect(html).toContain("</p>");
    expect(html.replace(/<[^>]+>/g, "")).toBe("Chapter OneReadable words stay ordered.");
  });

  it("uses Unicode bold characters for text-only output without adding marker characters", () => {
    const text = toBionicPlainText("Focus faster", { intensity: "medium" });

    expect(text).not.toContain("**");
    expect(text.length).toBeGreaterThan("Focus faster".length);
  });
});
