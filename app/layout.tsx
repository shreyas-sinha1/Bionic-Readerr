import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bionic Reader Converter",
  description: "Convert PDFs and text documents into Bionic Reading format while preserving document structure."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
