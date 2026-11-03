import { Alert, Center, Container, Loader, Radio, Stack, Text, Title } from "@mantine/core";
import { type Dispatch, type ReactElement, type SetStateAction, useEffect, useState } from "react";
import { useParams } from "react-router";
import type { components } from "spec/api";

import { useSession } from "../app/session";
import { api } from "../shared/api";
import { forget } from "../shared/forget";
import { browserTimeZone } from "../shared/time-zones";
import { SlotBoard } from "./SlotBoard";

type PublicCalendar = components["schemas"]["PublicCalendar"];
type EventType = PublicCalendar["eventTypes"][number];
type Slot = components["schemas"]["Slot"];

const rangeFrom = "2020-01-01T00:00:00.000Z";
const rangeTo = "2040-01-01T00:00:00.000Z";

type LoadState =
  | { calendar: PublicCalendar; eventTypeId: string | undefined; kind: "ready"; slots: Slot[] }
  | { kind: "failed" }
  | { kind: "loading" }
  | { kind: "missing" };

const readCalendar = async (
  calendarSlug: string,
): Promise<PublicCalendar | "failed" | "missing"> => {
  const calendar = await api.GET("/api/calendars/{calendarSlug}", {
    params: { path: { calendarSlug } },
  });
  if (calendar.response.status === 404) {
    return "missing";
  }
  if (calendar.data === undefined) {
    return "failed";
  }
  return calendar.data;
};

const readSlots = async (
  calendarSlug: string,
  eventTypeId: string,
): Promise<Slot[] | undefined> => {
  const listed = await api.GET("/api/calendars/{calendarSlug}/slots", {
    params: { path: { calendarSlug }, query: { eventTypeId, from: rangeFrom, to: rangeTo } },
  });
  if (listed.data === undefined) {
    return undefined;
  }
  return listed.data.slots;
};

const loadedCalendar = async (calendarSlug: string): Promise<LoadState> => {
  const calendar = await readCalendar(calendarSlug);
  if (calendar === "missing" || calendar === "failed") {
    return { kind: calendar };
  }
  const [first] = calendar.eventTypes;
  if (first === undefined) {
    return { calendar, eventTypeId: undefined, kind: "ready", slots: [] };
  }
  const slots = await readSlots(calendarSlug, first.id);
  if (slots === undefined) {
    return { kind: "failed" };
  }
  return { calendar, eventTypeId: first.id, kind: "ready", slots };
};

const loadCalendar = async (calendarSlug: string): Promise<LoadState> => {
  try {
    return await loadedCalendar(calendarSlug);
  } catch {
    return { kind: "failed" };
  }
};

const MissingCalendar = (): ReactElement => (
  <Container size="xs" py={64}>
    <Title order={1}>Календарь не найден</Title>
  </Container>
);

const selectedType = (
  calendar: PublicCalendar,
  eventTypeId: string | undefined,
): EventType | undefined => calendar.eventTypes.find((eventType) => eventType.id === eventTypeId);

const TypeChoice = ({
  eventTypeId,
  onChooseType,
  types,
}: {
  eventTypeId: string | undefined;
  onChooseType: (eventTypeId: string) => Promise<void>;
  types: readonly EventType[];
}): ReactElement => (
  <Radio.Group
    label="Тип события"
    value={eventTypeId ?? ""}
    onChange={(value) => {
      forget(onChooseType(value));
    }}
  >
    <Stack gap="xs" mt="xs">
      {types.map((eventType) => (
        <Radio
          key={eventType.id}
          value={eventType.id}
          label={eventType.name}
          description={`${eventType.description}. ${String(eventType.durationMinutes)} минут`}
        />
      ))}
    </Stack>
  </Radio.Group>
);

