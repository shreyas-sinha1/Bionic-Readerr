import * as cheerio from "cheerio";
import type { AnyNode, Element, Text } from "domhandler";
import sanitizeHtml from "sanitize-html";
import type { BionicOptions, Intensity } from "@/src/types/conversion";

const FIXATION_BY_INTENSITY: Record<Intensity, number> = {
  weak: 0.4,
  medium: 0.5,
  strong: 0.6
};

const MIN_WORD_BY_INTENSITY: Record<Intensity, number> = {
  weak: 3,
  medium: 2,
  strong: 1
};

const SKIP_PARENT_TAGS = new Set(["script", "style", "textarea", "code", "pre", "kbd", "samp"]);

export function normalizeBionicOptions(options?: Partial<BionicOptions>): BionicOptions {
  const intensity = options?.intensity ?? "medium";
  return {
    intensity,
    fixationPercent: clamp(options?.fixationPercent ?? FIXATION_BY_INTENSITY[intensity], 0.25, 0.75),
    minWordLength: Math.max(0, options?.minWordLength ?? MIN_WORD_BY_INTENSITY[intensity])
  };
}

export function toBionicHtmlText(input: string, options?: Partial<BionicOptions>): string {
  const normalized = normalizeBionicOptions(options);
  return segmentWords(input)
    .map((part) => {
      if (!part.isWordLike) {
        return escapeHtml(part.segment);
      }

      return renderBionicHtmlWord(part.segment, normalized);
    })
    .join("");
}

export function toBionicPlainText(input: string, options?: Partial<BionicOptions>): string {
  const normalized = normalizeBionicOptions(options);
  return segmentWords(input)
    .map((part) => {
      if (!part.isWordLike) {
        return part.segment;
      }

      return renderBionicPlainWord(part.segment, normalized);
    })
    .join("");
}

export function bionicizeHtmlFragment(html: string, options?: Partial<BionicOptions>): string {
  const safeHtml = sanitizeConvertedHtml(html);
  const $ = cheerio.load(safeHtml, { xmlMode: false }, false);

  const rootNodes = $.root().contents().toArray();
  for (const node of rootNodes) {
    transformTextNodes($, node, options);
  }

  return $.root().html() ?? "";
}

export function plainTextToBionicHtml(text: string, options?: Partial<BionicOptions>): string {
  return `<div class="br-plain-text">${toBionicHtmlText(text, options)}</div>`;
}

export function sanitizeConvertedHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "address",
      "article",
      "aside",
      "caption",
      "col",
      "colgroup",
      "del",
      "details",
      "figcaption",
      "figure",
      "footer",
      "header",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "ins",
      "main",
      "mark",
      "nav",
      "section",
      "span",
      "sub",
      "sup",
      "summary",
      "table",
      "tbody",
      "td",
      "tfoot",
      "th",
      "thead",
      "tr"
    ],
    allowedAttributes: {
      "*": ["class", "style", "id", "title", "align", "colspan", "rowspan", "scope", "start", "type"],
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"]
    },
    allowedSchemes: ["http", "https", "mailto", "data"],
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i, /^rgba\(/i, /^[a-z]+$/i],
        "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i, /^rgba\(/i, /^[a-z]+$/i],
        "font-size": [/^\d+(\.\d+)?(px|pt|em|rem|%)$/i],
        "font-family": [/^[\w\s"',.-]+$/i],
        "font-weight": [/^\d+$/, /^bold$/i, /^normal$/i],
        "font-style": [/^italic$/i, /^normal$/i],
        "text-align": [/^left$/i, /^right$/i, /^center$/i, /^justify$/i],
        "text-decoration": [/^[\w\s-]+$/i],
        "vertical-align": [/^[\w\s%.-]+$/i],
        display: [/^[\w-]+$/i],
        position: [/^absolute$/i, /^relative$/i],
        left: [/^[\d.-]+(px|pt|%)$/i],
        top: [/^[\d.-]+(px|pt|%)$/i],
        width: [/^[\d.-]+(px|pt|%|in|cm|mm)$/i],
        height: [/^[\d.-]+(px|pt|%|in|cm|mm)$/i],
        transform: [/^[\w\d\s().,+-]+$/i],
        "transform-origin": [/^[\w\d\s%.-]+$/i],
        "white-space": [/^[\w-]+$/i],
        "line-height": [/^[\d.]+(px|pt|em|rem|%)?$/i],
        margin: [/^[\d.\s-]+(px|pt|em|rem|%)?$/i],
        "margin-top": [/^[\d.-]+(px|pt|em|rem|%)$/i],
        "margin-right": [/^[\d.-]+(px|pt|em|rem|%)$/i],
        "margin-bottom": [/^[\d.-]+(px|pt|em|rem|%)$/i],
        "margin-left": [/^[\d.-]+(px|pt|em|rem|%)$/i],
        padding: [/^[\d.\s-]+(px|pt|em|rem|%)?$/i],
        border: [/^[\w\d\s().,#%-]+$/i],
        "border-collapse": [/^collapse$/i, /^separate$/i]
      }
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true)
    }
  });
}

