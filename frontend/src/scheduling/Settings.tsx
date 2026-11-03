import { Alert, Button, Container, Loader, Stack, Title } from "@mantine/core";
import { type ReactElement, type SubmitEvent, useEffect, useState } from "react";

import { type Owner, useSession } from "../app/session";
import { api } from "../shared/api";
import { forget } from "../shared/forget";
import { FormAlert } from "../shared/FormAlert";
import { errorsFor, type FieldErrors } from "../shared/problems";
import { EventTypeForm } from "./event-type-form";
import { checked, draftFrom, type OwnerSettings } from "./settings-draft";
import { SettingsFields, type Sink } from "./settings-fields";

const savedMessage = "Настройки сохранены";
const loadFailed = "Не удалось загрузить настройки";
const requestFailed = "Не удалось выполнить запрос";

type SaveResult =
  | { fields: FieldErrors; kind: "fields" }
  | { kind: "form"; message: string }
  | { kind: "saved"; settings: OwnerSettings };

const loadSettings = async (): Promise<OwnerSettings | undefined> => {
  try {
    const result = await api.GET("/api/owner/settings");
    return result.data;
  } catch {
    return undefined;
  }
};

const saveSettings = async (settings: OwnerSettings): Promise<SaveResult> => {
  const result = await api.PUT("/api/owner/settings", { body: settings });
  if (result.data !== undefined) {
    return { kind: "saved", settings: result.data };
  }
  const shown = errorsFor(result.error);
  if (shown.form !== undefined) {
    return { kind: "form", message: shown.form };
  }
  return { fields: shown.fields, kind: "fields" };
};

const applySave = (outcome: SaveResult, sink: Sink): void => {
  if (outcome.kind === "saved") {
    sink.setDraft(draftFrom(outcome.settings));
    sink.remember(outcome.settings.timeZone);
    sink.setNotice(savedMessage);
    return;
  }
  if (outcome.kind === "form") {
    sink.setFormError(outcome.message);
    return;
  }
  sink.setFields(outcome.fields);
};

const store = async (sink: Sink): Promise<void> => {
  const parsed = checked(sink.draft);
  if (parsed.kind === "invalid") {
    sink.setFields(parsed.fields);
    return;
  }
  applySave(await saveSettings(parsed.settings), sink);
};

const clearNotice = (sink: Sink): void => {
  sink.setPending(true);
  sink.setFields({});
  sink.setFormError(undefined);
  sink.setNotice(undefined);
};

const runSubmit = async (event: SubmitEvent<HTMLFormElement>, sink: Sink): Promise<void> => {
  event.preventDefault();
  clearNotice(sink);
  try {
    await store(sink);
  } catch {
    sink.setFormError(requestFailed);
  } finally {
    sink.setPending(false);
  }
};

const SavedAlert = ({ message }: { message: string | undefined }): ReactElement => {
  if (message === undefined) {
    return <></>;
  }
  return <Alert color="green">{message}</Alert>;
};

const rememberTimeZone = (
  user: ReturnType<typeof useSession>["user"],
  setUser: (owner: Owner) => void,
  timeZone: string,
): void => {
  if (user === undefined || user.role !== "owner") {
    return;
  }
  setUser({ ...user, timeZone });
};

const SettingsForm = ({ initial }: { initial: OwnerSettings }): ReactElement => {
  const { setUser, user } = useSession();
  const [draft, setDraft] = useState(draftFrom(initial));
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState(false);
  const sink: Sink = {
    draft,
    remember: (timeZone) => {
      rememberTimeZone(user, setUser, timeZone);
    },
    setDraft,
    setFields,
    setFormError,
    setNotice,
    setPending,
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        forget(runSubmit(event, sink));
      }}
    >
      <Stack>
        <FormAlert message={formError} />
        <SavedAlert message={notice} />
        <SettingsFields draft={draft} fields={fields} sink={sink} />
        <Button type="submit" loading={pending}>
          Сохранить
        </Button>
      </Stack>
    </form>
  );
};

const SettingsBody = ({
  settings,
}: {
  settings: OwnerSettings | "failed" | undefined;
}): ReactElement => {
  if (settings === undefined) {
    return <Loader />;
  }
  if (settings === "failed") {
    return <Alert color="red">{loadFailed}</Alert>;
  }
  return <SettingsForm initial={settings} />;
};

/** Часовой пояс, Горизонт планирования, Лимит бронирований and Типы событий of the current Владелец. */
const Settings = (): ReactElement => {
  const [settings, setSettings] = useState<OwnerSettings | "failed">();

  useEffect(() => {
    const load = async (): Promise<void> => {
      setSettings((await loadSettings()) ?? "failed");
    };
    forget(load());
  }, []);

  return (
    <Container size="xs" py={64}>
      <Title order={1} mb="lg">
        Настройки
      </Title>
      <SettingsBody settings={settings} />
      <EventTypeForm />
    </Container>
  );
};

export { Settings };
