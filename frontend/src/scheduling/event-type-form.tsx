import {
  Alert,
  Button,
  Card,
  Loader,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { type ReactElement, type SubmitEvent, useEffect, useState } from "react";
import type { components } from "spec/api";

import { api } from "../shared/api";
import { forget } from "../shared/forget";
import { FormAlert } from "../shared/FormAlert";
import { requestFailed } from "../shared/problems";
import {
  type EventTypeDraft,
  type EventTypeFields,
  type NewEventType,
  checkedEventType,
  durationMessage,
  durationStepMinutes,
  emptyDraft,
  maximumDurationMinutes,
  minimumDurationMinutes,
} from "./event-type-draft";

type EventType = components["schemas"]["EventType"];
type EventDuration = components["schemas"]["EventDuration"];

const addedMessage = "Тип события добавлен";
const typesFailed = "Не удалось загрузить типы событий";

const isEventDuration = (minutes: number): minutes is EventDuration =>
  minutes >= minimumDurationMinutes &&
  minutes <= maximumDurationMinutes &&
  minutes % durationStepMinutes === 0;

const createEventType = async (
  eventType: NewEventType,
): Promise<EventType | "invalid" | "failed"> => {
  if (!isEventDuration(eventType.durationMinutes)) {
    return "invalid";
  }
  const result = await api.POST("/api/owner/event-types", {
    body: {
      description: eventType.description,
      durationMinutes: eventType.durationMinutes,
      name: eventType.name,
    },
  });
  if (result.data === undefined) {
    return "failed";
  }
  return result.data;
};

const loadEventTypes = async (): Promise<EventType[] | undefined> => {
  try {
    const result = await api.GET("/api/owner/event-types");
    if (result.data === undefined) {
      return undefined;
    }
    return result.data.eventTypes;
  } catch {
    return undefined;
  }
};

const TypeCard = ({ eventType }: { eventType: EventType }): ReactElement => (
  <Card withBorder padding="sm">
    <Text fw={700}>{eventType.name}</Text>
    <Text size="sm">{eventType.description}</Text>
    <Text size="sm">{eventType.durationMinutes} минут</Text>
  </Card>
);

const TypeList = ({ types }: { types: readonly EventType[] }): ReactElement => {
  if (types.length === 0) {
    return <Text c="dimmed">Типов событий пока нет</Text>;
  }
  return (
    <Stack gap="xs">
      {types.map((eventType) => (
        <TypeCard key={eventType.id} eventType={eventType} />
      ))}
    </Stack>
  );
};

const Notice = ({ message }: { message: string | undefined }): ReactElement => {
  if (message === undefined) {
    return <></>;
  }
  return <Text c="green">{message}</Text>;
};

interface FormSink {
  draft: EventTypeDraft;
  setDraft: (draft: EventTypeDraft) => void;
  setFields: (fields: EventTypeFields) => void;
  setFormError: (message: string | undefined) => void;
  setNotice: (message: string | undefined) => void;
  setPending: (pending: boolean) => void;
  setTypes: (types: EventType[]) => void;
  types: EventType[];
}

const applyCreated = (created: EventType, sink: FormSink): void => {
  sink.setTypes([...sink.types, created]);
  sink.setDraft(emptyDraft());
  sink.setNotice(addedMessage);
};

const reportCreated = (created: EventType | "failed" | "invalid", sink: FormSink): void => {
  if (created === "invalid") {
    sink.setFields({ durationMinutes: durationMessage });
    return;
  }
  if (created === "failed") {
    sink.setFormError(requestFailed);
    return;
  }
  applyCreated(created, sink);
};

const storeType = async (sink: FormSink): Promise<void> => {
  const parsed = checkedEventType(sink.draft);
  if (parsed.kind === "invalid") {
    sink.setFields(parsed.fields);
    return;
  }
  reportCreated(await createEventType(parsed.eventType), sink);
};

const runCreate = async (event: SubmitEvent<HTMLFormElement>, sink: FormSink): Promise<void> => {
  event.preventDefault();
  sink.setPending(true);
  sink.setFields({});
  sink.setFormError(undefined);
  sink.setNotice(undefined);
  try {
    await storeType(sink);
  } catch {
    sink.setFormError(requestFailed);
  } finally {
    sink.setPending(false);
  }
};

const TypeFields = ({
  draft,
  fields,
  setDraft,
}: {
  draft: EventTypeDraft;
  fields: EventTypeFields;
  setDraft: (draft: EventTypeDraft) => void;
}): ReactElement => (
  <>
    <TextInput
      label="Название"
      name="eventTypeName"
      value={draft.name}
      error={fields.name}
      onChange={(event) => {
        setDraft({ ...draft, name: event.currentTarget.value });
      }}
    />
    <Textarea
      label="Описание"
      name="eventTypeDescription"
      value={draft.description}
      error={fields.description}
      onChange={(event) => {
        setDraft({ ...draft, description: event.currentTarget.value });
      }}
    />
    <TextInput
      label="Длительность, минуты"
      name="durationMinutes"
      inputMode="numeric"
      value={draft.durationMinutes}
      error={fields.durationMinutes}
      onChange={(event) => {
        setDraft({ ...draft, durationMinutes: event.currentTarget.value });
      }}
    />
  </>
);

const TypeEditor = ({
  onChange,
  types,
}: {
  onChange: (types: EventType[]) => void;
  types: readonly EventType[];
}): ReactElement => {
  const [draft, setDraft] = useState(emptyDraft);
  const [fields, setFields] = useState<EventTypeFields>({});
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState(false);
  const sink: FormSink = {
    draft,
    setDraft,
    setFields,
    setFormError,
    setNotice,
    setPending,
    setTypes: onChange,
    types: [...types],
  };

  return (
    <Stack mt="xl">
      <Title order={2}>Типы событий</Title>
      <TypeList types={types} />
      <form
        noValidate
        onSubmit={(event) => {
          forget(runCreate(event, sink));
        }}
      >
        <Stack>
          <FormAlert message={formError} />
          <Notice message={notice} />
          <TypeFields draft={draft} fields={fields} setDraft={setDraft} />
          <Button type="submit" loading={pending}>
            Добавить
          </Button>
        </Stack>
      </form>
    </Stack>
  );
};

const EventTypeBody = ({
  onChange,
  types,
}: {
  onChange: (types: EventType[]) => void;
  types: EventType[] | "failed" | undefined;
}): ReactElement => {
  if (types === undefined) {
    return <Loader mt="xl" />;
  }
  if (types === "failed") {
    return (
      <Alert color="red" mt="xl">
        {typesFailed}
      </Alert>
    );
  }
  return <TypeEditor types={types} onChange={onChange} />;
};

/** Создаёт Тип события. Уже созданные нельзя изменить или удалить, и сырой UUID не показывается. */
const EventTypeForm = (): ReactElement => {
  const [types, setTypes] = useState<EventType[] | "failed">();

  useEffect(() => {
    const load = async (): Promise<void> => {
      setTypes((await loadEventTypes()) ?? "failed");
    };
    forget(load());
  }, []);

  return <EventTypeBody types={types} onChange={setTypes} />;
};

export { EventTypeForm };
