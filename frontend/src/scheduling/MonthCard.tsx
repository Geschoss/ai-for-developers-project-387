import { Button, Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { ReactElement } from "react";

import {
  canShiftMonth,
  cellsOf,
  daysPerWeek,
  monthTitle,
  shiftMonth,
  type YearMonth,
  weekdayLabels,
} from "./model/month-grid";
import { dayLabel, type DayGroup } from "./model/slot-time";

const buttonVariant = (pressed: boolean): "default" | "filled" => {
  if (pressed) {
    return "filled";
  }
  return "default";
};

const DayButton = ({
  day,
  free,
  label,
  onSelect,
  pressed,
}: {
  day: number;
  free: number;
  label: string;
  onSelect: () => void;
  pressed: boolean;
}): ReactElement => (
  <Button
    variant={buttonVariant(pressed)}
    h="auto"
    py="xs"
    aria-label={`${label}, свободно ${String(free)}`}
    aria-pressed={pressed}
    onClick={onSelect}
  >
    <Stack gap={0} align="center">
      <Text size="sm" fw={600}>
        {day}
      </Text>
      <Text size="xs">{free} св.</Text>
    </Stack>
  </Button>
);

const MonthDays = ({
  groups,
  month,
  onSelect,
  selected,
  year,
}: {
  groups: Map<string, DayGroup>;
  month: number;
  onSelect: (key: string) => void;
  selected: string | undefined;
  year: number;
}): ReactElement => (
  <SimpleGrid cols={daysPerWeek} spacing="xs">
    {weekdayLabels.map((label) => (
      <Text key={label} ta="center" size="sm" c="dimmed">
        {label}
      </Text>
    ))}
    {cellsOf(year, month).map((cell) => {
      if (cell.kind === "blank") {
        return <span key={cell.key} />;
      }
      const group = groups.get(cell.key);
      if (group === undefined) {
        return (
          <Text key={cell.key} ta="center" c="dimmed" py="sm">
            {cell.day}
          </Text>
        );
      }
      return (
        <DayButton
          key={cell.key}
          day={cell.day}
          free={group.free}
          label={dayLabel(cell.key)}
          pressed={selected === cell.key}
          onSelect={() => {
            onSelect(cell.key);
          }}
        />
      );
    })}
  </SimpleGrid>
);

const ShiftButton = ({
  disabled,
  label,
  onShift,
  symbol,
}: {
  disabled: boolean;
  label: string;
  onShift: () => void;
  symbol: string;
}): ReactElement => (
  <Button
    variant="default"
    size="compact-sm"
    aria-label={label}
    disabled={disabled}
    onClick={onShift}
  >
    {symbol}
  </Button>
);

const MonthCard = ({
  earliest,
  groups,
  latest,
  month,
  onMonth,
  onSelect,
  selected,
}: {
  earliest: YearMonth;
  groups: Map<string, DayGroup>;
  latest: YearMonth;
  month: YearMonth;
  onMonth: (next: YearMonth) => void;
  onSelect: (key: string) => void;
  selected: string | undefined;
}): ReactElement => (
  <Card withBorder padding="md">
    <Group justify="space-between" mb="sm">
      <Text fw={600}>Календарь</Text>
      <Group gap="xs">
        <ShiftButton
          label="Предыдущий месяц"
          symbol="←"
          disabled={!canShiftMonth(month, earliest, -1)}
          onShift={() => {
            onMonth(shiftMonth(month.year, month.month, -1));
          }}
        />
        <ShiftButton
          label="Следующий месяц"
          symbol="→"
          disabled={!canShiftMonth(month, latest, 1)}
          onShift={() => {
            onMonth(shiftMonth(month.year, month.month, 1));
          }}
        />
      </Group>
    </Group>
    <Text mb="sm">{monthTitle(month.year, month.month)}</Text>
    <MonthDays
      groups={groups}
      month={month.month}
      year={month.year}
      selected={selected}
      onSelect={onSelect}
    />
  </Card>
);

export { MonthCard };
