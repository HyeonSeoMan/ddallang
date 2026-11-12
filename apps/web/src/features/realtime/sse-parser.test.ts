import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { formatSseEvent, splitBytesAt } from "@/test/fake-sse";
import { createSseParser, type SseItem } from "./sse-parser";

function parseAll(text: string): SseItem[] {
  const parser = createSseParser();
  return [...parser.feed(text), ...parser.end()];
}

/** 바이트 단위로 임의 경계에서 잘라 TextDecoder(stream)로 이어 붙여 파서에 먹인다. */
function parseChunked(bytes: Uint8Array, cuts: number[]): SseItem[] {
  const decoder = new TextDecoder();
  const parser = createSseParser();
  const items: SseItem[] = [];
  for (const chunk of splitBytesAt(bytes, cuts)) {
    items.push(...parser.feed(decoder.decode(chunk, { stream: true })));
  }
  items.push(...parser.feed(decoder.decode()), ...parser.end());
  return items;
}

describe("SSE 파서", () => {
  it("id·event·data를 해석하고 빈 줄에서 이벤트를 끝낸다", () => {
    const items = parseAll('id: 12\nevent: transaction.created\ndata: {"revision":12}\n\n');
    expect(items).toEqual([
      { kind: "event", id: "12", event: "transaction.created", data: { revision: 12 }, malformed: false },
    ]);
  });

  it("id가 없는 ready·heartbeat는 id가 null이다", () => {
    expect(parseAll('event: ready\ndata: {"revision":3}\n\n')[0]).toMatchObject({ id: null, event: "ready" });
  });

  it.each([
    ["\\n", "\n"],
    ["\\r\\n", "\r\n"],
    ["\\r", "\r"],
  ])("줄바꿈 %s를 모두 인식한다", (_name, nl) => {
    const text = `event: a${nl}data: {"n":1}${nl}${nl}event: b${nl}data: {"n":2}${nl}${nl}`;
    expect(parseAll(text).map((i) => (i.kind === "event" ? i.event : "-"))).toEqual(["a", "b"]);
  });

  it("\\r\\n이 조각 경계에서 갈라져도 하나의 줄바꿈이다", () => {
    const parser = createSseParser();
    const items = [
      ...parser.feed('event: a\r'),
      ...parser.feed('\ndata: {"n":1}\r'),
      ...parser.feed("\n\r"),
      ...parser.feed("\n"),
      ...parser.end(),
    ];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ event: "a", data: { n: 1 }, malformed: false });
  });

  it("주석 줄은 이벤트를 끊지 않고 별도 항목으로 나온다", () => {
    const items = parseAll(': heartbeat\n\nevent: a\n: 중간 주석\ndata: {"n":1}\n\n');
    expect(items.map((i) => i.kind)).toEqual(["comment", "comment", "event"]);
    expect(items.filter((i) => i.kind === "event")).toHaveLength(1);
  });

  it("알 수 없는 필드(retry 등)는 무시하고 event가 없으면 message다", () => {
    const items = parseAll('retry: 1000\nfoo: bar\ndata: {"n":1}\n\n');
    expect(items).toEqual([{ kind: "event", id: null, event: "message", data: { n: 1 }, malformed: false }]);
  });

  it("data 해석에 실패하면 malformed다", () => {
    expect(parseAll("event: x\ndata: {broken\n\n")[0]).toMatchObject({ event: "x", data: null, malformed: true });
  });

  it("스트림 맨 앞의 BOM(U+FEFF)은 버린다", () => {
    const parser = createSseParser();
    const items = [...parser.feed("\uFEFFevent: ready\ndata: {\"revision\":1}\n\n"), ...parser.end()];
    expect(items).toEqual([{ kind: "event", id: null, event: "ready", data: { revision: 1 }, malformed: false }]);
    // 맨 앞이 아닌 BOM은 필드 이름의 일부로 남아 알 수 없는 필드로 무시된다.
    expect(parseAll("event: a\n\uFEFFdata: {}\n\n")[0]).toMatchObject({ event: "a", data: null });
  });

  it("data가 없는 이벤트는 data가 null이고 malformed가 아니다", () => {
    expect(parseAll("event: x\n\n")[0]).toMatchObject({ event: "x", data: null, malformed: false });
  });

  it("빈 줄로 끝나지 않고 스트림이 끝나면 잘린 이벤트를 malformed로 돌려준다", () => {
    const parser = createSseParser();
    expect(parser.feed('id: 5\nevent: transaction.created\ndata: {"revi')).toEqual([]);
    expect(parser.end()).toEqual([
      { kind: "event", id: "5", event: "transaction.created", data: null, malformed: true },
    ]);
  });

  it("완성된 이벤트 뒤에 스트림이 끝나면 추가 항목이 없다", () => {
    const parser = createSseParser();
    parser.feed('event: a\ndata: {"n":1}\n\n');
    expect(parser.end()).toEqual([]);
  });

  it("연속 빈 줄은 빈 이벤트를 만들지 않는다", () => {
    expect(parseAll("\n\n\n")).toEqual([]);
  });

  it("[속성] 임의 조각 경계(UTF-8 멀티바이트 중간 포함)에서도 같은 이벤트 열이 나온다", () => {
    const eventArb = fc.record({
      id: fc.option(fc.nat(1000), { nil: undefined }),
      event: fc.constantFrom("ready", "heartbeat", "transaction.created", "room.ended", "future.event"),
      text: fc.string({ maxLength: 12 }),
    });
    fc.assert(
      fc.property(fc.array(eventArb, { minLength: 1, maxLength: 6 }), fc.array(fc.nat(400), { maxLength: 12 }), (events, cuts) => {
        const text = events
          .map((e) => formatSseEvent({ id: e.id, event: e.event, data: { revision: e.id ?? 0, text: e.text } }))
          .join("");
        const bytes = new TextEncoder().encode(text);
        expect(parseChunked(bytes, cuts)).toEqual(parseAll(text));
        expect(parseAll(text)).toHaveLength(events.length);
      }),
      { numRuns: 150 },
    );
  });

  it("[속성] 줄바꿈 종류를 섞어도(\\n·\\r\\n·\\r) 조각 나누기와 무관하게 같다", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("\n", "\r\n", "\r"), { minLength: 6, maxLength: 6 }),
        fc.array(fc.nat(80), { maxLength: 8 }),
        (nls, cuts) => {
          const text = `event: a${nls[0]}data: {"n":1}${nls[1]}${nls[2]}: c${nls[3]}event: b${nls[4]}data: {"n":2}${nls[5]}${nls[5]}`;
          const bytes = new TextEncoder().encode(text);
          expect(parseChunked(bytes, cuts)).toEqual(parseAll(text));
        },
      ),
      { numRuns: 150 },
    );
  });
});
