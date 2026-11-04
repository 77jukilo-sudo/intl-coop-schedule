import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 보안 헤더: 다른 사이트에 끼워 넣기(클릭재킹) 금지, 형식 추측 금지, 보안 연결 유지 등.
  // script-src를 제한하는 CSP는 Next.js의 내장 스크립트와 충돌하기 쉬워 넣지 않았다. (아래 항목만 안전하게 제한)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
