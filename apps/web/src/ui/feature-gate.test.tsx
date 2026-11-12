import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { CAPABILITY_LABELS, type CapabilityId, detectMissingCapabilities } from "@/lib/capabilities";
import { expectNoA11yViolations } from "@/test/a11y";
import { installFakeLocks } from "@/test/fake-locks";
import { installFakeStorage } from "@/test/fake-storage";
import { stubNavigator } from "@/test/navigator-stub";
import { FeatureGate } from "./feature-gate";

/** 필수 기능이 모두 있는 환경(jsdom에 없는 Web Locks만 채운다). */
function allPresent() {
  installFakeLocks();
  installFakeStorage();
}

function removers(): Record<CapabilityId, () => void> {
  return {
    locks: () => installFakeLocks(null),
    random: () => vi.stubGlobal("crypto", {}),
    storage: () => installFakeStorage({ failOnSet: true }),
    streaming: () => vi.stubGlobal("TextDecoder", undefined),
    connection: () => stubNavigator("onLine", undefined),
  };
}

describe("필수 기능 검사", () => {
  it("모두 있으면 빈 목록이다", () => {
    allPresent();
    expect(detectMissingCapabilities()).toEqual([]);
  });

  it.each(Object.keys(CAPABILITY_LABELS) as CapabilityId[])(
    "%s만 없으면 그 기능만 목록에 나온다",
    (id) => {
      allPresent();
      removers()[id]();
      expect(detectMissingCapabilities()).toEqual([id]);
    },
  );

  it("전부 없으면 5개 모두 나온다", () => {
    for (const remove of Object.values(removers())) remove();
    expect(detectMissingCapabilities().sort()).toEqual(Object.keys(CAPABILITY_LABELS).sort());
  });

  it("스트리밍 본문(Response.body)이 없으면 streaming이 없다", () => {
    allPresent();
    class NoBodyResponse {}
    vi.stubGlobal("Response", NoBodyResponse);
    expect(detectMissingCapabilities()).toEqual(["streaming"]);
  });
});

describe("FeatureGate", () => {
  it("모두 있으면 본문을 렌더링한다", async () => {
    allPresent();
    const { container } = render(
      <FeatureGate>
        <main>
          <h1>본문</h1>
        </main>
      </FeatureGate>,
    );
    expect(await screen.findByRole("heading", { name: "본문" })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("없는 기능이 있으면 차단 화면에 없는 기능 목록만 안내한다", async () => {
    allPresent();
    removers().locks();
    removers().random();
    const { container } = render(
      <FeatureGate>
        <h1>본문</h1>
      </FeatureGate>,
    );
    expect(
      await screen.findByRole("heading", { name: "이 브라우저에서는 사용할 수 없습니다" }),
    ).toBeInTheDocument();
    const text = screen.getByText(/필요한 기능이 없습니다/).textContent ?? "";
    expect(text).toContain("탭 간 잠금");
    expect(text).toContain("보안 난수");
    expect(text).not.toContain("브라우저 저장소");
    expect(text).toContain("최신 Chrome, Edge, Firefox, Safari로 열어 주세요.");
    expect(screen.queryByRole("heading", { name: "본문" })).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("차단 상태와 검사 전에는 하위 화면이 마운트되지 않는다", async () => {
    const mounted = vi.fn();
    function Child() {
      useEffect(() => mounted(), []);
      return <p>자식</p>;
    }
    const { rerender } = render(
      <FeatureGate detect={() => ["locks"]}>
        <Child />
      </FeatureGate>,
    );
    await screen.findByRole("heading");
    expect(mounted).not.toHaveBeenCalled();

    rerender(
      <FeatureGate detect={() => []}>
        <Child />
      </FeatureGate>,
    );
    expect(await screen.findByText("자식")).toBeInTheDocument();
    expect(mounted).toHaveBeenCalledOnce();
  });

  it("폴리필 의존성이 없다(NFR-008)", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    const polyfills = names.filter((name) =>
      /polyfill|core-js|whatwg-fetch|eventsource|event-source|web-streams|navigator\.locks|web-locks/i.test(name),
    );
    expect(polyfills).toEqual([]);
  });
});
