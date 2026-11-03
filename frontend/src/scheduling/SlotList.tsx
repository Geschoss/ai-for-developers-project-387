import { Button, Group, Stack, Text } from "@mantine/core";
import type { ReactElement } from "react";
import type { components } from "spec/api";

import { type DayGroup, dayLabel, slotRange } from "./model/slot-time";

type Slot = components["schemas"]["Slot"];

const variantOf = (pressed: boolean): "default" | "filled" => {
  if (pressed) {
    return "filled";
  }
  return "default";
};

const StatusText = ({ status }: { status: Slot["status"] }): ReactElement => {
  if (status === "booked") {
    return <Text c="dimmed">Занято</Text>;
  }
  return <Text>Свободно</Text>;
};

const FreeSlot = ({
  onSelect,
  pressed,
  range,
}: {
  onSelect: () => void;
  pressed: boolean;
  range: string;
}): ReactElement => (
  <Button variant={variantOf(pressed)} aria-pressed={pressed} h="auto" onClick={onSelect}>
    <Group justify="space-between" w="100%">
      <Text>{range}</Text>
      <Text>Свободно</Text>
    </Group>
  </Button>
);

const SlotRow = ({
  durationMinutes,
  guestTimeZone,
  onSelect,
  selected,
  slot,
}: {
  durationMinutes: number;
  guestTimeZone: string;
  onSelect: (startAt: string) => void;
  selected: string | undefined;
  slot: Slot;
}): ReactElement => {
  const range = slotRange(slot.startAt, guestTimeZone, durationMinutes);
  if (slot.status === "booked") {
    return (
      <Group justify="space-between">
        <Text>{range}</Text>
        <StatusText status={slot.status} />
      </Group>
    );
  }
  return (
    <FreeSlot
      pressed={selected === slot.startAt}
      range={range}
      onSelect={() => {
        onSelect(slot.startAt);
      }}
    />
  );
};

/** Слоты of the day the Гость picked. A free one can be chosen. */
const SlotList = ({
  day,
  durationMinutes,
  group,
  guestTimeZone,
  onSelect,
  slotStart,
}: {
  day: string | undefined;
  durationMinutes: number;
  group: DayGroup | undefined;
  guestTimeZone: string;
  onSelect: (startAt: string) => void;
  slotStart: string | undefined;
}): ReactElement => {
  if (day === undefined || group === undefined) {
    return <Text c="dimmed">Выберите дату в календаре.</Text>;
  }
  return (
    <Stack gap="xs">
      <Text>{dayLabel(day)}</Text>
      {group.slots.map((slot) => (
        <SlotRow
          key={slot.startAt}
          durationMinutes={durationMinutes}
          guestTimeZone={guestTimeZone}
          selected={slotStart}
          slot={slot}
          onSelect={onSelect}
        />
      ))}
    </Stack>
  );
};

export { SlotList };