function transformTextNodes($: cheerio.CheerioAPI, node: AnyNode, options?: Partial<BionicOptions>): void {
  if (node.type === "text") {
    const textNode = node as Text;
    if (!textNode.data.trim()) {
      return;
    }

    const parent = textNode.parent as Element | null;
    if (parent?.name && SKIP_PARENT_TAGS.has(parent.name.toLowerCase())) {
      return;
    }

    const replacement = toBionicHtmlText(textNode.data, options);
    $(textNode).replaceWith(replacement);
    return;
  }

  if ("children" in node && Array.isArray(node.children)) {
    const element = node as Element;
    if (element.name && SKIP_PARENT_TAGS.has(element.name.toLowerCase())) {
      return;
    }

    for (const child of [...node.children]) {
      transformTextNodes($, child, options);
    }
  }
}

function renderBionicHtmlWord(word: string, options: BionicOptions): string {
  const graphemes = splitGraphemes(word);
  if (graphemes.length <= options.minWordLength!) {
    return escapeHtml(word);
  }

  const boldCount = getBoldGraphemeCount(graphemes.length, options.fixationPercent!);
  const prefix = graphemes.slice(0, boldCount).join("");
  const suffix = graphemes.slice(boldCount).join("");

  return `<strong class="br-fixation">${escapeHtml(prefix)}</strong>${escapeHtml(suffix)}`;
}

function renderBionicPlainWord(word: string, options: BionicOptions): string {
  const graphemes = splitGraphemes(word);
  if (graphemes.length <= options.minWordLength!) {
    return word;
  }

  const boldCount = getBoldGraphemeCount(graphemes.length, options.fixationPercent!);
  const prefix = graphemes.slice(0, boldCount).map(toMathematicalBold).join("");
  const suffix = graphemes.slice(boldCount).join("");
  return `${prefix}${suffix}`;
}

function getBoldGraphemeCount(length: number, fixationPercent: number): number {
  return Math.max(1, Math.min(length - 1, Math.ceil(length * fixationPercent)));
}

function segmentWords(input: string): Array<{ segment: string; isWordLike: boolean }> {
  const Segmenter = Intl.Segmenter;
  if (Segmenter) {
    const segmenter = new Segmenter(undefined, { granularity: "word" });
    return [...segmenter.segment(input)].map((part) => ({
      segment: part.segment,
      isWordLike: Boolean(part.isWordLike)
    }));
  }

  const parts: Array<{ segment: string; isWordLike: boolean }> = [];
  const regex = /[\p{L}\p{N}\p{M}]+|[^\p{L}\p{N}\p{M}]+/gu;
  for (const match of input.matchAll(regex)) {
    const segment = match[0];
    parts.push({
      segment,
      isWordLike: /^[\p{L}\p{N}\p{M}]+$/u.test(segment)
    });
  }
  return parts;
}

function splitGraphemes(input: string): string[] {
  const Segmenter = Intl.Segmenter;
  if (Segmenter) {
    const segmenter = new Segmenter(undefined, { granularity: "grapheme" });
    return [...segmenter.segment(input)].map((part) => part.segment);
  }

  return Array.from(input);
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toMathematicalBold(input: string): string {
  if (input.length !== 1) {
    return input;
  }

  const code = input.codePointAt(0);
  if (code === undefined) {
    return input;
  }

  if (code >= 65 && code <= 90) {
    return String.fromCodePoint(0x1d400 + (code - 65));
  }

  if (code >= 97 && code <= 122) {
    return String.fromCodePoint(0x1d41a + (code - 97));
  }

  if (code >= 48 && code <= 57) {
    return String.fromCodePoint(0x1d7ce + (code - 48));
  }

  return input;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
