import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Пользователи. Роль `owner` — Владелец; роль `admin` — Администратор.
 * Календарь живёт в `calendars` (ADR-0008). Администратор один: его создаёт старт приложения.
 */
const users = pgTable(
  "users",
  {
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    email: text("email").notNull(),
    id: uuid("id").primaryKey(),
    name: text("name"),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["owner", "admin"] }).notNull(),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(sql`lower(${table.email})`),
    uniqueIndex("users_single_admin")
      .on(table.role)
      .where(sql`${table.role} = 'admin'`),
  ],
);

/** Серверная сессия. Идентификатор — значение cookie `sid`. */
const sessions = pgTable("sessions", {
  expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

/**
 * Календарь Владельца. У Владельца ровно одна строка; у Администратора её нет (ADR-0008).
 * Бронирование блокирует эту строку, а не строку Владельца (ADR-0003).
 */
const calendars = pgTable(
  "calendars",
  {
    dailyBookingLimit: integer("daily_booking_limit").notNull(),
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planningHorizonDays: integer("planning_horizon_days").notNull(),
    slug: text("slug").notNull(),
    timeZone: text("time_zone").notNull(),
  },
  (table) => [
    uniqueIndex("calendars_owner_unique").on(table.ownerId),
    uniqueIndex("calendars_slug_unique").on(table.slug),
  ],
);

/**
 * Тип события Календаря. Длительность задаёт длину Слота.
 * Изменить и удалить тип нельзя: строка только дописывается.
 */
const eventTypes = pgTable(
  "event_types",
  {
    calendarId: uuid("calendar_id")
      .notNull()
      .references(() => calendars.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    description: text("description").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
  },
  (table) => [
    // oxlint-disable-next-line eslint/no-magic-numbers -- spec: duration is 30..540, step 30
    check(
      "event_types_duration_step",
      sql`${table.durationMinutes} >= 30 and ${table.durationMinutes} <= 540 and ${table.durationMinutes} % 30 = 0`,
    ),
    // oxlint-disable-next-line eslint/no-magic-numbers -- spec: a name is 1..100 characters
    check("event_types_name_length", sql`char_length(${table.name}) between 1 and 100`),
    // oxlint-disable-next-line eslint/no-magic-numbers -- spec: a description is 1..1000 characters
    check(
      "event_types_description_length",
      sql`char_length(${table.description}) between 1 and 1000`,
    ),
  ],
);

/**
 * Бронирование. Пересечение полуинтервалов `[start_at, end_at)` одного Календаря запрещает
 * exclusion-ограничение (ADR-0009). Список Слотов читает только границы: имя и email Гостя наружу не отдаются.
 */
const bookings = pgTable(
  "bookings",
  {
    calendarId: uuid("calendar_id")
      .notNull()
      .references(() => calendars.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    endAt: timestamp("end_at", { mode: "date", withTimezone: true }).notNull(),
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "cascade" }),
    guestEmail: text("guest_email").notNull(),
    guestName: text("guest_name").notNull(),
    id: uuid("id").primaryKey(),
    startAt: timestamp("start_at", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [check("bookings_end_after_start", sql`${table.endAt} > ${table.startAt}`)],
);

export { bookings, calendars, eventTypes, sessions, users };
