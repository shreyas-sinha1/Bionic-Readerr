import mammoth from "mammoth";
import type { ParsedDocument } from "@/src/types/conversion";

export async function parseDocx(filePath: string, title: string): Promise<ParsedDocument> {
  const [htmlResult, textResult] = await Promise.all([
    mammoth.convertToHtml(
      { path: filePath },
      {
        includeDefaultStyleMap: true,
        styleMap: [
          "p[style-name='Title'] => h1:fresh",
          "p[style-name='Subtitle'] => p.subtitle:fresh",
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh"
        ]
      }
    ),
    mammoth.extractRawText({ path: filePath })
  ]);

  return {
    title,
    sourceType: "docx",
    html: htmlResult.value,
    text: textResult.value,
    warnings: [...htmlResult.messages.map((message) => message.message), ...textResult.messages.map((message) => message.message)]
  };
}
