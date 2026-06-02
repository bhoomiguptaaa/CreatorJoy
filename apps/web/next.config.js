/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow YouTube thumbnails in <Image>
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
  // Proxy /api/* to the FastAPI backend during local dev so SSE works without CORS noise.
  async rewrites() {
    const apiBase = process.env.API_BASE_URL ?? "http://127.0.0.1:8000";
    return [
      { source: "/api/:path*", destination: `${apiBase}/api/:path*` },
    ];
  },
};

module.exports = nextConfig;
