import type { NextConfig } from "next";
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
} from "next/constants";
import { parseApiBaseUrl } from "./src/lib/env";

const phasesRequiringApiUrl = [
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
];

export default function nextConfig(phase: string): NextConfig {
  // 누락되면 빌드·기동을 실패시킨다(FD-1). 다른 단계(export 등)는 막지 않는다. typegen은 빌드 단계로 설정을 읽으므로 typecheck 스크립트가 기본값을 넣는다.
  if (phasesRequiringApiUrl.includes(phase)) {
    parseApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
  }
  // 개발 서버가 `AGENTS.md`를 자동 생성하지 않게 한다(저장소에 원치 않는 파일이 생긴다).
  return { reactStrictMode: true, agentRules: false };
}
