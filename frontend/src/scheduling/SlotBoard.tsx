import { Alert, SimpleGrid, Stack, Title } from "@mantine/core";
import { type ReactElement, useState } from "react";
import type { components } from "spec/api";

import { ownCalendarMessage } from "../shared/problems";
import { BookingPanel } from "./BookingPanel";
import { horizonGuestKeys, withHorizonDays } from "./model/horizon";
import { monthOfKey, type YearMonth } from "./model/month-grid";
import { dayKey, type DayGroup, groupByDay, zoneBanner } from "./model/slot-time";
import { MonthCard } from "./MonthCard";

type PublicCalendar = components["schemas"]["PublicCalendar"];
type Slot = components["schemas"]["Slot"];

const ZoneAlert = ({ banner }: { banner: string | undefined }): ReactElement => {
  if (banner === undefined) {
    return <></>;
  }
  return <Alert>{banner}</Alert>;
};

const OwnCalendarNotice = ({ own }: { own: boolean }): ReactElement => {
  if (!own) {
    return <></>;
  }
  return <Alert>{ownCalendarMessage}</Alert>;
};

const firstStart = (slots: readonly Slot[]): string | undefined => {
  const [first] = slots;
  if (first === undefined) {
    return undefined;
  }
  return first.startAt;
};

const openingMonth = (slots: readonly Slot[], guestTimeZone: string): YearMonth => {
  const start = firstStart(slots);
  if (start === undefined) {
    return monthOfKey(dayKey(new Date().toISOString(), guestTimeZone));
  }
  return monthOfKey(dayKey(start, guestTimeZone));
};

const groupFor = (
  groups: Map<string, DayGroup>,
  selected: string | undefined,
): DayGroup | undefined => {
  if (selected === undefined) {
    return undefined;
  }
  return groups.get(selected);
};

const monthBounds = (
  groups: Map<string, DayGroup>,
  fallback: YearMonth,
): { earliest: YearMonth; latest: YearMonth } => {
  const keys = [...groups.keys()].toSorted();
  const [first] = keys;
  const [last] = keys.slice(-1);
  if (first === undefined || last === undefined) {
    return { earliest: fallback, latest: fallback };
  }
  return { earliest: monthOfKey(first), latest: monthOfKey(last) };
};

interface BoardDays {
  bounds: { earliest: YearMonth; latest: YearMonth };
  groups: Map<string, DayGroup>;
  opened: YearMonth;
}

const boardDays = (
  calendar: PublicCalendar,
  guestTimeZone: string,
  slots: readonly Slot[],
): BoardDays => {
  const groups = withHorizonDays(
    groupByDay(slots, guestTimeZone),
    horizonGuestKeys({
      guestTimeZone,
      now: new Date(),
      ownerTimeZone: calendar.timeZone,
      planningHorizonDays: calendar.planningHorizonDays,
    }),
  );
  const opened = openingMonth(slots, guestTimeZone);
  return { bounds: monthBounds(groups, opened), groups, opened };
};

const bannerSample = (
  groups: Map<string, DayGroup>,
  selected: string | undefined,
  slots: readonly Slot[],
): string | undefined => {
  const group = groupFor(groups, selected);
  if (group !== undefined) {
    const chosen = firstStart(group.slots);
    if (chosen !== undefined) {
      return chosen;
    }
  }
  return firstStart(slots);
};

const BoardColumns = ({
  bounds,
  calendarSlug,
  day,
  durationMinutes,
  eventTypeId,
  groups,
  guestTimeZone,
  month,
  onMonth,
  onRefresh,
  onSelect,
  ownCalendar,
}: {
  bounds: { earliest: YearMonth; latest: YearMonth };
  calendarSlug: string;
  day: string | undefined;
  durationMinutes: number;
  eventTypeId: string;
  groups: Map<string, DayGroup>;
  guestTimeZone: string;
  month: YearMonth;
  onMonth: (month: YearMonth) => void;
  onRefresh: () => Promise<void>;
  onSelect: (day: string) => void;
  ownCalendar: boolean;
}): ReactElement => (
  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
    <MonthCard
      earliest={bounds.earliest}
      groups={groups}
      latest={bounds.latest}
      month={month}
      onMonth={onMonth}
      onSelect={onSelect}
      selected={day}
    />
    <BookingPanel
      key={day}
      calendarSlug={calendarSlug}
      day={day}
      durationMinutes={durationMinutes}
      eventTypeId={eventTypeId}
      group={groupFor(groups, day)}
      guestTimeZone={guestTimeZone}
      onRefresh={onRefresh}
      ownCalendar={ownCalendar}
    />
  </SimpleGrid>
);

const bannerFor = ({
  calendar,
  day,
  groups,
  guestTimeZone,
  slots,
}: {
  calendar: PublicCalendar;
  day: string | undefined;
  groups: Map<string, DayGroup>;
  guestTimeZone: string;
  slots: readonly Slot[];
}): string | undefined =>
  zoneBanner({
    guestTimeZone,
    now: new Date(),
    ownerTimeZone: calendar.timeZone,
    sampleStart: bannerSample(groups, day, slots),
  });

/** Month of bookable days. A chosen free Слот takes a name and email, then shows «Вы записаны». */
const SlotBoard = ({
  calendar,
  calendarSlug,
  durationMinutes,
  eventTypeId,
  guestTimeZone,
  onRefresh,
  ownCalendar,
  slots,
}: {
  calendar: PublicCalendar;
  calendarSlug: string;
  durationMinutes: number;
  eventTypeId: string;
  guestTimeZone: string;
  onRefresh: () => Promise<void>;
  ownCalendar: boolean;
  slots: readonly Slot[];
}): ReactElement => {
  const { bounds, groups, opened } = boardDays(calendar, guestTimeZone, slots);
  const [month, setMonth] = useState(opened);
  const [day, setDay] = useState<string>();
  const banner = bannerFor({ calendar, day, groups, guestTimeZone, slots });

  return (
    <Stack gap="md">
      <Title order={1}>Запись на звонок у {calendar.ownerName}</Title>
      <OwnCalendarNotice own={ownCalendar} />
      <ZoneAlert banner={banner} />
      <BoardColumns
        bounds={bounds}
        calendarSlug={calendarSlug}
        day={day}
        durationMinutes={durationMinutes}
        eventTypeId={eventTypeId}
        groups={groups}
        guestTimeZone={guestTimeZone}
        month={month}
        onMonth={setMonth}
        onRefresh={onRefresh}
        onSelect={setDay}
        ownCalendar={ownCalendar}
      />
    </Stack>
  );
};

export { SlotBoard };
