import type { NextConfig } from "next";

const BJID = process.env.SOOP_BJID || 'townboy';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // /api/soop-station 요청을 SOOP 방송국 페이지로 중계
        source: '/api/soop-station',
        destination: `https://www.sooplive.com/station/${BJID}`,
      },
    ];
  },
};

export default nextConfig;
