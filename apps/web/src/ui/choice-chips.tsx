import { useId } from "react";
import { css } from "styled-system/css";

export interface ChoiceOption {
  value: string;
  label: string;
}

const chipClass = css({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  minH: "touch",
  maxW: "full",
  px: "4",
  borderRadius: "full",
  bgColor: "paperSubtle",
  color: "ink",
  fontSize: "sm",
  fontWeight: "semibold",
  overflowWrap: "anywhere",
  cursor: "pointer",
  "&:has(input:checked)": { bgColor: "primary", color: "primaryText" },
  "&:has(input[aria-invalid=true])": { boxShadow: "inset 0 0 0 1px {colors.danger}" },
  // 선택된 칩은 초록 바탕이라 빨강 1px가 묻힌다: 빨강 2px + 흰 2px 간격으로 바탕과 떼어 보인다.
  "&:has(input:checked[aria-invalid=true])": { boxShadow: "inset 0 0 0 2px {colors.danger}, inset 0 0 0 4px {colors.paper}" },
  "&:has(input:focus-visible)": { outline: "2px solid", outlineColor: "primary", outlineOffset: "2px" },
  // 고대비 모드는 바탕색을 지우므로 선택 칩을 굵은 바깥 선으로도 구분한다.
  // 선택 칩에 포커스가 오면(라디오 묶음은 늘 그렇다) 선택 표시 대신 바깥 포커스 링을 보인다(더 구체적인 선택자라 이긴다).
  "@media (forced-colors: active)": {
    "&:has(input:checked)": { outline: "3px solid CanvasText", outlineOffset: "-3px" },
    "&:has(input:checked:focus-visible)": { outline: "3px solid Highlight", outlineOffset: "2px" },
  },
});

/**
 * 칩으로 하나를 고르는 묶음(방향 문서 DV-17, FD-18 (8)). `fieldset` + `legend` + 선택지마다 네이티브 라디오(시각적으로
 * 숨김) + 알약 칩 `label`이라 이름·화살표 키 이동은 브라우저 기본 동작이다. 빈 값(`""`)이면 선택된 칩이 없다.
 * 비활성(잠금) 상태는 지금 쓰는 곳이 없어 두지 않았다(지급자·수취자·필터 모두 비활성이 없다).
 * 오류는 묶음의 라디오 모두에 `aria-invalid`를 걸고(`fieldset`은 지원하지 않는다) `fieldset`의 `aria-describedby`로 아래
 * 문단을 연결한다. 문단은 오류가 없어도 남겨 두어 나중에 생긴 오류가 `aria-live`로 안내된다.
 */
export function ChoiceChips({
  legend,
  options,
  value,
  onChange,
  errors = [],
}: {
  legend: string;
  options: readonly ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  errors?: readonly string[];
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const invalid = errors.length > 0;
  return (
    <fieldset
      aria-describedby={invalid ? errorId : undefined}
      className={css({ border: "0", p: "0", m: "0", minW: "0" })}
    >
      <legend className={css({ p: "0", mb: "2", fontSize: "sm", fontWeight: "semibold", color: "inkMuted" })}>{legend}</legend>
      <div className={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
        {options.map((option) => (
          <label key={option.value} className={chipClass}>
            {/* ARIA 1.2는 radio에 aria-invalid를 두지 않지만, fieldset이 지원하지 않으므로 라디오 모두에 건다(DV-21·DV-17 결정).
                axe 검사에서는 위반이 아니다. */}
            {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
            <input
              type="radio"
              name={`${id}-choice`}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              aria-invalid={invalid ? true : undefined}
              className={css({ position: "absolute", opacity: "0", w: "1px", h: "1px", m: "0" })}
            />
            {option.label}
          </label>
        ))}
      </div>
      <div
        id={errorId}
        aria-live="polite"
        // 빈 영역도 접근성 트리에 남겨야 처음 생긴 오류가 안내된다(display: none을 쓰지 않는다). 여백만 내용이 있을 때 준다.
        className={css({ color: "danger", fontSize: "sm", fontWeight: "medium", "&:not(:empty)": { mt: "2" } })}
      >
        {errors.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </div>
    </fieldset>
  );
}
