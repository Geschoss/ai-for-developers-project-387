import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../app/App";

// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a new Владелец starts with a horizon of 14 days
const defaultPlanningHorizonDays = 14;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a new Владелец starts with a limit of 2
const defaultDailyBookingLimit = 2;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: Горизонт планирования is at most 60 days
const maxPlanningHorizonDays = 60;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: Лимит бронирований is at most 18
const maxDailyBookingLimit = 18;

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

const owner = {
  calendarSlug: "anna",
  email: "anna@example.com",
  name: "Анна",
  role: "owner" as const,
  timeZone: "Europe/Moscow",
};

const defaults = {
  dailyBookingLimit: defaultDailyBookingLimit,
  planningHorizonDays: defaultPlanningHorizonDays,
  timeZone: "Europe/Moscow",
};

const validation = (path: string): Response =>
  problem(400, {
    code: "validation_failed",
    issues: [{ message: "no", path }],
    status: 400,
    title: "Bad Request",
  });

const createdTypeId = "11111111-1111-4111-8111-111111111111";

const createdType = (body: unknown): Response => {
  if (typeof body !== "object" || body === null) {
    return json(201, { id: createdTypeId });
  }
  return json(201, { ...body, id: createdTypeId });
};

const eventTypeResponse = async (input: RequestInfo | URL): Promise<Response> => {
  if (input instanceof Request && input.method === "POST") {
    return createdType(await input.json());
  }
  return json(200, { eventTypes: [] });
};

const settingsFetch =
  (onPut: (body: unknown) => Response): typeof fetch =>
  async (input: RequestInfo | URL): Promise<Response> => {
    const url = urlOf(input);
    if (url.includes("/api/owner/event-types")) {
      return eventTypeResponse(input);
    }
    if (input instanceof Request && url.includes("/api/owner/settings") && input.method === "PUT") {
      return onPut(await input.json());
    }
    if (url.includes("/api/owner/settings")) {
      return json(200, defaults);
    }
    return json(200, owner);
  };

const fill = (label: string, value: string): void => {
  fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });
};

const openSettings = async (): Promise<void> => {
  globalThis.history.pushState({}, "", "/settings");
  render(<App />);
  await screen.findByLabelText("Горизонт планирования", { exact: false });
};

const saved = {
  dailyBookingLimit: maxDailyBookingLimit,
  planningHorizonDays: maxPlanningHorizonDays,
  timeZone: "Europe/Moscow",
};

const captureSave = (): { body: () => unknown; puts: () => number } => {
  let sent: unknown = undefined;
  let puts = 0;
  vi.stubGlobal(
    "fetch",
    settingsFetch((body) => {
      puts += 1;
      sent = body;
      return json(200, saved);
    }),
  );
  return { body: (): unknown => sent, puts: (): number => puts };
};

const expectKept = (): void => {
  expect(screen.getByLabelText("Горизонт планирования", { exact: false })).toHaveValue(
    maxPlanningHorizonDays,
  );
  expect(screen.getByLabelText("Лимит бронирований", { exact: false })).toHaveValue(
    maxDailyBookingLimit,
  );
};

const submitInvalid = async (label: string, value: string, message: string): Promise<void> => {
  let puts = 0;
  vi.stubGlobal(
    "fetch",
    settingsFetch(() => {
      puts += 1;
      return json(200, defaults);
    }),
  );
  await openSettings();
  fill(label, value);
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  expect(await screen.findByText(message)).toBeInTheDocument();
  expect(screen.queryByText("Настройки сохранены")).not.toBeInTheDocument();
  expect(puts).toBe(0);
};

