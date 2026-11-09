/* oxlint-disable eslint/max-lines -- the public Календарь scenarios share one fetch double */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../app/App";

const guest = vi.hoisted(() => ({ timeZone: "Europe/Moscow" }));

vi.mock("../shared/time-zones", () => ({
  browserTimeZone: (): string => guest.timeZone,
  timeZoneNames: ["Europe/Moscow", "America/New_York", "UTC"],
}));

const halfHourType = {
  description: "Короткий звонок",
  // oxlint-disable-next-line eslint/no-magic-numbers -- a 30-minute Тип события
  durationMinutes: 30 as const,
  id: "11111111-1111-4111-8111-111111111111",
  name: "Звонок",
};

const hourType = {
  description: "Часовой созвон",
  // oxlint-disable-next-line eslint/no-magic-numbers -- a 60-minute Тип события
  durationMinutes: 60 as const,
  id: "22222222-2222-4222-8222-222222222222",
  name: "Час",
};

let eventTypes: readonly (typeof halfHourType | typeof hourType)[] = [halfHourType];

const publicCalendar = (): {
  eventTypes: typeof eventTypes;
  ownerName: string;
  planningHorizonDays: number;
  timeZone: string;
} => ({
  eventTypes,
  ownerName: "Анна",
  planningHorizonDays: 14,
  timeZone: "Europe/Moscow",
});

const slots = {
  slots: [
    { startAt: "2026-11-02T06:00:00.000Z", status: "free" },
    { startAt: "2026-11-02T06:30:00.000Z", status: "booked" },
  ],
};

const partialThenFullDay = {
  slots: [
    { startAt: "2026-11-02T12:00:00.000Z", status: "free" },
    { startAt: "2026-11-03T06:00:00.000Z", status: "free" },
  ],
};

const problem = (status: number, body: unknown): Response =>
  Response.json(body, {
    headers: { "content-type": "application/problem+json" },
    status,
  });

const json = (status: number, body: unknown): Response => Response.json(body, { status });

const urlOf = (input: RequestInfo | URL): string => {
  if (input instanceof Request) {
    return input.url;
  }
  return String(input);
};

let listed = slots;
let booking: "created" | "horizon" | "own" | "past" | "taken" = "created";
let viewer: "guest" | "other" | "owner" = "guest";

const bothBooked = {
  slots: [
    { startAt: "2026-11-02T06:00:00.000Z", status: "booked" },
    { startAt: "2026-11-02T06:30:00.000Z", status: "booked" },
  ],
};

const confirmation = {
  ownerName: "Анна",
  ownerTimeZone: "Europe/Moscow",
  startAt: "2026-11-02T06:00:00.000Z",
};

