import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "@/test/a11y";
import { AnnouncerProvider, useAnnounce } from "./announcer";
import { Badge } from "./badge";
import { Banner } from "./banner";
import { Avatar } from "./avatar";
import { Button } from "./button";
import { ChoiceChips } from "./choice-chips";
import { ConfirmDialog } from "./confirm-dialog";
import { amountFontSize, Money } from "./money";
import { TextField } from "./text-field";

describe("기본 컴포넌트", () => {
  it("버튼은 기본이 type=button이고 클릭을 전달한다", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>저장</Button>);
    const button = screen.getByRole("button", { name: "저장" });
    expect(button).toHaveAttribute("type", "button");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("입력은 라벨로 연결되고 오류는 aria-describedby·aria-live로 안내된다", async () => {
    const { container, rerender } = render(<TextField label="닉네임" hint="최대 12자" />);
    const input = screen.getByLabelText("닉네임");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAccessibleDescription("최대 12자");

    rerender(<TextField label="닉네임" hint="최대 12자" errors={["필수 항목입니다", "연속 공백은 쓸 수 없습니다"]} />);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/필수 항목입니다 연속 공백은 쓸 수 없습니다/);
    expect(screen.getByText("필수 항목입니다").parentElement).toHaveAttribute("aria-live", "polite");
    await expectNoA11yViolations(container);
  });

  // FD-18 (1) 시각 API: suffix는 장식이라 이름·설명을 바꾸지 않고, 없으면 입력이 감싸개 없이 그대로 나온다.
  it("금액 단위 suffix는 보조기기에 숨겨지고 입력의 이름·설명·오류 연결은 그대로다", async () => {
    const { container, rerender } = render(<TextField label="금액" suffix="원" errors={["1 이상 입력하세요"]} />);
    const input = screen.getByLabelText("금액");
    expect(input).toHaveAccessibleName("금액");
    expect(input).toHaveAccessibleDescription("1 이상 입력하세요");
    expect(screen.getByText("원")).toHaveAttribute("aria-hidden", "true");
    expect(input.nextElementSibling).toBe(screen.getByText("원"));
    await expectNoA11yViolations(container);

    rerender(<TextField label="금액" />);
    expect(screen.queryByText("원")).toBeNull();
    // suffix가 없으면 라벨 바로 다음이 입력이다(이전 마크업과 같다).
    expect(screen.getByText("금액").nextElementSibling).toBe(screen.getByLabelText("금액"));
  });

  it("배너의 icon은 장식이고 역할·이름은 아이콘 없는 배너와 같다", async () => {
    const { container } = render(
      <main>
        <Banner tone="warning" icon={<svg data-testid="icon" />}>
          연결 끊김
        </Banner>
        <Banner tone="success" icon={<svg />}>
          최신 상태로 갱신됨
        </Banner>
        <Banner tone="info">연결 중</Banner>
      </main>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("연결 끊김");
    expect(screen.getByTestId("icon").parentElement).toHaveAttribute("aria-hidden", "true");
    const statuses = screen.getAllByRole("status");
    expect(statuses.map((el) => el.textContent)).toEqual(["최신 상태로 갱신됨", "연결 중"]);
    // 아이콘이 없으면 역할 요소 안에 글자만 있다(이전 마크업과 같다).
    expect(statuses[1]!.childElementCount).toBe(0);
    await expectNoA11yViolations(container);
  });

  it("배지는 텍스트로 상태를 보이고 배너는 긴급도에 맞는 role을 쓴다", async () => {
    const { container } = render(
      <main>
        <Badge tone="success">게임 종료</Badge>
        <Banner tone="info">최신 상태로 갱신됨</Banner>
        <Banner tone="error">연결 끊김</Banner>
      </main>,
    );
    expect(screen.getByText("게임 종료")).toBeInTheDocument();
    expect(screen.getByText("최신 상태로 갱신됨")).toHaveAttribute("role", "status");
    expect(screen.getByText("연결 끊김")).toHaveAttribute("role", "alert");
    await expectNoA11yViolations(container);
  });

  it("금액은 줄바꿈하지 않는 요소에 서식과 단위로 표시한다", () => {
    render(
      <>
        <Money value={1250000} unit="원" />
        <Money value={-300} unit="칩" signed />
      </>,
    );
    expect(screen.getByText("1,250,000 원")).toBeInTheDocument();
    expect(screen.getByText("−300 칩")).toBeInTheDocument();
  });

  // FD-18 (2) 금액 폭 맞춤: N(부호·공백·단위 포함 코드 포인트)이 18 이하 18px, 19~24 15px, 25 이상 13px.
  it.each([
    ["+999,999,999,999 원", 18, "18px"],
    ["+999,999,999,999 점수", 19, "15px"],
    ["−999,999,999,999 가나다라마바사", 24, "15px"],
    ["−999,999,999,999 가나다라마바사아", 25, "13px"],
    ["+999,999,999,999 가나다라마바사아자차카타", 29, "13px"],
  ] as const)("금액 %s(N = %i)은 %s로 보인다", (text, length, size) => {
    expect([...text].length).toBe(length);
    expect(amountFontSize(text)).toBe(size);
  });

  it("Money는 부호·단위를 포함한 글자 수로 크기를 고르고 손실은 검정 글자다", () => {
    render(
      <>
        <Money value={-999_999_999_999} unit="가나다라마바사아자차카타" signed />
        <Money value={4000} unit="원" signed />
      </>,
    );
    const long = screen.getByText("−999,999,999,999 가나다라마바사아자차카타");
    expect(long.className).toMatch(/fs_13px/);
    expect(long.className).toMatch(/c_loss/);
    expect(screen.getByText("+4,000 원").className).toMatch(/fs_amountList/);
  });

  it("안전 정수가 아닌 금액은 렌더링하지 않고 예외를 낸다", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Money value={1.5} unit="원" />)).toThrow(RangeError);
  });
});

