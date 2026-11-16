import { type InputHTMLAttributes, useId } from "react";
import { css, cx } from "styled-system/css";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: string;
  /** 검증 사유 문구. 여러 개면 한 번에 모두 보인다. */
  errors?: string[];
  /** 입력란 바깥 오른쪽의 장식 글자(예: 금액 단위). 보조기기에는 숨기며, 폭이 모자라면 아래 줄로 내려간다. */
  suffix?: string;
}

/**
 * 입력·선택 상자의 공통 테두리(FD-18): 흰 바탕 + `line` 1px, 포커스 때 `primary` 2px, 오류 때 `danger` 2px.
 * 두께 차이는 안쪽 그림자로 더해 테두리가 굵어져도 글자가 움직이지 않는다. 오류 칸에 포커스가 가면 포커스 표시(`primary`)가
 * 보인다: 오류 테두리를 유지하면 포커스 전후 모양이 같아 포커스 위치를 알 수 없다(오류 문구와 연결은 그대로 남는다).
 * 바탕은 `bgColor`로만 정한다. 줄임 속성 `background`를 쓰면 선택 상자의 화살표 그림(`background-image`)을 지운다.
 */
export const fieldFrameClass = css({
  minH: "52px",
  borderWidth: "1px",
  borderColor: "line",
  borderRadius: "md",
  bgColor: "paper",
  color: "ink",
  "&[aria-invalid=true]": { borderColor: "danger", boxShadow: "inset 0 0 0 1px {colors.danger}" },
  _focusVisible: { outline: "none", borderColor: "primary", boxShadow: "inset 0 0 0 1px {colors.primary}" },
  _disabled: { bgColor: "disabledBg", color: "disabledText", cursor: "not-allowed" },
});

/** `<label>`로 연결된 입력. 오류는 `aria-describedby`로 연결되고 `aria-live`로 안내한다(FD-11). */
export function TextField({ label, hint, errors = [], suffix, className, ...inputProps }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, errors.length > 0 ? errorId : null]
    .filter(Boolean)
    .join(" ");

  const input = (
    <input
      {...inputProps}
      id={id}
      aria-invalid={errors.length > 0 ? true : undefined}
      aria-describedby={describedBy || undefined}
      className={cx(fieldFrameClass, css({ px: "4" }), suffix ? css({ flex: "1 1 160px", minW: "160px" }) : undefined, className)}
    />
  );

  return (
    <div className={css({ display: "flex", flexDirection: "column", gap: "1" })}>
      <label htmlFor={id} className={css({ fontSize: "sm", fontWeight: "semibold", color: "inkMuted" })}>
        {label}
      </label>
      {hint ? (
        <p id={hintId} className={css({ color: "inkMuted", fontSize: "sm" })}>
          {hint}
        </p>
      ) : null}
      {suffix ? (
        <div className={css({ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: "2", rowGap: "1" })}>
          {input}
          <span
            aria-hidden="true"
            className={css({ fontWeight: "semibold", color: "inkMuted", overflowWrap: "anywhere", minW: "0" })}
          >
            {suffix}
          </span>
        </div>
      ) : (
        input
      )}
      {/* 오류가 없어도 영역은 유지해야 나중에 생긴 오류가 안내된다. */}
      <div id={errorId} aria-live="polite" className={css({ color: "danger", fontSize: "sm", fontWeight: "medium" })}>
        {errors.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </div>
    </div>
  );
}
