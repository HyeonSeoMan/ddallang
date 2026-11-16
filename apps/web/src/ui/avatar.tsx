import { cva } from "styled-system/css";
import { avatarColors } from "./tokens";

const avatar = cva({
  base: {
    w: "40px",
    h: "40px",
    flex: "none",
    borderRadius: "full",
    display: "grid",
    placeItems: "center",
    fontSize: "md",
    fontWeight: "bold",
    // 글자는 `content`로 그려 행의 글자 내용(textContent)에 섞이지 않게 한다. 장식이다.
    _before: { content: "attr(data-initial)" },
  },
  variants: {
    inactive: {
      true: { bgColor: "paperSubtle", color: "inkMuted" },
      false: { color: "ink" },
    },
  },
});

/**
 * 목록 행 아바타(DV-11). 닉네임 첫 글자를 6색 중 하나의 원 위에 둔다. 색은 **스냅샷 참여자 목록(비활성 포함,
 * 서버 순서)에서의 위치 % 6**으로 고르고, 비활성은 회색이다. 장식이라 보조기기에는 숨기며 이름이 항상 곁에 나온다.
 */
export function Avatar({ name, index, inactive = false }: { name: string; index: number; inactive?: boolean }) {
  const first = [...name][0] ?? "";
  const background = avatarColors[((index % avatarColors.length) + avatarColors.length) % avatarColors.length];
  return (
    <div
      aria-hidden="true"
      data-initial={first}
      className={avatar({ inactive })}
      style={inactive ? undefined : { backgroundColor: background }}
    />
  );
}