describe("칩 고르기(DV-17 1.1.0, FD-18 (8))", () => {
  function Harness({ errors = [] as string[] }) {
    const [value, setValue] = useState("");
    return (
      <ChoiceChips
        legend="지급자"
        options={[
          { value: "p-1", label: "가온" },
          { value: "p-2", label: "나래" },
          { value: "p-3", label: "Abcdefghijkl" },
        ]}
        value={value}
        onChange={setValue}
        errors={errors}
      />
    );
  }

  it("legend 이름의 group 안 네이티브 라디오이고 처음에는 아무것도 고르지 않았다", async () => {
    const { container } = render(<Harness />);
    const group = screen.getByRole("group", { name: "지급자" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((r) => r.closest("label")?.textContent)).toEqual(["가온", "나래", "Abcdefghijkl"]);
    expect(radios.every((r) => !(r as HTMLInputElement).checked)).toBe(true);
    expect(group).not.toHaveAttribute("aria-describedby");
    // 칩 묶음은 줄을 바꿔 감싼다(가로 스크롤 없음).
    expect(radios[0]!.closest("div")!.className).toMatch(/flex-wrap_wrap/);
    await expectNoA11yViolations(container);
  });

  it("고르면 그 칩만 선택되고 화살표 키로 선택을 옮긴다", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: "가온" }));
    expect(screen.getByRole("radio", { name: "가온" })).toBeChecked();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "나래" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "가온" })).not.toBeChecked();
  });

  it("오류는 묶음의 라디오 모두에 aria-invalid, fieldset 설명은 항상 있는 aria-live 문단이다", async () => {
    const { container, rerender } = render(<Harness />);
    const live = container.querySelector("[aria-live='polite']")!;
    expect(live).toBeInTheDocument(); // 오류 전에도 영역이 있다
    rerender(<Harness errors={["필수 항목입니다."]} />);
    const group = screen.getByRole("group", { name: "지급자" });
    expect(group).toHaveAccessibleDescription("필수 항목입니다.");
    for (const radio of within(group).getAllByRole("radio")) expect(radio).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(group.getAttribute("aria-describedby")!)).toBe(live);
    await expectNoA11yViolations(container);
  });
});

describe("아바타(DV-11)", () => {
  it("장식이라 숨겨지고 첫 글자를 글자 내용 밖(content)으로 그리며 위치 % 6으로 색을 고른다", () => {
    const { container } = render(
      <>
        <Avatar name="가온" index={0} />
        <Avatar name="Abc" index={6} />
        <Avatar name="나래" index={-1} />
        <Avatar name="다온" index={2} inactive />
      </>,
    );
    const avatars = Array.from(container.querySelectorAll<HTMLElement>("[data-initial]"));
    expect(avatars.map((a) => a.getAttribute("aria-hidden"))).toEqual(["true", "true", "true", "true"]);
    expect(avatars.map((a) => a.getAttribute("data-initial"))).toEqual(["가", "A", "나", "다"]);
    expect(avatars.map((a) => a.textContent)).toEqual(["", "", "", ""]);
    // 0과 6은 같은 색, 위치를 모르면(-1) 범위 안의 색, 비활성은 인라인 색 없이 회색 클래스.
    expect(avatars[0]!.style.backgroundColor).toBe(avatars[1]!.style.backgroundColor);
    expect(avatars[2]!.style.backgroundColor).not.toBe("");
    expect(avatars[3]!.style.backgroundColor).toBe("");
    expect(avatars[3]!.className).toMatch(/bg-c_paperSubtle/);
  });
});

