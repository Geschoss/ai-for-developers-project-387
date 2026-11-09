/* oxlint-disable eslint/max-lines -- the note scenarios share one HTTP app and its helpers */
import type { INestApplication } from "@nestjs/common";
import { type StartedPostgreSqlContainer, PostgreSqlContainer } from "@testcontainers/postgresql";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { testAppOptions } from "./app-options.js";
import { expectMatchesSpec } from "./contract.js";
import { openEventType } from "./open-event-type.js";

const wideRange = { from: "2020-01-01T00:00:00.000Z", to: "2040-01-01T00:00:00.000Z" };
// oxlint-disable-next-line eslint/no-magic-numbers -- the grid these tests book is 30 minutes
const halfHourMinutes = 30;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a Заметка к Бронированию is at most 500 characters
const maximumNoteLength = 500;
// oxlint-disable-next-line eslint/no-magic-numbers -- one character below the limit after trimming
const acceptedNoteLength = 495;
const lineBreak = "\n";

interface Slot {
  startAt: string;
  status: string;
}

interface Owner {
  cookie: string;
  eventTypeId: string;
  slug: string;
}

interface StoredBooking {
  note: string | null;
}

// oxlint-disable-next-line unicorn/no-useless-undefined -- initializer so TypeScript treats the binding as assigned before beforeAll
let database: StartedPostgreSqlContainer | undefined = undefined;
// oxlint-disable-next-line unicorn/no-useless-undefined -- initializer so TypeScript treats the binding as assigned before beforeAll
let app: INestApplication | undefined = undefined;

type HttpServer = Parameters<typeof request>[0];

// oxlint-disable-next-line typescript/no-unsafe-return -- NestJS types getHttpServer() as any
const httpServer = (application: INestApplication): HttpServer => application.getHttpServer();