const ReadyCalendar = ({
  calendar,
  eventTypeId,
  onChooseType,
  onRefresh,
  ownCalendar,
  slug,
  slots,
}: {
  calendar: PublicCalendar;
  eventTypeId: string | undefined;
  onChooseType: (eventTypeId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  ownCalendar: boolean;
  slug: string;
  slots: readonly Slot[];
}): ReactElement => {
  const chosen = selectedType(calendar, eventTypeId);
  if (chosen === undefined || eventTypeId === undefined) {
    return (
      <Stack>
        <Title order={1}>Запись на звонок у {calendar.ownerName}</Title>
        <Text>В этом Календаре нет Типов событий</Text>
      </Stack>
    );
  }
  return (
    <Stack gap="md">
      <TypeChoice
        eventTypeId={eventTypeId}
        types={calendar.eventTypes}
        onChooseType={onChooseType}
      />
      <SlotBoard
        key={eventTypeId}
        calendar={calendar}
        calendarSlug={slug}
        durationMinutes={chosen.durationMinutes}
        eventTypeId={eventTypeId}
        guestTimeZone={browserTimeZone()}
        onRefresh={onRefresh}
        ownCalendar={ownCalendar}
        slots={slots}
      />
    </Stack>
  );
};

const CalendarBody = ({
  onChooseType,
  onRefresh,
  ownCalendar,
  slug,
  state,
}: {
  onChooseType: (eventTypeId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  ownCalendar: boolean;
  slug: string;
  state: LoadState;
}): ReactElement => {
  if (state.kind === "loading") {
    return (
      <Center h="40vh">
        <Loader />
      </Center>
    );
  }
  if (state.kind === "missing") {
    return <MissingCalendar />;
  }
  if (state.kind === "failed") {
    return (
      <Container size="xs" py={64}>
        <Alert color="red">Не удалось загрузить календарь</Alert>
      </Container>
    );
  }
  return (
    <Container size="lg" py="lg">
      <ReadyCalendar
        calendar={state.calendar}
        eventTypeId={state.eventTypeId}
        onChooseType={onChooseType}
        onRefresh={onRefresh}
        ownCalendar={ownCalendar}
        slug={slug}
        slots={state.slots}
      />
    </Container>
  );
};

const rememberSlots = (latest: LoadState, slots: Slot[], eventTypeId?: string): LoadState => {
  if (latest.kind !== "ready") {
    return latest;
  }
  if (eventTypeId === undefined) {
    return { ...latest, slots };
  }
  return { ...latest, eventTypeId, slots };
};

const reloadSlots = async (
  calendarSlug: string,
  eventTypeId: string,
  setState: Dispatch<SetStateAction<LoadState>>,
): Promise<void> => {
  const slots = await readSlots(calendarSlug, eventTypeId);
  if (slots === undefined) {
    return;
  }
  setState((latest) => rememberSlots(latest, slots));
};

const chooseSlots = async (
  calendarSlug: string,
  eventTypeId: string,
  setState: Dispatch<SetStateAction<LoadState>>,
): Promise<void> => {
  const slots = await readSlots(calendarSlug, eventTypeId);
  if (slots === undefined) {
    return;
  }
  setState((latest) => rememberSlots(latest, slots, eventTypeId));
};

const readyTypeId = (state: LoadState): string | undefined => {
  if (state.kind !== "ready") {
    return undefined;
  }
  return state.eventTypeId;
};

/** `/u/:calendarSlug`. A Гость picks a free Слот, leaves a name and email, and sees «Вы записаны». */
const PublicCalendarPage = (): ReactElement => {
  const { calendarSlug } = useParams();
  const { user } = useSession();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const ownCalendar =
    user !== undefined && user.role === "owner" && user.calendarSlug === calendarSlug;

  useEffect(() => {
    if (calendarSlug === undefined) {
      return;
    }
    const load = async (): Promise<void> => {
      setState(await loadCalendar(calendarSlug));
    };
    forget(load());
  }, [calendarSlug]);

  const reload = async (): Promise<void> => {
    const eventTypeId = readyTypeId(state);
    if (calendarSlug === undefined || eventTypeId === undefined) {
      return;
    }
    await reloadSlots(calendarSlug, eventTypeId, setState);
  };

  const chooseType = async (eventTypeId: string): Promise<void> => {
    if (calendarSlug === undefined) {
      return;
    }
    await chooseSlots(calendarSlug, eventTypeId, setState);
  };

  if (calendarSlug === undefined) {
    return <MissingCalendar />;
  }
  return (
    <CalendarBody
      onChooseType={chooseType}
      onRefresh={reload}
      ownCalendar={ownCalendar}
      slug={calendarSlug}
      state={state}
    />
  );
};

export { PublicCalendarPage };
