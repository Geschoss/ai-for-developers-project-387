import { Select, TextInput } from "@mantine/core";
import type { ChangeEvent, ReactElement } from "react";

import type { FieldErrors } from "../shared/problems";
import { timeZoneNames } from "../shared/time-zones";
import {
  type Draft,
  maxDailyBookingLimit,
  maxPlanningHorizonDays,
  minDailyBookingLimit,
  minPlanningHorizonDays,
} from "./settings-draft";

interface Sink {
  draft: Draft;
  remember: (timeZone: string) => void;
  setDraft: (draft: Draft) => void;
  setFields: (fields: FieldErrors) => void;
  setFormError: (message: string | undefined) => void;
  setNotice: (message: string | undefined) => void;
  setPending: (pending: boolean) => void;
}

const TimeZoneField = ({
  error,
  onChange,
  value,
}: {
  error: string | undefined;
  onChange: (value: string) => void;
  value: string;
}): ReactElement => (
  <Select
    label="Часовой пояс"
    data={timeZoneNames}
    value={value}
    allowDeselect={false}
    searchable
    error={error}
    onChange={(next) => {
      if (next !== null) {
        onChange(next);
      }
    }}
  />
);

const CountField = ({
  description,
  error,
  label,
  max,
  min,
  name,
  onChange,
  value,
}: {
  description: string;
  error: string | undefined;
  label: string;
  max: number;
  min: number;
  name: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  value: string;
}): ReactElement => (
  <TextInput
    label={label}
    description={description}
    name={name}
    type="number"
    inputMode="numeric"
    required
    min={min}
    max={max}
    step={1}
    value={value}
    error={error}
    onChange={onChange}
  />
);

const editCount =
  (sink: Sink, key: "dailyBookingLimit" | "planningHorizonDays") =>
  (event: ChangeEvent<HTMLInputElement>): void => {
    sink.setNotice(undefined);
    sink.setDraft({ ...sink.draft, [key]: event.currentTarget.value });
  };

const editZone =
  (sink: Sink) =>
  (value: string): void => {
    sink.setNotice(undefined);
    sink.setDraft({ ...sink.draft, timeZone: value });
  };

const SettingsFields = ({
  draft,
  fields,
  sink,
}: {
  draft: Draft;
  fields: FieldErrors;
  sink: Sink;
}): ReactElement => (
  <>
    <TimeZoneField error={fields.timeZone} value={draft.timeZone} onChange={editZone(sink)} />
    <CountField
      label="Горизонт планирования"
      description="Сколько дней вперёд, включая сегодня, Гость может бронировать Слоты."
      name="planningHorizonDays"
      min={minPlanningHorizonDays}
      max={maxPlanningHorizonDays}
      value={draft.planningHorizonDays}
      error={fields.planningHorizonDays}
      onChange={editCount(sink, "planningHorizonDays")}
    />
    <CountField
      label="Лимит бронирований"
      description="Сколько Бронирований один email может сделать за один день."
      name="dailyBookingLimit"
      min={minDailyBookingLimit}
      max={maxDailyBookingLimit}
      value={draft.dailyBookingLimit}
      error={fields.dailyBookingLimit}
      onChange={editCount(sink, "dailyBookingLimit")}
    />
  </>
);

export { SettingsFields, type Sink };
