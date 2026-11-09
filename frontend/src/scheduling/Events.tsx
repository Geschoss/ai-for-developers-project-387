import { Alert, Card, Container, Loader, Stack, Text, Title } from "@mantine/core";
import { type ReactElement, useEffect, useState } from "react";
import type { components } from "spec/api";

import { useSession } from "../app/session";
import { api } from "../shared/api";
import { forget } from "../shared/forget";
import { dayKey } from "./model/slot-time";
import { hasNote } from "./utils";

type Booking = components["schemas"]["Booking"];

const emptyMessage = "Предстоящих событий нет";
const loadFailed = "Не удалось загрузить предстоящие события";

const wallTime = (instant: Date, timeZone: string): string =>
  new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone,
  }).format(instant);

/** `Слот: 2026-03-28-09:00` in the Владелец's time zone. */
const slotLine = (startAt: string, timeZone: string): string =>
  `Слот: ${dayKey(startAt, timeZone)}-${wallTime(new Date(startAt), timeZone)}`;

/** `Создано: 27.03.2026, 14:40` in the Владелец's time zone. */
const createdLine = (createdAt: string, timeZone: string): string => {
  const created = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  }).format(new Date(createdAt));
  return `Создано: ${created}`;
};

const bookingsFrom = (data: { bookings: Booking[] } | undefined): Booking[] | undefined => {
  if (data === undefined) {
    return undefined;
  }
  return data.bookings;
};

const loadBookings = async (): Promise<Booking[] | undefined> => {
  try {
    const result = await api.GET("/api/owner/bookings");
    return bookingsFrom(result.data);
  } catch {
    return undefined;
  }
};

const BookingCard = ({
  booking,
  timeZone,
}: {
  booking: Booking;
  timeZone: string;
}): ReactElement => (
  <Card withBorder padding="md">
    <Text fw={700}>{booking.guest.name}</Text>
    <Text c="dimmed" size="sm">
      {booking.guest.email}
    </Text>
    {hasNote(booking.note) && (
      <Text data-testid="booking-note" size="sm" style={{ whiteSpace: "pre-wrap" }}>
        {booking.note}
      </Text>
    )}
    <Text size="sm">{booking.eventTypeName}</Text>
    <Text size="sm">{slotLine(booking.startAt, timeZone)}</Text>
    <Text size="sm">{createdLine(booking.createdAt, timeZone)}</Text>
  </Card>
);

const BookingList = ({
  bookings,
  timeZone,
}: {
  bookings: Booking[];
  timeZone: string;
}): ReactElement => {
  if (bookings.length === 0) {
    return <Text c="dimmed">{emptyMessage}</Text>;
  }
  return (
    <Stack>
      {bookings.map((booking) => (
        <BookingCard key={booking.id} booking={booking} timeZone={timeZone} />
      ))}
    </Stack>
  );
};

const EventsBody = ({
  bookings,
  timeZone,
}: {
  bookings: Booking[] | "failed" | undefined;
  timeZone: string;
}): ReactElement => {
  if (bookings === undefined) {
    return <Loader />;
  }
  if (bookings === "failed") {
    return <Alert color="red">{loadFailed}</Alert>;
  }
  return <BookingList bookings={bookings} timeZone={timeZone} />;
};

/** Upcoming Бронирования of the current Владелец, soonest first. */
const Events = (): ReactElement => {
  const { user } = useSession();
  const [bookings, setBookings] = useState<Booking[] | "failed">();

  useEffect(() => {
    const load = async (): Promise<void> => {
      setBookings((await loadBookings()) ?? "failed");
    };
    forget(load());
  }, []);

  if (user === undefined || user.role !== "owner") {
    return <></>;
  }

  return (
    <Container size="sm" py={64}>
      <Title order={1} mb="lg">
        Предстоящие события
      </Title>
      <EventsBody bookings={bookings} timeZone={user.timeZone} />
    </Container>
  );
};

export { Events };
