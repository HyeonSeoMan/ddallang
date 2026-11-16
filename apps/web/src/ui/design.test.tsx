// FE-D1·FE-V1 완료 기준(FD-18): 글꼴 자체 호스팅·외부 요청 없음, 아이콘 접근성, 버튼 변형, 토큰 값.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/a11y";
import { BrandHeader } from "./brand-header";
import { Button } from "./button";
import {
  BagIcon,
  BellIcon,
  BookIcon,
  CheckIcon,
  ChipIcon,
  CoinIcon,
  HouseIcon,
  InfoIcon,
  OfflineIcon,
  PencilIcon,
  PeopleIcon,
  StarIcon,
} from "./icons";
import { selectClass } from "./select-style";
import { TextField } from "./text-field";
import { colors, FONT_STACK, radii, shadows } from "./tokens";

const SRC = join(__dirname, "..");
const WEB = join(SRC, "..");

/**
 * jsdom은 Panda CSS를 적용하지 않는다. 원자 클래스를 `cx`로 이어 붙이면 같은 속성끼리는 생성 CSS의 순서가 이기므로,
 * 한 요소에 같은 속성(또는 줄임 속성과 그 개별 속성)을 정하는 클래스가 둘 이상 붙었는지 이름으로 찾는다.
 * 조건부 클래스(`disabled:` 등)는 조건별로 따로 본다. 다루는 줄임 속성은 아래 표에 있는 것뿐이고, 선택자에 공백이 든
 * 조건부 클래스(`[&_>_button]:…`)는 이름을 정확히 나누지 못하므로 이 도우미를 적용하는 요소에 쓰지 않는다.
 */
