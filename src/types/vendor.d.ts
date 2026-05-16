declare module "html-to-docx" {
  export interface HtmlToDocxOptions {
    table?: {
      row?: {
        cantSplit?: boolean;
      };
    };
    footer?: boolean;
    pageNumber?: boolean;
    margins?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
  }

  export default function htmlToDocx(
    html: string,
    header?: string | null,
    options?: HtmlToDocxOptions,
    footer?: string | null
  ): Promise<Buffer | ArrayBuffer | Uint8Array>;
}

declare module "@iarna/rtf-to-html" {
  interface RtfToHtml {
    fromString(input: string | Buffer, callback: (error: Error | null, html?: string) => void): void;
  }

  const rtfToHtml: RtfToHtml;
  export default rtfToHtml;
}

declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export const Util: {
    transform(matrixA: number[], matrixB: number[]): number[];
  };

  export function getDocument(source: unknown): {
    promise: Promise<{
      numPages: number;
      getPage(pageNumber: number): Promise<{
        getViewport(options: { scale: number }): { width: number; height: number; scale: number; transform: number[] };
        getTextContent(options?: unknown): Promise<{ items: unknown[] }>;
        cleanup(): void;
      }>;
      destroy(): Promise<void>;
    }>;
  };
}