const runningApp = (): INestApplication => {
  if (app === undefined) {
    throw new Error("The app was not started");
  }
  return app;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const firstHeader = (header: string | string[] | undefined): string | undefined => {
  if (Array.isArray(header)) {
    return header[0];
  }
  return header;
};

/** `sid=…` from a `Set-Cookie` header, without the cookie attributes. */
const sessionPair = (header: string | string[] | undefined): string => {
  const raw = firstHeader(header);
  if (raw === undefined) {
    throw new Error("Set-Cookie is missing");
  }
  const [pair] = raw.split(";");
  if (pair === undefined || !pair.startsWith("sid=")) {
    throw new Error("Set-Cookie is missing sid");
  }
  return pair;
};

let sequence = 0;

const registerOwner = async (): Promise<Owner> => {
  sequence += 1;
  const slug = `note-${sequence}`;
  const response = await request(httpServer(runningApp()))
    .post("/api/auth/register")
    .send({
      calendarSlug: slug,
      email: `${slug}@example.com`,
      name: "Анна",
      password: "long-enough",
      timeZone: "Europe/Moscow",
    });
  expectMatchesSpec(response, "post", "/api/auth/register");
  expect(response.status).toBe(201);
  const cookie = sessionPair(response.headers["set-cookie"]);
  const eventTypeId = await openEventType(runningApp(), cookie, {
    durationMinutes: halfHourMinutes,
    name: "Звонок",
  });
  return { cookie, eventTypeId, slug };
};

const isSlot = (value: unknown): value is Slot => {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value["startAt"] === "string" && typeof value["status"] === "string";
};

const slotsOf = (response: request.Response): Slot[] => {
  const body: unknown = response.body;
  if (!isRecord(body) || !Array.isArray(body["slots"]) || !body["slots"].every(isSlot)) {
    throw new Error("slots response is not a SlotList");
  }
  return body["slots"];
};

const listSlots = async (owner: Owner): Promise<request.Response> => {
  const response = await request(httpServer(runningApp()))
    .get(`/api/calendars/${owner.slug}/slots`)
    .query({ ...wideRange, eventTypeId: owner.eventTypeId });
  expectMatchesSpec(response, "get", "/api/calendars/{calendarSlug}/slots");
  return response;
};

/** The last free Слот: the furthest from now, so the test never races the wall clock. */
const furthestSlot = async (owner: Owner): Promise<Slot> => {
  const [slot] = slotsOf(await listSlots(owner)).slice(-1);
  if (slot === undefined) {
    throw new Error("Expected a bookable Слот");
  }
  return slot;
};

interface BookInput {
  email: string;
  note?: string | null;
  owner: Owner;
  startAt: string;
}

const book = async (input: BookInput): Promise<request.Response> => {
  const body: Record<string, unknown> = {
    eventTypeId: input.owner.eventTypeId,
    guest: { email: input.email, name: "Борис" },
    startAt: input.startAt,
  };
  if (input.note !== undefined) {
    body["note"] = input.note;
  }
  const response = await request(httpServer(runningApp()))
    .post(`/api/calendars/${input.owner.slug}/bookings`)
    .send(body);
  expectMatchesSpec(response, "post", "/api/calendars/{calendarSlug}/bookings");
  return response;
};

const isStoredBooking = (value: unknown): value is StoredBooking =>
  isRecord(value) && (typeof value["note"] === "string" || value["note"] === null);

const bookingsOf = (response: request.Response): StoredBooking[] => {
  const body: unknown = response.body;
  if (
    !isRecord(body) ||
    !Array.isArray(body["bookings"]) ||
    !body["bookings"].every(isStoredBooking)
  ) {
    throw new Error("bookings response is not a BookingList");
  }
  return body["bookings"];
};

const listUpcoming = async (owner: Owner): Promise<request.Response> => {
  const response = await request(httpServer(runningApp()))
    .get("/api/owner/bookings")
    .set("Cookie", owner.cookie);
  expectMatchesSpec(response, "get", "/api/owner/bookings");
  return response;
};

const noteOfConfirmation = (response: request.Response): string | null => {
  const body: unknown = response.body;
  if (!isRecord(body) || !("note" in body)) {
    throw new Error("BookingConfirmation has no note");
  }
  const { note } = body;
  if (typeof note !== "string" && note !== null) {
    throw new Error("note is neither a string nor null");
  }
  return note;
};

const problemCode = (response: request.Response): string | undefined => {
  const body: unknown = response.body;
  if (!isRecord(body) || typeof body["code"] !== "string") {
    return undefined;
  }
  return body["code"];
};

beforeAll(async () => {
  database = await new PostgreSqlContainer("postgres:18-alpine").start();
  app = await createApp(testAppOptions(database.getConnectionUri()));
  await app.init();
});

afterAll(async () => {
  if (app !== undefined) {
    await app.close();
  }
  if (database !== undefined) {
    await database.stop();
  }
});

describe("Заметка к Бронированию over HTTP", () => {
  it("trims the note and keeps its line breaks", async () => {
    const owner = await registerOwner();
    const slot = await furthestSlot(owner);
    const note = `  Первая строка${lineBreak}Вторая строка  `;

    const response = await book({
      email: "boris@example.com",
      note,
      owner,
      startAt: slot.startAt,
    });

    expect(response.status).toBe(201);
    expect(noteOfConfirmation(response)).toBe(`Первая строка${lineBreak}Вторая строка`);
    const listed = bookingsOf(await listUpcoming(owner));
    expect(listed.map((booking) => booking.note)).toEqual([
      `Первая строка${lineBreak}Вторая строка`,
    ]);
    expect(JSON.stringify((await listSlots(owner)).body)).not.toContain("Первая строка");
  });

  it("returns note: null when the Гость books without a Заметка", async () => {
    const owner = await registerOwner();
    const slot = await furthestSlot(owner);

    const response = await book({ email: "boris@example.com", owner, startAt: slot.startAt });

    expect(response.status).toBe(201);
    expect(noteOfConfirmation(response)).toBeNull();
    expect(bookingsOf(await listUpcoming(owner)).map((booking) => booking.note)).toEqual([null]);
  });

  it("treats a note of only whitespace as null", async () => {
    const owner = await registerOwner();
    const slot = await furthestSlot(owner);

    const response = await book({
      email: "boris@example.com",
      note: `  ${lineBreak}  `,
      owner,
      startAt: slot.startAt,
    });

    expect(response.status).toBe(201);
    expect(noteOfConfirmation(response)).toBeNull();
    expect(bookingsOf(await listUpcoming(owner)).map((booking) => booking.note)).toEqual([null]);
  });

  it("accepts 495 significant characters with spaces around them", async () => {
    const owner = await registerOwner();
    const slot = await furthestSlot(owner);
    const significant = "a".repeat(acceptedNoteLength);

    const response = await book({
      email: "boris@example.com",
      note: `  ${significant}  `,
      owner,
      startAt: slot.startAt,
    });

    expect(response.status).toBe(201);
    expect(noteOfConfirmation(response)).toBe(significant);
  });

  it("rejects a note over 500 characters after trimming", async () => {
    const owner = await registerOwner();
    const slot = await furthestSlot(owner);

    const response = await book({
      email: "boris@example.com",
      note: `  ${"a".repeat(maximumNoteLength + 1)}  `,
      owner,
      startAt: slot.startAt,
    });

    expect(response.status).toBe(400);
    expect(problemCode(response)).toBe("validation_failed");
    expect(bookingsOf(await listUpcoming(owner))).toEqual([]);
    expect(slotsOf(await listSlots(owner))).toContainEqual({
      startAt: slot.startAt,
      status: "free",
    });
  });

  it("keeps only the first Гость's note when the Слот is taken", async () => {
    const owner = await registerOwner();
    const slot = await furthestSlot(owner);
    const firstNote = "Заметка первого гостя";
    const secondNote = "Заметка второго гостя";

    const first = await book({
      email: "boris@example.com",
      note: firstNote,
      owner,
      startAt: slot.startAt,
    });
    const second = await book({
      email: "vera@example.com",
      note: secondNote,
      owner,
      startAt: slot.startAt,
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(problemCode(second)).toBe("slot_taken");
    expect(bookingsOf(await listUpcoming(owner)).map((booking) => booking.note)).toEqual([
      firstNote,
    ]);
    expect(JSON.stringify((await listUpcoming(owner)).body)).not.toContain(secondNote);
  });
});
