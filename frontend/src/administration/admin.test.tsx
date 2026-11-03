import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../app/App";

const json = (status: number, body: unknown): Response => Response.json(body, { status });

const problem = (status: number, body: unknown): Response =>
  Response.json(body, {
    headers: { "content-type": "application/problem+json" },
    status,
  });

const urlOf = (input: RequestInfo | URL): string => {
  if (input instanceof Request) {
    return input.url;
  }
  return String(input);
};

const admin = { email: "admin@example.com", role: "admin" as const };

const owner = {
  calendarSlug: "anna",
  email: "anna@example.com",
  name: "Анна",
  role: "owner" as const,
  timeZone: "Europe/Moscow",
};

const owners = {
  owners: [
    {
      calendarSlug: "anna",
      email: "anna@example.com",
      name: "Анна",
      registeredAt: "2026-10-28T12:00:00.000Z",
      timeZone: "Europe/Moscow",
    },
  ],
};

const currentUser = async (me: unknown): Promise<Response> => {
  if (me === undefined) {
    const response = await Promise.resolve(
      problem(401, { code: "unauthenticated", status: 401, title: "Unauthorized" }),
    );
    return response;
  }
  return json(200, me);
};

/** `me` is who `/api/auth/me` answers with (401 when absent); login always succeeds as the admin. */
const backend =
  (me?: unknown): typeof fetch =>
  async (input: RequestInfo | URL): Promise<Response> => {
    const url = urlOf(input);
    if (url.includes("/api/admin/owners")) {
      return json(200, owners);
    }
    if (url.includes("/api/auth/login")) {
      return json(200, admin);
    }
    const response = await currentUser(me);
    return response;
  };

const fill = (label: string, value: string): void => {
  fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });
};

const logInAsAdmin = async (): Promise<void> => {
  vi.stubGlobal("fetch", backend());
  globalThis.history.pushState({}, "", "/login");
  render(<App />);
  await screen.findByLabelText("Email", { exact: false });
  fill("Email", admin.email);
  fill("Пароль", "admin-password");
  fireEvent.click(screen.getByRole("button", { name: "Войти" }));
};

const ownerRow = async (email: string): Promise<HTMLTableRowElement> => {
  const cell = await screen.findByText(email);
  const row = cell.closest("tr");
  if (row === null) {
    throw new Error("The owner is not in a table row");
  }
  return row;
};

describe("admin", () => {
  beforeEach(() => {
    globalThis.history.pushState({}, "", "/");
  });

  it("lands on the owners list after logging in", async () => {
    await logInAsAdmin();

    expect(await screen.findByRole("heading", { name: "Пользователи" })).toBeInTheDocument();
    expect(globalThis.location.pathname).toBe("/admin/users");
    expect(screen.getByRole("link", { name: "Пользователи" })).toHaveAttribute(
      "href",
      "/admin/users",
    );
    expect(screen.getByRole("button", { name: "Выйти" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Мой календарь" })).not.toBeInTheDocument();
  });

  it("sees each owner's name, email, link, time zone and registration date", async () => {
    vi.stubGlobal("fetch", backend(admin));
    globalThis.history.pushState({}, "", "/admin/users");
    render(<App />);

    const cells = within(await ownerRow("anna@example.com"));
    expect(cells.getByText("Анна")).toBeInTheDocument();
    expect(cells.getByRole("link")).toHaveAttribute("href", "http://localhost:3000/u/anna");
    expect(cells.getByText("Europe/Moscow")).toBeInTheDocument();
    expect(cells.getByText("28.10.2026")).toBeInTheDocument();
  });

  it.each(["/events", "/settings", "/login"])(
    "is sent from %s to the owners list",
    async (path) => {
      vi.stubGlobal("fetch", backend(admin));
      globalThis.history.pushState({}, "", path);
      render(<App />);

      expect(await screen.findByRole("heading", { name: "Пользователи" })).toBeInTheDocument();
      expect(globalThis.location.pathname).toBe("/admin/users");
    },
  );
});

describe("the owners list", () => {
  beforeEach(() => {
    globalThis.history.pushState({}, "", "/");
  });

  it("sends an owner to their events", async () => {
    vi.stubGlobal("fetch", backend(owner));
    globalThis.history.pushState({}, "", "/admin/users");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Предстоящие события" })).toBeInTheDocument();
    expect(globalThis.location.pathname).toBe("/events");
  });

  it("sends an anonymous visitor to login", async () => {
    globalThis.history.pushState({}, "", "/admin/users");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Вход" })).toBeInTheDocument();
    expect(globalThis.location.pathname).toBe("/login");
  });
});
