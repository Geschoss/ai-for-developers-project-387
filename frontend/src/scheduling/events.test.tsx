import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../app/App";

const json = (status: number, body: unknown): Response => Response.json(body, { status });

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

/** 09:00 and 09:30 on 2026-03-28 in Europe/Moscow. Created the day before at 14:40. */
const upcoming = {
  bookings: [
    {
      createdAt: "2026-03-27T11:40:00.000Z",
      eventTypeName: "Звонок",
      guest: { email: "boris@example.com", name: "Борис" },
      id: "11111111-1111-4111-8111-111111111111",
      startAt: "2026-03-28T06:00:00.000Z",
    },
    {
      createdAt: "2026-03-27T12:00:00.000Z",
      eventTypeName: "Созвон",
      guest: { email: "vera@example.com", name: "Вера" },
      id: "22222222-2222-4222-8222-222222222222",
      startAt: "2026-03-28T06:30:00.000Z",
    },
  ],
};

const backend =
  (bookings: unknown): typeof fetch =>
  async (input: RequestInfo | URL): Promise<Response> => {
    if (urlOf(input).includes("/api/owner/bookings")) {
      const response = await Promise.resolve(json(200, bookings));
      return response;
    }
    const response = await Promise.resolve(json(200, owner));
    return response;
  };

interface ShownGuest {
  created: string;
  email: string;
  eventType: string;
  name: string;
  slot: string;
}

const expectGuest = (guest: ShownGuest): void => {
  expect(screen.getByText(guest.name)).toBeInTheDocument();
  expect(screen.getByText(guest.email)).toBeInTheDocument();
  expect(screen.getByText(guest.eventType)).toBeInTheDocument();
  expect(screen.getByText(guest.slot)).toBeInTheDocument();
  expect(screen.getByText(guest.created)).toBeInTheDocument();
};

const openEvents = async (): Promise<void> => {
  globalThis.history.pushState({}, "", "/events");
  render(<App />);
  await screen.findByRole("heading", { name: "Предстоящие события" });
};

describe("предстоящие события", () => {
  beforeEach(() => {
    globalThis.history.pushState({}, "", "/");
  });

  it("shows an empty state when the Владелец has no upcoming Бронирования", async () => {
    vi.stubGlobal("fetch", backend({ bookings: [] }));
    await openEvents();

    expect(await screen.findByText("Предстоящих событий нет")).toBeInTheDocument();
  });

  it("shows each Гость, the Слот in the Владелец's time zone, and when it was created", async () => {
    vi.stubGlobal("fetch", backend(upcoming));
    await openEvents();

    const boris = await screen.findByText("Борис");
    const vera = screen.getByText("Вера");
    expectGuest({
      created: "Создано: 27.03.2026, 14:40",
      email: "boris@example.com",
      eventType: "Звонок",
      name: "Борис",
      slot: "Слот: 2026-03-28-09:00",
    });
    expectGuest({
      created: "Создано: 27.03.2026, 15:00",
      email: "vera@example.com",
      eventType: "Созвон",
      name: "Вера",
      slot: "Слот: 2026-03-28-09:30",
    });
    expect(boris.compareDocumentPosition(vera)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.queryByText("Предстоящих событий нет")).not.toBeInTheDocument();
  });
});
