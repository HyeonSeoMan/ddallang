import { getApiBaseUrl } from "../env";
import { type ApiClient, createApiClient } from "./client";

export * from "./client";
export * from "./errors";
export * from "./types";

let shared: ApiClient | undefined;

/** 앱 전체가 공유하는 클라이언트. 시계 보정 값이 하나여야 하므로 하나만 만든다. */
export function getApiClient(): ApiClient {
  shared ??= createApiClient({ baseUrl: getApiBaseUrl() });
  return shared;
}
