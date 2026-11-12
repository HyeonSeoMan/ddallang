// `Object.create(navigator)`로 감싸면 `onLine` 같은 getter가 "유효한 Navigator가 아니다"로 실패한다.
// 그래서 실제 `navigator`에 속성을 정의하고 시험이 끝나면 되돌린다.
const undo: Array<() => void> = [];

export function stubNavigator(name: string, value: unknown): void {
  const own = Object.getOwnPropertyDescriptor(navigator, name);
  Object.defineProperty(navigator, name, { value, configurable: true, writable: true });
  undo.push(() => {
    if (own) Object.defineProperty(navigator, name, own);
    else delete (navigator as unknown as Record<string, unknown>)[name];
  });
}

export function restoreNavigatorStubs(): void {
  while (undo.length > 0) undo.pop()?.();
}
