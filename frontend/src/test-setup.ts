import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

/** Anonymous by default. A test that needs a session stubs `fetch` itself. */
const anonymous = (): Response =>
  Response.json(
    { code: "unauthenticated", status: 401, title: "Unauthorized" },
    { headers: { "content-type": "application/problem+json" }, status: 401 },
  );

beforeEach(() => {
  vi.stubGlobal("fetch", async (): Promise<Response> => {
    const response = await Promise.resolve(anonymous());
    return response;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// oxlint-disable-next-line eslint/no-empty-function -- jsdom has no matchMedia; the listeners are never called
const ignore = (): void => {};

// Mantine reads color-scheme media queries, which jsdom lacks.
const mediaQueryList = (query: string): MediaQueryList => ({
  addEventListener: ignore,
  // oxlint-disable-next-line typescript/no-deprecated -- the MediaQueryList type still requires this legacy method
  addListener: ignore,
  dispatchEvent: (): boolean => false,
  matches: false,
  media: query,
  // oxlint-disable-next-line unicorn/no-null -- MediaQueryList.onchange is null until a listener is set
  onchange: null,
  removeEventListener: ignore,
  // oxlint-disable-next-line typescript/no-deprecated -- the MediaQueryList type still requires this legacy method
  removeListener: ignore,
});

globalThis.matchMedia ??= mediaQueryList;

const noop = (): void => {
  // Layout measurement is unused in jsdom.
};

// Mantine Select scrolls its list through ResizeObserver, which jsdom does not implement.
class ResizeObserverStub implements ResizeObserver {
  public readonly disconnect = noop;

  public readonly observe = noop;

  public readonly unobserve = noop;
}

globalThis.ResizeObserver ??= ResizeObserverStub;
