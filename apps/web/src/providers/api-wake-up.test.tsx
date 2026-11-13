// ApiWakeUp: React StrictMode(개발 모드)에서도 문서당 한 번만 깨운다(검수 W1-01). AC 태그는 없다.
import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetWakeApiOnceForTests } from "@/lib/wake-api";
import { ApiWakeUp } from "./api-wake-up";

const fetchSpy = vi.fn();

beforeEach(() => {
  fetchSpy.mockReset().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetchSpy);
  resetWakeApiOnceForTests();
});
afterEach(() => vi.unstubAllGlobals());

describe("ApiWakeUp", () => {
  it("StrictMode에서 효과가 두 번 실행되어도 /health 요청은 한 번이다", () => {
    render(
      <StrictMode>
        <ApiWakeUp />
      </StrictMode>,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]![0])).toMatch(/\/health$/);
  });

  it("화면에는 아무것도 그리지 않는다", () => {
    const { container } = render(<ApiWakeUp />);
    expect(container).toBeEmptyDOMElement();
  });

  it("다른 컴포넌트가 다시 그려져도(여러 번 마운트) 한 번만 보낸다", () => {
    const first = render(<ApiWakeUp />);
    first.unmount();
    render(<ApiWakeUp />);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
