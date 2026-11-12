import { type InputHTMLAttributes, useId } from "react";
import { css, cx } from "styled-system/css";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: string;
  /** 검증 사유 문구. 여러 개면 한 번에 모두 보인다. */
  errors?: string[];
}

/** `<label>`로 연결된 입력. 오류는 `aria-describedby`로 연결되고 `aria-live`로 안내한다(FD-11). */
export function TextField({ label, hint, errors = [], className, ...inputProps }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, errors.length > 0 ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={css({ display: "flex", flexDirection: "column", gap: "1" })}>
      <label htmlFor={id} className={css({ fontWeight: "semibold" })}>
        {label}
      </label>
      {hint ? (
        <p id={hintId} className={css({ color: "inkMuted", fontSize: "sm" })}>
          {hint}
        </p>
      ) : null}
      <input
        {...inputProps}
        id={id}
        aria-invalid={errors.length > 0 ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cx(
          css({
            minH: "touch",
            px: "3",
            borderWidth: "2px",
            borderColor: "line",
            borderRadius: "md",
            bg: "paper",
            color: "ink",
          }),
          className,
        )}
      />
      {/* 오류가 없어도 영역은 유지해야 나중에 생긴 오류가 안내된다. */}
      <div id={errorId} aria-live="polite" className={css({ color: "errorText" })}>
        {errors.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </div>
    </div>
  );
}