const noteOf = async (input: RequestInfo | URL): Promise<string | null> => {
  if (!(input instanceof Request)) {
    return null;
  }
  const body: unknown = await input.clone().json();
  if (typeof body !== "object" || body === null || !("note" in body)) {
    return null;
  }
  const value = (body as Record<string, unknown>)["note"];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

const methodOf = (input: RequestInfo | URL): string => {
  if (input instanceof Request) {
    return input.method;
  }
  return "GET";
};

const rejectedBooking = (code: string): Response => {
  listed = bothBooked;
  return problem(422, { code, status: 422, title: "Unprocessable Entity" });
};

const refusalByOutcome: Record<string, string | undefined> = {
  horizon: "outside_planning_horizon",
  own: "own_calendar",
  past: "slot_in_past",
};

const refusalCode = (): string | undefined => refusalByOutcome[booking];

const bookingResponse = async (input: RequestInfo | URL): Promise<Response> => {
  const code = refusalCode();
  if (code !== undefined) {
    return rejectedBooking(code);
  }
  listed = bothBooked;
  if (booking === "taken") {
    return problem(409, { code: "slot_taken", status: 409, title: "Conflict" });
  }
  return json(201, { ...confirmation, note: await noteOf(input) });
};

const viewerSlug = (): string => {
  if (viewer === "owner") {
    return "anna";
  }
  return "boris";
};

const currentUser = (): Response => {
  if (viewer === "guest") {
    return problem(401, { code: "unauthenticated", status: 401, title: "Unauthorized" });
  }
  return json(200, {
    calendarSlug: viewerSlug(),
    email: "anna@example.com",
    name: "Анна",
    role: "owner",
    timeZone: "Europe/Moscow",
  });
};

const calendarResponse = (url: string): Response => {
  if (url.includes("/api/calendars/missing-slug")) {
    return problem(404, { code: "calendar_not_found", status: 404, title: "Not Found" });
  }
  if (url.includes("/api/calendars/anna")) {
    return json(200, publicCalendar());
  }
  return problem(404, { code: "not_found", status: 404, title: "Not Found" });
};

const fetchCalendar = async (input: RequestInfo | URL): Promise<Response> => {
  const url = urlOf(input);
  if (url.includes("/api/auth/me")) {
    return currentUser();
  }
  if (methodOf(input) === "POST" && url.includes("/bookings")) {
    return bookingResponse(input);
  }
  if (url.includes("/slots")) {
    return json(200, listed);
  }
  return calendarResponse(url);
};

const renderAt = (path: string): void => {
  globalThis.history.pushState({}, "", path);
  render(<App />);
};

const resetGuest = (): void => {
  guest.timeZone = "Europe/Moscow";
  eventTypes = [halfHourType];
  listed = slots;
  booking = "created";
  viewer = "guest";
  vi.stubGlobal("fetch", fetchCalendar);
};

describe("public calendar", () => {
  beforeEach(resetGuest);

  it("shows the day and Слот status in the Гость's zone when it matches the Владелец", async () => {
    renderAt("/u/anna");

    expect(
      await screen.findByRole("heading", { name: "Запись на звонок у Анна" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Ваш часовой пояс/u)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^2 ноября/u }));

    expect(screen.getByText("09:00–09:30")).toBeInTheDocument();
    expect(screen.getByText("09:30–10:00")).toBeInTheDocument();
    expect(screen.getByText("Свободно")).toBeInTheDocument();
    expect(screen.getByText("Занято")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Звонок" })).toBeChecked();
  });

  it("shows the zone banner and shifts Слот time when the zones differ", async () => {
    guest.timeZone = "America/New_York";
    renderAt("/u/anna");

    expect(
      await screen.findByText(
        "Ваш часовой пояс: America/New_York. У владельца (Europe/Moscow): 09:00.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^2 ноября/u }));

    expect(screen.getByText("01:00–01:30")).toBeInTheDocument();
    expect(screen.getByText("01:30–02:00")).toBeInTheDocument();
    expect(screen.queryByText("09:00–09:30")).not.toBeInTheDocument();
  });
});

describe("Тип события on a public Календарь", () => {
  beforeEach(resetGuest);

  it("shows no booking board when the Календарь has no Типы событий", async () => {
    eventTypes = [];
    renderAt("/u/anna");

    expect(await screen.findByText("В этом Календаре нет Типов событий")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ноября/u })).not.toBeInTheDocument();
  });

  it("shows the range of the Тип события the Гость picks", async () => {
    eventTypes = [halfHourType, hourType];
    renderAt("/u/anna");
    fireEvent.click(await screen.findByRole("button", { name: /^2 ноября/u }));
    expect(screen.getByText("09:00–09:30")).toBeInTheDocument();

    screen.getByRole("radio", { name: "Час" }).click();
    expect(await screen.findByRole("radio", { checked: true, name: "Час" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: /^2 ноября/u }));

    expect(screen.getByText("09:00–10:00")).toBeInTheDocument();
    expect(screen.queryByText("09:00–09:30")).not.toBeInTheDocument();
  });
});

describe("the zone banner", () => {
  beforeEach(resetGuest);

  it("moves the banner to the owner time of the day the Гость picked", async () => {
    guest.timeZone = "America/New_York";
    listed = partialThenFullDay;
    renderAt("/u/anna");

    expect(
      await screen.findByText(
        "Ваш часовой пояс: America/New_York. У владельца (Europe/Moscow): 15:00.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^3 ноября/u }));

    expect(
      screen.getByText("Ваш часовой пояс: America/New_York. У владельца (Europe/Moscow): 09:00."),
    ).toBeInTheDocument();
  });

  it("shows a not-found page for an unknown Адрес календаря", async () => {
    renderAt("/u/missing-slug");

    expect(await screen.findByRole("heading", { name: "Календарь не найден" })).toBeInTheDocument();
    expect(screen.queryByText(/Ваш часовой пояс/u)).not.toBeInTheDocument();
  });
});

const noteLabel = "О чём хотите поговорить?";

const bookFirstSlot = (time: RegExp, note?: string): void => {
  fireEvent.click(screen.getByRole("button", { name: time }));
  fireEvent.change(screen.getByLabelText("Имя", { exact: false }), {
    target: { value: "Борис" },
  });
  fireEvent.change(screen.getByLabelText("Email", { exact: false }), {
    target: { value: "boris@example.com" },
  });
  if (note !== undefined) {
    fireEvent.change(screen.getByLabelText(noteLabel, { exact: false }), {
      target: { value: note },
    });
  }
  fireEvent.click(screen.getByRole("button", { name: "Забронировать" }));
};

const bookedOnTheDay = 2;

describe("booking a Слот", () => {
  beforeEach(resetGuest);

  it("shows «Вы записаны» in both zones and marks the Слот booked", async () => {
    guest.timeZone = "America/New_York";
    renderAt("/u/anna");
    fireEvent.click(await screen.findByRole("button", { name: /^2 ноября/u }));
    bookFirstSlot(/01:00–01:30/u);

    expect(await screen.findByRole("heading", { name: "Вы записаны" })).toBeInTheDocument();
    expect(screen.getByText("Анна")).toBeInTheDocument();
    expect(screen.getByText("2 ноября")).toBeInTheDocument();
    expect(screen.getByText("Ваше время: 01:00–01:30")).toBeInTheDocument();
    expect(screen.getByText("Время владельца (Europe/Moscow): 09:00–09:30")).toBeInTheDocument();
    expect(screen.queryByTestId("booking-note")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^2 ноября, свободно 0$/u })).toBeInTheDocument();
  });

  it("shows the Заметка к Бронированию on «Вы записаны» with its line breaks", async () => {
    renderAt("/u/anna");
    fireEvent.click(await screen.findByRole("button", { name: /^2 ноября/u }));
    bookFirstSlot(/09:00–09:30/u, "Вопрос про проект\nи контекст");

    expect(await screen.findByRole("heading", { name: "Вы записаны" })).toBeInTheDocument();
    const note = screen.getByTestId("booking-note");
    expect(note.textContent).toBe("Вопрос про проект\nи контекст");
    expect(note).toHaveStyle({ whiteSpace: "pre-wrap" });
  });

  it("keeps the Заметка in the textarea when the Слот was taken", async () => {
    booking = "taken";
    renderAt("/u/anna");
    fireEvent.click(await screen.findByRole("button", { name: /^2 ноября/u }));
    bookFirstSlot(/09:00–09:30/u, "Не потеряй меня");

    expect(await screen.findByText("Этот слот уже занят")).toBeInTheDocument();
    expect(screen.getByLabelText(noteLabel, { exact: false })).toHaveValue("Не потеряй меня");
  });

  it("says the Слот was taken and refreshes the day", async () => {
    booking = "taken";
    renderAt("/u/anna");
    fireEvent.click(await screen.findByRole("button", { name: /^2 ноября/u }));
    bookFirstSlot(/09:00–09:30/u);

    expect(await screen.findByText("Этот слот уже занят")).toBeInTheDocument();
    expect(screen.queryByText("Свободно")).not.toBeInTheDocument();
    expect(screen.getAllByText("Занято")).toHaveLength(bookedOnTheDay);
    expect(screen.getByRole("button", { name: /^2 ноября, свободно 0$/u })).toBeInTheDocument();
  });

  it.each([
    ["past", "Этот слот уже начался или прошёл"],
    ["horizon", "Этот слот за Горизонтом планирования"],
    ["own", "Свой календарь бронировать нельзя"],
  ] as const)("shows the Russian text for %s", async (outcome, text) => {
    booking = outcome;
    renderAt("/u/anna");
    fireEvent.click(await screen.findByRole("button", { name: /^2 ноября/u }));
    bookFirstSlot(/09:00–09:30/u);

    expect(await screen.findByText(text)).toBeInTheDocument();
  });
});

describe("the Владелец on a public page", () => {
  beforeEach(resetGuest);

  it("says their own calendar cannot be booked and hides the form", async () => {
    viewer = "owner";
    renderAt("/u/anna");

    expect(await screen.findByText("Свой календарь бронировать нельзя")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^2 ноября/u }));
    fireEvent.click(screen.getByRole("button", { name: /09:00–09:30/u }));

    expect(screen.queryByRole("button", { name: "Забронировать" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Имя", { exact: false })).not.toBeInTheDocument();
  });

  it("still offers the form on someone else's calendar", async () => {
    viewer = "other";
    renderAt("/u/anna");
    fireEvent.click(await screen.findByRole("button", { name: /^2 ноября/u }));
    fireEvent.click(screen.getByRole("button", { name: /09:00–09:30/u }));

    expect(screen.getByRole("button", { name: "Забронировать" })).toBeInTheDocument();
    expect(screen.queryByText("Свой календарь бронировать нельзя")).not.toBeInTheDocument();
  });
});