function conflictingClasses(className: string): string[] {
  const props = className
    .split(" ")
    .filter(Boolean)
    .map((name) => (name.includes("_") ? name.slice(0, name.indexOf("_")) : name));
  const shorthands: Record<string, string[]> = { bg: ["bg-c", "bg-i", "bg-r", "bg-p", "bg-s"], bd: ["bd-w", "bd-c", "bd-s"], p: ["px", "py", "pl", "pr", "pt", "pb"], px: ["pl", "pr"], py: ["pt", "pb"] };
  const found: string[] = [];
  props.forEach((prop, index) => {
    if (props.indexOf(prop) !== index) found.push(prop);
    const [condition, base] = prop.includes(":") ? [prop.slice(0, prop.lastIndexOf(":") + 1), prop.slice(prop.lastIndexOf(":") + 1)] : ["", prop];
    for (const longhand of shorthands[base] ?? []) {
      if (props.includes(condition + longhand)) found.push(`${prop}+${condition}${longhand}`);
    }
    // 조건부 줄임 속성은 조건 없는 개별 속성도 덮는다.
    if (condition) for (const longhand of shorthands[base] ?? []) if (props.includes(longhand)) found.push(`${prop}+${longhand}`);
  });
  return found;
}

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
  // 면 아이콘 12종(FD-18 1.3.0 (3)).
  const icons = [
    ["동전 종", BellIcon],
    ["코인", CoinIcon],
    ["장부", BookIcon],
    ["연필", PencilIcon],
    ["주머니", BagIcon],
    ["집", HouseIcon],
    ["얼굴 둘", PeopleIcon],
    ["완료", CheckIcon],
    ["안내", InfoIcon],
    ["끊김", OfflineIcon],
    ["별", StarIcon],
    ["칩", ChipIcon],
  ] as const;

  it.each(icons)("%s 아이콘은 장식이라 보조기기에 숨겨지고 초점을 받지 않는다", (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(svg).toHaveAttribute("width", "40");
    expect(container.querySelector("title, text, image, use")).toBeNull();
    // 그림자 없음(FD-18 1.3.0): 필터 요소·속성, 그림자 스타일이 없다.
    expect(container.querySelector("filter, [filter], [style*='shadow'], [class*='shadow']")).toBeNull();
  });

  it("마스크를 쓰는 아이콘을 한 화면에 여러 번 그려도 마스크 id가 겹치지 않는다", () => {
    const { container } = render(
      <>
        <PeopleIcon />
        <PeopleIcon />
        <OfflineIcon />
      </>,
    );
    const ids = Array.from(container.querySelectorAll("mask")).map((mask) => mask.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(container.querySelector(`[mask="url(#${id})"]`)).not.toBeNull();
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
  it.each(["primary", "secondary", "secondaryBlock", "dangerText", "danger", "dangerSolid"] as const)(
    "%s 변형도 type=button이고 비활성이면 클릭되지 않는다",
    (variant) => {
      render(
        <Button variant={variant} disabled>
          기록하기
        </Button>,
      );
      const button = screen.getByRole("button", { name: "기록하기" });
      expect(button).toHaveAttribute("type", "button");
      expect(button).toBeDisabled();
    },
  );

  it.each(
    (["primary", "secondary", "secondaryBlock", "dangerText", "danger", "dangerSolid"] as const).flatMap((variant) =>
      (["default", "large"] as const).map((size) => [variant, size] as const),
    ),
  )("%s·%s 버튼은 같은 속성을 두 원자 클래스로 정하지 않는다(변형 값이 공통 모양에 지지 않는다)", (variant, size) => {
    render(
      <Button variant={variant} size={size}>
        버튼
      </Button>,
    );
    expect(conflictingClasses(screen.getByRole("button", { name: "버튼" }).className)).toEqual([]);
  });

  it("입력·선택 상자의 결합 클래스도 속성이 겹치지 않는다(비활성 바탕이 선택 상자 화살표를 지우지 않는다)", () => {
    render(
      <>
        <TextField label="금액" suffix="원" />
        <select aria-label="지급자" className={selectClass} disabled>
          <option>가</option>
        </select>
      </>,
    );
    expect(conflictingClasses(screen.getByLabelText("금액").className)).toEqual([]);
    const select = screen.getByRole("combobox", { name: "지급자" }).className;
    expect(conflictingClasses(select)).toEqual([]);
    expect(select).toMatch(/bg-i_/);
  });

  it("위험 테두리·알약 모양은 변형 값으로 나온다", () => {
    render(
      <>
        <Button variant="danger">게임 종료</Button>
        <Button variant="secondary">수정</Button>
        <Button variant="dangerText">삭제</Button>
      </>,
    );
    const danger = screen.getByRole("button", { name: "게임 종료" }).className.split(" ");
    expect(danger).toContain("bd-c_danger");
    expect(danger).not.toContain("bd-c_transparent");
    for (const name of ["수정", "삭제"]) {
      const classes = screen.getByRole("button", { name }).className.split(" ");
      expect(classes).toContain("bdr_full");
      expect(classes).toContain("px_4");
      expect(classes).not.toContain("bdr_md");
    }
  });

  it("large 크기는 기본 터치 목표보다 큰 높이 클래스를 쓰고 기본 높이 클래스와 겹치지 않는다", () => {
    render(
      <>
        <Button>기본</Button>
        <Button size="large">크게</Button>
      </>,
    );
    const small = screen.getByRole("button", { name: "기본" }).className.split(" ");
    const large = screen.getByRole("button", { name: "크게" }).className.split(" ");
    const minH = (classes: string[]) => classes.filter((c) => c.startsWith("min-h_"));
    expect(minH(small)).toHaveLength(1);
    expect(minH(large)).toHaveLength(1);
    expect(minH(large)[0]).not.toBe(minH(small)[0]);
  });

  it("모서리와 그림자 토큰은 확정본의 단계를 따른다(카드 20·컨트롤 12·타일 14, 그림자는 대화상자만)", () => {
    expect(radii).toEqual({ card: "20px", control: "12px", tile: "14px", chip: "999px" });
    expect(Object.keys(shadows)).toEqual(["float"]);
  });

  it("주 색은 초록이고 노랑은 아이콘 전용 `coin`으로만 남는다", () => {
    expect(colors.primary).toBe("#00875a");
    expect(colors.coin).toBe("#ffc93c");
  });
});

describe("브라우저 QA 후속 수정(FD-18)", () => {
  it("모든 네이티브 select 요소가 하나도 빠짐없이 공통 모양(selectClass)을 쓴다: 기본 화살표가 쏠리지 않는다", () => {
    const offenders: string[] = [];
    let total = 0;
    for (const file of sourceFiles(join(SRC, "features"))) {
      const text = readFileSync(file, "utf8");
      // `<select`부터 `</select>`까지를 요소 하나로 보고 요소마다 className을 확인한다(파일에 문자열이 있기만 한 경우를 막는다).
      for (const match of text.matchAll(/<select\b[\s\S]*?<\/select>/g)) {
        total += 1;
        if (!match[0].includes("className={selectClass}")) offenders.push(`${file}: ${match[0].slice(0, 60)}`);
      }
    }
    // 요소 3개: 거래 입력의 ParticipantSelect(지급자·수취자가 공유하는 요소 1개), 거래 내역 필터, 방 만들기 단위.
    // select가 새로 생기면 이 수를 맞추고 selectClass를 쓰게 한다.
    expect(total).toBe(3);
    expect(offenders).toEqual([]);
  });

  it("selectClass는 기본 화살표를 끄고 오른쪽 안쪽 여백을 확보한다", () => {
    const { container } = render(<select className={selectClass} defaultValue="a"><option value="a">가</option></select>);
    const classes = container.querySelector("select")!.className;
    expect(classes.split(" ")).toContain("ap_none"); // Panda는 appearance를 ap로 줄인다
    expect(classes).toMatch(/pr_12/);
    expect(classes).toMatch(/pl_4/);
  });

  it("브랜드 헤더의 접근 가능한 이름은 DDALLANG이고 방울 아이콘은 숨겨진다", () => {
    const { container } = render(<BrandHeader />);
    expect(screen.getByRole("heading", { level: 1, name: "DDALLANG" })).toBeInTheDocument();
    expect(container.querySelector("h1 svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("한글은 단어 중간에서 줄바꿈하지 않는다(전역 word-break: keep-all)", () => {
    const config = readFileSync(join(WEB, "panda.config.ts"), "utf8");
    expect(config).toContain('wordBreak: "keep-all"');
  });
});
