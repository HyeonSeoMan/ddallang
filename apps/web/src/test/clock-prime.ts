import { http, HttpResponse } from "msw";
import { getApiClient, bearerHeader } from "@/lib/api";
import * as fixtures from "./fixtures";
import { apiUrl } from "./handlers";
import { server } from "./msw-server";

/**
 * 서버 시계 차이를 알아 둔다: `Date` 헤더가 있는 방 조회 응답을 한 번 받는다(실서버는 모든 응답에 `Date`가 있다).
 * 변경 요청 매니저는 차이를 모르면 요청을 보내지 않으므로 거래 변경 시험은 이 도우미로 시작한다.
 */
export async function primeServerClock(key: string, offsetMs = 0): Promise<void> {
  server.use(
    // 한 번만 쓴다: 계속 남아 있으면 같은 경로를 처리하는 다른 가짜 서버의 방 조회를 가로챈다.
    http.get(
      apiUrl(`/rooms/${fixtures.room.id}`),
      () => HttpResponse.json({ room: fixtures.room, me: fixtures.hostMember }, { headers: { Date: new Date(Date.now() + offsetMs).toUTCString() } }),
      { once: true },
    ),
  );
  await getApiClient().request({ method: "GET", path: `/rooms/${fixtures.room.id}`, headers: bearerHeader(key) });
}
