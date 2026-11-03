import { type Page, expect } from "@playwright/test";

// oxlint-disable-next-line eslint/no-magic-numbers -- the e2e grid books a 30-minute Тип события
const halfHourMinutes = 30;

interface CreatedType {
  id: string;
}

const isCreatedType = (value: unknown): value is CreatedType =>
  typeof value === "object" && value !== null && "id" in value && typeof value.id === "string";

/** The Владелец opens one 30-minute Тип события. Registration itself creates none. */
const openHalfHourType = async (page: Page): Promise<string> => {
  const response = await page.request.post("/api/owner/event-types", {
    data: {
      description: "Короткий звонок",
      durationMinutes: halfHourMinutes,
      name: "Звонок",
    },
  });
  expect(response.ok()).toBeTruthy();
  const body: unknown = await response.json();
  if (!isCreatedType(body)) {
    throw new Error("Тип события response has no id");
  }
  return body.id;
};

export { openHalfHourType };
