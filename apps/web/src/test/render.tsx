import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import type { ReactElement } from "react";
import { AnnouncerProvider } from "@/ui/announcer";

/** 화면 시험용 렌더: Jotai(시험이 쥔 store)·QueryClient(재시도 없음)·알림 영역을 함께 제공한다. */
export function renderApp(ui: ReactElement, store = createStore()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <AnnouncerProvider>{ui}</AnnouncerProvider>
      </QueryClientProvider>
    </Provider>,
  );
  return { ...view, store };
}
