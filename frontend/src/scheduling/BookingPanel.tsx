/* oxlint-disable eslint/max-lines -- the day, the Гость form and the «Вы записаны» screen stay together */
import { Button, Card, Stack, Text, Textarea, TextInput, Title } from "@mantine/core";
import { type ReactElement, type SubmitEvent, useState } from "react";

import { forget } from "../shared/forget";
import { FormAlert } from "../shared/FormAlert";
import { type FieldErrors, requestFailed } from "../shared/problems";
import {
  type BookingConfirmation,
  type BookingOutcome,
  type GuestDraft,
  bookSlot,
} from "./api/book-slot";
import { type DayGroup, dayKey, dayLabel, slotRange } from "./model/slot-time";
import { SlotList } from "./SlotList";

// oxlint-disable-next-line eslint/no-magic-numbers -- a three-row Заметка field stays visible
const noteRows = 3;

const hasNote = (note: string | null): note is string => note !== null && note !== "";

const NoteField = ({
  error,
  onChange,
  value,
}: {
  error: string | undefined;
  onChange: (value: string) => void;
  value: string;
}): ReactElement => (
  <Textarea
    label="О чём хотите поговорить?"
    description="Необязательно, до 500 символов"
    name="note"
    rows={noteRows}
    value={value}
    error={error}
    onChange={(event) => {
      onChange(event.currentTarget.value);
    }}
  />
);

