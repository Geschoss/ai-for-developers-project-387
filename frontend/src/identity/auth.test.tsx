import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../app/App";

const problem = (status: number, body: unknown): Response =>
  Response.json(body, {
    headers: { "content-type": "application/problem+json" },
    status,
  });

const json = (status: number, body: unknown): Response => Response.json(body, { status });

const anonymous = async (): Promise<Response> => {
  const response = await Promise.resolve(
    problem(401, { code: "unauthenticated", status: 401, title: "Unauthorized" }),
  );
  return response;
};

const urlOf = (input: RequestInfo | URL): string => {
  if (input instanceof Request) {
    return input.url;
  }
  return String(input);
};

const owner = {
  calendarSlug: "anna",
  email: "anna@example.com",
  name: "Анна",
  role: "owner" as const,
  timeZone: "Europe/Moscow",
};

const fill = (label: string, value: string): void => {
  fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });
};

const fillRegistration = (): void => {
  fill("Имя", "Анна");
  fill("Email", "anna@example.com");
  fill("Пароль", "long-enough");
  fill("Адрес календаря", "anna");
};

describe("owner session", () => {
  beforeEach(() => {
    globalThis.history.pushState({}, "", "/");
  });

  it.each(["/events", "/settings"])("sends an anonymous visitor from %s to login", async (path) => {
    globalThis.history.pushState({}, "", path);
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Вход" })).toBeInTheDocument();
    expect(globalThis.location.pathname).toBe("/login");
  });

  it("sends a logged-in owner away from registration", async () => {
    vi.stubGlobal("fetch", async (): Promise<Response> => {
      const response = await Promise.resolve(json(200, owner));
      return response;
    });
    globalThis.history.pushState({}, "", "/register");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Предстоящие события" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Мой календарь" })).toHaveAttribute("href", "/u/anna");
    expect(screen.getByRole("button", { name: "Скопировать ссылку" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Настройки" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Выйти" })).toBeInTheDocument();
    expect(globalThis.location.pathname).toBe("/events");
  });
});

const registrationFetch = (code: "email_taken" | "slug_taken"): typeof fetch =>
  vi.fn(async (input: RequestInfo | URL) => {
    if (urlOf(input).includes("/api/auth/register")) {
      const response = await Promise.resolve(
        problem(409, { code, status: 409, title: "Conflict" }),
      );
      return response;
    }
    const response = await anonymous();
    return response;
  });

const submitRegistration = async (): Promise<void> => {
  globalThis.history.pushState({}, "", "/register");
  render(<App />);
  await screen.findByLabelText("Имя", { exact: false });
  fillRegistration();
  fireEvent.click(screen.getByRole("button", { name: "Зарегистрироваться" }));
};

describe("registration field errors", () => {
  beforeEach(() => {
    globalThis.history.pushState({}, "", "/");
  });

  it("shows email_taken under the email field", async () => {
    vi.stubGlobal("fetch", registrationFetch("email_taken"));
    await submitRegistration();

    expect(await screen.findByText("Этот email уже зарегистрирован")).toBeInTheDocument();
  });

  it("shows slug_taken under the calendar slug field", async () => {
    vi.stubGlobal("fetch", registrationFetch("slug_taken"));
    await submitRegistration();

    expect(await screen.findByText("Этот адрес календаря уже занят")).toBeInTheDocument();
  });
});

describe("login errors", () => {
  beforeEach(() => {
    globalThis.history.pushState({}, "", "/");
  });

  it("does not say whether the email or the password was wrong", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (urlOf(input).includes("/api/auth/login")) {
          const response = await Promise.resolve(
            problem(401, { code: "invalid_credentials", status: 401, title: "Unauthorized" }),
          );
          return response;
        }
        const response = await anonymous();
        return response;
      }),
    );
    globalThis.history.pushState({}, "", "/login");
    render(<App />);
    await screen.findByLabelText("Email", { exact: false });
    fill("Email", "anna@example.com");
    fill("Пароль", "long-enough");
    fireEvent.click(screen.getByRole("button", { name: "Войти" }));

    expect(await screen.findByText("Неверный email или пароль")).toBeInTheDocument();
    expect(screen.queryByText("Этот email уже зарегистрирован")).not.toBeInTheDocument();
  });
});