describe("알림 영역", () => {
  function Trigger({ message, assertive }: { message: string; assertive?: boolean }) {
    const announce = useAnnounce();
    return <button onClick={() => announce(message, { assertive })}>알림</button>;
  }

  it("polite·assertive 영역으로 안내하고 같은 문구도 다시 알린다", async () => {
    render(
      <AnnouncerProvider>
        <Trigger message="저장했습니다" />
        <Trigger message="오류가 발생했습니다" assertive />
      </AnnouncerProvider>,
    );
    const [polite, urgent] = screen.getAllByRole("button", { name: "알림" });
    await userEvent.click(polite!);
    expect(screen.getByRole("status")).toHaveTextContent("저장했습니다");
    const firstNode = within(screen.getByRole("status")).getByText("저장했습니다");
    await userEvent.click(polite!);
    expect(within(screen.getByRole("status")).getByText("저장했습니다")).not.toBe(firstNode);
    await userEvent.click(urgent!);
    expect(screen.getByRole("alert")).toHaveTextContent("오류가 발생했습니다");
  });

  it("제공자 없이 쓰면 오류를 낸다", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Trigger message="x" />)).toThrow("AnnouncerProvider");
  });
});

describe("ConfirmDialog", () => {
  function Harness({ onConfirm = vi.fn() }: { onConfirm?: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <main>
        <button onClick={() => setOpen(true)}>종료</button>
        <ConfirmDialog
          open={open}
          title="게임을 종료할까요?"
          description="종료하면 되돌릴 수 없습니다."
          confirmLabel="게임 종료"
          onConfirm={() => {
            onConfirm();
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </main>
    );
  }

  it("열리면 role=dialog·aria-modal이고 기본 포커스는 취소다", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "종료" }));
    const dialog = screen.getByRole("dialog", { name: "게임을 종료할까요?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("종료하면 되돌릴 수 없습니다.");
    expect(screen.getByRole("button", { name: "취소" })).toHaveFocus();
    await expectNoA11yViolations(dialog);
  });

  it("Tab·Shift+Tab이 대화상자 안에서만 순환한다(포커스 가둠)", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "종료" }));
    const cancel = screen.getByRole("button", { name: "취소" });
    const confirm = screen.getByRole("button", { name: "게임 종료" });
    await userEvent.tab();
    expect(confirm).toHaveFocus();
    await userEvent.tab();
    expect(cancel).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(confirm).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(cancel).toHaveFocus();
  });

  it("Esc는 취소이고 닫으면 포커스가 원래 컨트롤로 돌아간다", async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    const opener = screen.getByRole("button", { name: "종료" });
    await userEvent.click(opener);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("취소 버튼은 확정하지 않고, 확인 버튼만 확정한다", async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "종료" }));
    await userEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "종료" }));
    await userEvent.click(screen.getByRole("button", { name: "게임 종료" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("대화상자 밖으로 포커스가 빠져나가면 되돌린다", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "종료" });
    await userEvent.click(opener);
    opener.focus();
    expect(screen.getByRole("button", { name: "취소" })).toHaveFocus();
  });

  it("진행 중 포커스는 대화상자에 남고, 끝나면 취소로 돌아가 Esc가 동작한다", async () => {
    const onCancel = vi.fn();
    const props = { title: "t", description: "d", confirmLabel: "확인", onConfirm: vi.fn(), onCancel };
    const { rerender } = render(<ConfirmDialog open {...props} />);
    expect(screen.getByRole("button", { name: "취소" })).toHaveFocus();
    rerender(<ConfirmDialog open busy {...props} />);
    expect(screen.getByRole("dialog")).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).not.toHaveBeenCalled();
    rerender(<ConfirmDialog open {...props} />);
    expect(screen.getByRole("button", { name: "취소" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("진행 중에는 버튼이 비활성화되고 Esc도 무시한다", async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        busy
        title="t"
        description="d"
        confirmLabel="확인"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole("button", { name: "취소" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "확인" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).not.toHaveBeenCalled();
  });
});
