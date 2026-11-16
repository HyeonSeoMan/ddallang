// 칩 라디오 묶음(FD-18 (8), DV-17) 조회 도우미. RK-F22: 선택 상자를 찾던 시험은 조회 방법만 여기로 옮기고 단언은 유지한다.
import { within } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";

/** `screen`이나 `within(...)`의 결과. */
interface Scope {
  getByRole: (typeof import("@testing-library/react"))["screen"]["getByRole"];
}

type User = Pick<ReturnType<typeof userEvent.setup>, "click">;

/** 이름(= `legend`)으로 묶음(`fieldset`, 역할 `group`)을 찾는다. 선택 상자의 `getByLabelText(name)`에 해당한다. */
export const choiceGroup = (scope: Scope, name: string): HTMLElement => scope.getByRole("group", { name });

/** 선택지 하나를 고른다. 선택 상자의 `selectOptions(select, optionText)`에 해당한다. */
export async function choose(user: User, scope: Scope, name: string, option: string): Promise<void> {
  await user.click(within(choiceGroup(scope, name)).getByRole("radio", { name: option }));
}

/** 선택지 이름 목록(서버 순서). 선택 상자의 `options`의 글자 목록에 해당하며 빈 선택지(`선택`)는 라디오가 없어 빠진다. */
export function choiceNames(scope: Scope, name: string): string[] {
  return within(choiceGroup(scope, name))
    .queryAllByRole("radio")
    .map((radio) => radio.closest("label")?.textContent ?? "");
}

/** 고른 값(라디오 `value`). 아무것도 고르지 않았으면 빈 값이다. 선택 상자의 `value`에 해당한다. */
export function chosenValue(scope: Scope, name: string): string {
  const checked = within(choiceGroup(scope, name))
    .queryAllByRole("radio")
    .find((radio) => (radio as HTMLInputElement).checked) as HTMLInputElement | undefined;
  return checked?.value ?? "";
}
