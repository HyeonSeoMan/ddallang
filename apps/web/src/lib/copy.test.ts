import { describe, expect, it } from "vitest";
import { mockClipboard, removeClipboard } from "@/test/clipboard";
import { copyText } from "./copy";

describe("copyText", () => {
  it("쓰기가 끝난 뒤에만 성공을 돌려준다", async () => {
    const clipboard = mockClipboard({ manual: true });
    let result: unknown;
    const pending = copyText("1,250 원").then((r) => (result = r));
    await Promise.resolve();
    expect(result).toBeUndefined();
    clipboard.resolve();
    await pending;
    expect(result).toEqual({ ok: true });
    expect(clipboard.written).toEqual(["1,250 원"]);
  });

  it("쓰기 실패는 failed, API가 없으면 unsupported다", async () => {
    mockClipboard({ fail: true });
    await expect(copyText("x")).resolves.toEqual({ ok: false, reason: "failed" });
    removeClipboard();
    await expect(copyText("x")).resolves.toEqual({ ok: false, reason: "unsupported" });
  });
});