describe("owner settings", () => {
  beforeEach(() => {
    globalThis.history.pushState({}, "", "/");
  });

  it("shows the current time zone, horizon and limit", async () => {
    vi.stubGlobal(
      "fetch",
      settingsFetch(() => json(200, defaults)),
    );
    await openSettings();

    expect(screen.getByRole("heading", { name: "Настройки" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Часовой пояс" })).toHaveValue("Europe/Moscow");
    expect(screen.getByLabelText("Горизонт планирования", { exact: false })).toHaveValue(
      defaultPlanningHorizonDays,
    );
    expect(screen.getByLabelText("Лимит бронирований", { exact: false })).toHaveValue(
      defaultDailyBookingLimit,
    );
  });

  it("confirms a save and keeps the values that were stored", async () => {
    const sent = captureSave();
    await openSettings();
    fill("Горизонт планирования", String(maxPlanningHorizonDays));
    fill("Лимит бронирований", String(maxDailyBookingLimit));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByText("Настройки сохранены")).toBeInTheDocument();
    expectKept();
    expect(sent.puts()).toBe(1);
    expect(sent.body()).toEqual(saved);
  });
});

describe("owner settings validation", () => {
  beforeEach(() => {
    globalThis.history.pushState({}, "", "/");
  });

  it("rejects a horizon outside 1–60 without calling the API", async () => {
    await submitInvalid(
      "Горизонт планирования",
      String(maxPlanningHorizonDays + 1),
      "Горизонт планирования — целое число от 1 до 60",
    );
  });

  it("rejects a limit outside 1–18 without calling the API", async () => {
    await submitInvalid("Лимит бронирований", "0", "Лимит бронирований — целое число от 1 до 18");
  });

  it("shows an unknown time zone on the field", async () => {
    vi.stubGlobal(
      "fetch",
      settingsFetch(() => validation("/body/timeZone")),
    );
    await openSettings();
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByText("Выберите часовой пояс из списка")).toBeInTheDocument();
    expect(screen.queryByText("Настройки сохранены")).not.toBeInTheDocument();
  });

  it("shows a schema rejection for the horizon on the field", async () => {
    vi.stubGlobal(
      "fetch",
      settingsFetch(() => validation("/body/planningHorizonDays")),
    );
    await openSettings();
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(
      await screen.findByText("Горизонт планирования — целое число от 1 до 60"),
    ).toBeInTheDocument();
  });
});

const fillEventType = async (): Promise<void> => {
  fireEvent.change(await screen.findByLabelText("Название"), { target: { value: "Звонок" } });
  fireEvent.change(screen.getByLabelText("Описание"), { target: { value: "Короткий звонок" } });
  fireEvent.change(screen.getByLabelText("Длительность, минуты"), { target: { value: "60" } });
  fireEvent.click(screen.getByRole("button", { name: "Добавить" }));
};

describe("creating a Тип события", () => {
  beforeEach(() => {
    globalThis.history.pushState({}, "", "/");
  });

  it("adds a Тип события and does not show its id", async () => {
    vi.stubGlobal(
      "fetch",
      settingsFetch(() => json(200, defaults)),
    );
    await openSettings();
    await fillEventType();

    expect(await screen.findByText("Тип события добавлен")).toBeInTheDocument();
    expect(screen.getByText("Звонок")).toBeInTheDocument();
    expect(screen.getByText("Короткий звонок")).toBeInTheDocument();
    expect(screen.getByText("60 минут")).toBeInTheDocument();
    expect(screen.queryByText(createdTypeId)).not.toBeInTheDocument();
  });
});

describe("loading owner settings", () => {
  beforeEach(() => {
    globalThis.history.pushState({}, "", "/");
  });

  it("says when the settings could not be loaded", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL): Promise<Response> => {
      if (urlOf(input).includes("/api/owner/settings")) {
        const response = await Promise.resolve(
          problem(500, { code: "internal_error", status: 500, title: "Error" }),
        );
        return response;
      }
      const response = await Promise.resolve(json(200, owner));
      return response;
    });
    globalThis.history.pushState({}, "", "/settings");
    render(<App />);

    expect(await screen.findByText("Не удалось загрузить настройки")).toBeInTheDocument();
  });
});
