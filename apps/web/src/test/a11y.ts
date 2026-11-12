import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";
import { expect } from "vitest";

expect.extend(matchers);

/** 화면마다 같은 규칙으로 접근성 위반이 없는지 검사한다(OQ-033 D). */
export async function expectNoA11yViolations(container: Element): Promise<void> {
  const results = await axe(container);
  (expect(results) as unknown as { toHaveNoViolations(): void }).toHaveNoViolations();
}
