import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import { expectNoA11yViolations } from "@/test/a11y";
import { installFakeLocks } from "@/test/fake-locks";
import { type FakeStorage, installFakeStorage } from "@/test/fake-storage";
import { renderApp } from "@/test/render";
import { ONBOARDING_SEEN_KEY } from "@/lib/identity";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => null }));

let storage: FakeStorage;
beforeEach(() => {
  storage = installFakeStorage();
  installFakeLocks();
});

const seen = () => storage.setItem(ONBOARDING_SEEN_KEY, "1");

describe("홈 소개와 사용 순서 (U-27, DV-24)", () => {
  it("제목 아래 한 줄 소개, 방 만들기 카드 다음에 사용 순서 3단계와 다시 보기 버튼이 있다", () => {
    seen();
    renderApp(<HomePage />);
    const intro = screen.getByText(/함께 기록하고, 끝나면 누가 누구에게 얼마를 보낼지 정산해 주는 서비스예요/);
    const create = screen.getByRole("heading", { level: 2, name: "방 만들기" });
    const guide = screen.getByRole("region", { name: "이렇게 써요" });
    expect(intro.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(create.compareDocumentPosition(guide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(guide).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "1. 방 만들기",
      "2. 링크·QR로 초대",
      "3. 기록하고 정산",
    ]);
    expect(within(guide).getByRole("button", { name: "딸랑 소개 다시 보기" })).toBeInTheDocument();
  });

  it("소개를 본 브라우저에서는 소개가 열리지 않는다", async () => {
    seen();
    const { container } = renderApp(<HomePage />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});

describe("첫 방문 소개 (U-28, DV-25)", () => {
  it("처음 홈을 열면 소개가 열리고 세 장을 넘긴 뒤 시작하기로 닫으며 본 것으로 남긴다", async () => {
    const user = userEvent.setup();
    renderApp(<HomePage />);
    const dialog = screen.getByRole("dialog", { name: "모임의 돈·점수를 함께 기록해요" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByText("3장 중 1번째")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "다음" })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "다음" }));
    expect(screen.getByRole("dialog", { name: "가입 없이 링크 하나로" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "다음" }));
    expect(screen.getByRole("dialog", { name: "끝나면 정산까지 한 번에" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "건너뛰기" })).not.toBeInTheDocument();
    expect(storage.getItem(ONBOARDING_SEEN_KEY)).toBeNull();

    await user.click(within(dialog).getByRole("button", { name: "시작하기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(storage.getItem(ONBOARDING_SEEN_KEY)).toBe("1");
  });

  it("건너뛰기와 Esc도 닫으며 본 것으로 남긴다", async () => {
    const user = userEvent.setup();
    const first = renderApp(<HomePage />);
    await user.click(screen.getByRole("button", { name: "건너뛰기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(storage.getItem(ONBOARDING_SEEN_KEY)).toBe("1");
    first.unmount();

    storage.removeItem(ONBOARDING_SEEN_KEY);
    renderApp(<HomePage />);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(storage.getItem(ONBOARDING_SEEN_KEY)).toBe("1");
  });

  it("다시 보기로 첫 장부터 다시 열고, 닫으면 포커스가 다시 보기 버튼으로 돌아온다", async () => {
    const user = userEvent.setup();
    seen();
    renderApp(<HomePage />);
    const again = screen.getByRole("button", { name: "딸랑 소개 다시 보기" });
    await user.click(again);
    expect(screen.getByRole("dialog", { name: "모임의 돈·점수를 함께 기록해요" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(again).toHaveFocus();
  });

  it("Tab은 소개 안에서만 돈다", async () => {
    const user = userEvent.setup();
    renderApp(<HomePage />);
    const dialog = screen.getByRole("dialog");
    const skip = within(dialog).getByRole("button", { name: "건너뛰기" });
    const next = within(dialog).getByRole("button", { name: "다음" });
    expect(next).toHaveFocus();
    await user.tab();
    expect(skip).toHaveFocus();
    await user.tab({ shift: true });
    expect(next).toHaveFocus();
  });

  it("열린 소개도 접근성 위반이 없다", async () => {
    renderApp(<HomePage />);
    await expectNoA11yViolations(document.body);
  });

  it("저장소를 읽지 못하면 소개를 띄우지 않고, 쓰지 못해도 닫힌다", async () => {
    const user = userEvent.setup();
    installFakeStorage({ failOnGet: true });
    const first = renderApp(<HomePage />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    first.unmount();

    installFakeStorage({ failOnSet: true });
    renderApp(<HomePage />);
    await user.click(screen.getByRole("button", { name: "건너뛰기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