const GuestForm = ({
  draft,
  fields,
  onEmail,
  onName,
  onNote,
  onSubmit,
  pending,
}: {
  draft: GuestDraft;
  fields: FieldErrors;
  onEmail: (value: string) => void;
  onName: (value: string) => void;
  onNote: (value: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  pending: boolean;
}): ReactElement => (
  <form onSubmit={onSubmit}>
    <Stack mt="md">
      <TextInput
        label="Имя"
        name="name"
        required
        value={draft.name}
        error={fields.name}
        onChange={(event) => {
          onName(event.currentTarget.value);
        }}
      />
      <TextInput
        label="Email"
        name="email"
        type="email"
        required
        value={draft.email}
        error={fields.email}
        onChange={(event) => {
          onEmail(event.currentTarget.value);
        }}
      />
      <NoteField value={draft.note} error={fields.note} onChange={onNote} />
      <Button type="submit" loading={pending}>
        Забронировать
      </Button>
    </Stack>
  </form>
);

const BookedNotice = ({
  confirmation,
  durationMinutes,
  guestTimeZone,
}: {
  confirmation: BookingConfirmation;
  durationMinutes: number;
  guestTimeZone: string;
}): ReactElement => (
  <Stack>
    <Title order={2}>Вы записаны</Title>
    <Text>{confirmation.ownerName}</Text>
    <Text>{dayLabel(dayKey(confirmation.startAt, guestTimeZone))}</Text>
    <Text>Ваше время: {slotRange(confirmation.startAt, guestTimeZone, durationMinutes)}</Text>
    <Text>
      Время владельца ({confirmation.ownerTimeZone}):{" "}
      {slotRange(confirmation.startAt, confirmation.ownerTimeZone, durationMinutes)}
    </Text>
    {hasNote(confirmation.note) && (
      <Text data-testid="booking-note" style={{ whiteSpace: "pre-wrap" }}>
        {confirmation.note}
      </Text>
    )}
  </Stack>
);

const slotIsFree = (group: DayGroup | undefined, slotStart: string | undefined): boolean => {
  if (group === undefined || slotStart === undefined) {
    return false;
  }
  return group.slots.some((slot) => slot.startAt === slotStart && slot.status === "free");
};

interface BookingSink {
  calendarSlug: string;
  draft: GuestDraft;
  eventTypeId: string;
  onRefresh: () => Promise<void>;
  setConfirmation: (value: BookingConfirmation) => void;
  setFields: (value: FieldErrors) => void;
  setFormError: (value: string | undefined) => void;
  setPending: (value: boolean) => void;
  setSlotStart: (value: string | undefined) => void;
}

const showResult = async (outcome: BookingOutcome, sink: BookingSink): Promise<void> => {
  await sink.onRefresh();
  if (outcome.kind === "booked") {
    sink.setConfirmation(outcome.confirmation);
    return;
  }
  sink.setFields(outcome.fields);
  sink.setFormError(outcome.form);
  if (outcome.taken) {
    sink.setSlotStart(undefined);
  }
};

const runPlace = async (start: string, sink: BookingSink): Promise<void> => {
  sink.setFields({});
  sink.setFormError(undefined);
  try {
    await showResult(
      await bookSlot({
        calendarSlug: sink.calendarSlug,
        eventTypeId: sink.eventTypeId,
        guest: sink.draft,
        startAt: start,
      }),
      sink,
    );
  } catch {
    sink.setFormError(requestFailed);
  } finally {
    sink.setPending(false);
  }
};

const placeBooking = (
  event: SubmitEvent<HTMLFormElement>,
  start: string | undefined,
  sink: BookingSink,
): void => {
  event.preventDefault();
  if (start === undefined) {
    return;
  }
  sink.setPending(true);
  forget(runPlace(start, sink));
};

const GuestFields = ({
  draft,
  fields,
  onEmail,
  onName,
  onNote,
  onSubmit,
  pending,
  shown,
}: {
  draft: GuestDraft;
  fields: FieldErrors;
  onEmail: (value: string) => void;
  onName: (value: string) => void;
  onNote: (value: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  pending: boolean;
  shown: boolean;
}): ReactElement => {
  if (!shown) {
    return <></>;
  }
  return (
    <GuestForm
      draft={draft}
      fields={fields}
      pending={pending}
      onEmail={onEmail}
      onName={onName}
      onNote={onNote}
      onSubmit={onSubmit}
    />
  );
};

interface DayView {
  confirmation: BookingConfirmation | undefined;
  day: string | undefined;
  draft: GuestDraft;
  durationMinutes: number;
  fields: FieldErrors;
  formError: string | undefined;
  group: DayGroup | undefined;
  guestTimeZone: string;
  onEmail: (value: string) => void;
  ownCalendar: boolean;
  onName: (value: string) => void;
  onNote: (value: string) => void;
  onSelect: (startAt: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  pending: boolean;
  slotStart: string | undefined;
}

const DayBody = (props: DayView): ReactElement => {
  if (props.confirmation !== undefined) {
    return (
      <BookedNotice
        confirmation={props.confirmation}
        durationMinutes={props.durationMinutes}
        guestTimeZone={props.guestTimeZone}
      />
    );
  }
  return (
    <>
      <Text fw={600} mb="sm">
        Статус слотов
      </Text>
      <FormAlert message={props.formError} />
      <SlotList
        day={props.day}
        durationMinutes={props.durationMinutes}
        group={props.group}
        guestTimeZone={props.guestTimeZone}
        slotStart={props.slotStart}
        onSelect={props.onSelect}
      />
      <GuestFields
        draft={props.draft}
        fields={props.fields}
        pending={props.pending}
        shown={
          !props.ownCalendar &&
          (slotIsFree(props.group, props.slotStart) || props.formError !== undefined)
        }
        onEmail={props.onEmail}
        onName={props.onName}
        onNote={props.onNote}
        onSubmit={props.onSubmit}
      />
    </>
  );
};

const emptyDraft = (): GuestDraft => ({ email: "", name: "", note: "" });

interface PanelProps {
  calendarSlug: string;
  day: string | undefined;
  durationMinutes: number;
  eventTypeId: string;
  group: DayGroup | undefined;
  guestTimeZone: string;
  onRefresh: () => Promise<void>;
  ownCalendar: boolean;
}

/** The day's Слоты, the name and email form, and the «Вы записаны» screen. */
const BookingPanel = (props: PanelProps): ReactElement => {
  const [slotStart, setSlotStart] = useState<string>();
  const [draft, setDraft] = useState(emptyDraft);
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState<BookingConfirmation>();
  const sink: BookingSink = {
    calendarSlug: props.calendarSlug,
    draft,
    eventTypeId: props.eventTypeId,
    onRefresh: props.onRefresh,
    setConfirmation,
    setFields,
    setFormError,
    setPending,
    setSlotStart,
  };

  return (
    <Card withBorder padding="md">
      <DayBody
        confirmation={confirmation}
        day={props.day}
        draft={draft}
        durationMinutes={props.durationMinutes}
        fields={fields}
        formError={formError}
        group={props.group}
        guestTimeZone={props.guestTimeZone}
        ownCalendar={props.ownCalendar}
        pending={pending}
        slotStart={slotStart}
        onEmail={(email) => {
          setDraft({ ...draft, email });
        }}
        onName={(name) => {
          setDraft({ ...draft, name });
        }}
        onNote={(note) => {
          setDraft({ ...draft, note });
        }}
        onSelect={setSlotStart}
        onSubmit={(event) => {
          placeBooking(event, slotStart, sink);
        }}
      />
    </Card>
  );
};

export { BookingPanel };
