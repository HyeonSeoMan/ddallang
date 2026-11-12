// FE-D1 완료 기준(FD-18): 글꼴 자체 호스팅·외부 요청 없음, 아이콘 접근성, 새 버튼 변형, 토큰 값.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/a11y";
import { Button } from "./button";
import { BagIcon, BellIcon, BookIcon, CoinIcon, PeopleIcon } from "./icons";
import { colors, FONT_STACK, radii, shadows } from "./tokens";

const SRC = join(__dirname, "..");
const WEB = join(SRC, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "fonts" ? [] : sourceFiles(path);
    return /\.(tsx?|css|mjs)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe("글꼴 자체 호스팅(FD-18, RK-F16)", () => {
  it("루트 레이아웃은 next/font/local로 Pretendard 가변 글꼴을 불러온다", () => {
    const layout = readFileSync(join(SRC, "app/layout.tsx"), "utf8");
    expect(layout).toContain('from "next/font/local"');
    expect(layout).toContain("PretendardVariable.woff2");
    expect(layout).toContain('variable: "--font-pretendard"');
    expect(layout).toContain('display: "swap"');
  });

  it("글꼴 파일과 SIL OFL 라이선스가 함께 있다", () => {
    expect(statSync(join(SRC, "fonts/PretendardVariable.woff2")).size).toBeGreaterThan(100_000);
    const license = readFileSync(join(SRC, "fonts/Pretendard-LICENSE.txt"), "utf8");
    expect(license).toContain("SIL OPEN FONT LICENSE");
    expect(license).toContain("Pretendard");
  });

  it("소스와 설정 어디에도 외부 글꼴 서버·CDN 주소가 없다", () => {
    const files = [...sourceFiles(SRC), join(WEB, "panda.config.ts"), join(WEB, "next.config.ts")];
    const forbidden = /fonts\.googleapis|fonts\.gstatic|use\.typekit|cdn\.jsdelivr|unpkg\.com|cdnjs|cdn\.jsdelivr|@import\s+url\(/i;
    const offenders = files.filter((file) => forbidden.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("글꼴 스택은 자체 호스팅 변수를 먼저 쓰고 시스템 글꼴로 대체한다", () => {
    expect(FONT_STACK.startsWith("var(--font-pretendard)")).toBe(true);
    expect(FONT_STACK).toContain("system-ui");
    expect(FONT_STACK).toContain("Apple SD Gothic Neo");
  });
});

describe("아이콘(FD-18)", () => {
  const icons = [
    ["코인", CoinIcon],
    ["방울", BellIcon],
    ["주머니", BagIcon],
    ["노트", BookIcon],
    ["사람", PeopleIcon],
  ] as const;

  it.each(icons)("%s 아이콘은 장식이라 보조기기에 숨겨지고 초점을 받지 않는다", (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(svg).toHaveAttribute("width", "40");
    expect(container.querySelector("title, text, image, use")).toBeNull();
  });

  it("크기를 바꿀 수 있고 아이콘 곁의 텍스트가 접근 가능한 이름이 된다", async () => {
    const { container } = render(
      <button type="button">
        <CoinIcon size={24} />
        거래 기록
      </button>,
    );
    expect(container.querySelector("svg")).toHaveAttribute("width", "24");
    expect(screen.getByRole("button")).toHaveAccessibleName("거래 기록");
    await expectNoA11yViolations(container);
  });
});

describe("버튼 변형과 토큰(FD-18)", () => {
  it("accent 변형도 type=button이고 비활성이면 클릭되지 않는다", () => {
    render(
      <Button variant="accent" disabled>
        기록하기
      </Button>,
    );
    const button = screen.getByRole("button", { name: "기록하기" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toBeDisabled();
  });

  it("모서리와 그림자 토큰은 시안의 단계를 따른다", () => {
    expect(radii.card).toBe("24px");
    expect(radii.control).toBe("16px");
    expect(Object.keys(shadows)).toEqual(
      expect.arrayContaining(["card", "float", "button", "buttonAccent", "buttonPressed", "chip"]),
    );
  });

  it("포인트색은 초록(주요 행동)과 노랑(보조 강조)이다", () => {
    expect(colors.primary).toBe("#12804f");
    expect(colors.accent).toBe("#ffc93c");
  });
});
