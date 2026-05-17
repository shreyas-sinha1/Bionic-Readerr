/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: [
      "pdfjs-dist",
      "mammoth",
      "html-to-docx",
      "puppeteer-core",
      "@sparticuz/chromium",
      "@iarna/rtf-to-html"
    ]
  },
  webpack(config) {
    config.resolve.alias.canvas = false;
    return config;
  }
};

export default nextConfig;
