import { vi } from "vitest";
import { stubNavigator } from "./navigator-stub";

export interface ClipboardMock {
  writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;
  /** 쓰기가 끝난 텍스트들(성공 순서). */
  readonly written: string[];
}

export interface ClipboardMockOptions {
  /** 쓰기가 거부된다(권한·포커스 문제). */
  fail?: boolean;
  /** 쓰기 완료를 시험이 직접 제어한다(완료 전에는 성공을 표시하지 않는 시험). */
  manual?: boolean;
}

/** 클립보드 모의. `manual`이면 `resolve()`/`reject()`로 쓰기 완료 시점을 정한다. */
export function mockClipboard(options: ClipboardMockOptions = {}) {
  const written: string[] = [];
  const pending: Array<{ text: string; resolve: () => void; reject: (e: unknown) => void }> = [];

  const writeText = vi.fn<(text: string) => Promise<void>>((text) => {
    if (options.fail) return Promise.reject(new DOMException("denied", "NotAllowedError"));
    if (options.manual) {
      return new Promise<void>((resolve, reject) => {
        pending.push({
          text,
          resolve: () => {
            written.push(text);
            resolve();
          },
          reject,
        });
      });
    }
    written.push(text);
    return Promise.resolve();
  });

  stubNavigator("clipboard", { writeText });

  return {
    writeText,
    written,
    resolve: () => pending.shift()?.resolve(),
    reject: (error: unknown = new DOMException("denied", "NotAllowedError")) =>
      pending.shift()?.reject(error),
  };
}

/** 클립보드 API가 없는 환경(미지원). */
export function removeClipboard() {
  stubNavigator("clipboard", undefined);
}
