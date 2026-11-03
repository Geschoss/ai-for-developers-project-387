import {
  Button,
  Container,
  PasswordInput,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { type ChangeEvent, type ReactElement, type SubmitEvent, useState } from "react";
import { Link, useNavigate } from "react-router";

import { type Owner, useSession } from "../app/session";
import { api } from "../shared/api";
import { forget } from "../shared/forget";
import { FormAlert } from "../shared/FormAlert";
import { errorsFor, type FieldErrors } from "../shared/problems";
import { browserTimeZone, timeZoneNames } from "../shared/time-zones";
import { slugFromEmail } from "./calendar-slug";

const requestFailed = "Не удалось выполнить запрос";

interface TextField {
  error: string | undefined;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  value: string;
}

interface Draft {
  calendarSlug: string;
  email: string;
  name: string;
  password: string;
  setCalendarSlug: (value: string) => void;
  setEmail: (value: string) => void;
  setName: (value: string) => void;
  setPassword: (value: string) => void;
  setTimeZone: (value: string) => void;
  timeZone: string;
}

const field = (
  value: string,
  error: string | undefined,
  onChange: (event: ChangeEvent<HTMLInputElement>) => void,
): TextField => ({ error, onChange, value });

const useDraft = (): Draft => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [calendarSlug, setCalendarSlug] = useState("");
  const [timeZone, setTimeZone] = useState(browserTimeZone);
  const setEmailAndSlug = (value: string): void => {
    setEmail(value);
    setCalendarSlug(slugFromEmail(value));
  };
  return {
    calendarSlug,
    email,
    name,
    password,
    setCalendarSlug,
    setEmail: setEmailAndSlug,
    setName,
    setPassword,
    setTimeZone,
    timeZone,
  };
};

const NameEmailPassword = ({
  email,
  name,
  password,
}: {
  email: TextField;
  name: TextField;
  password: TextField;
}): ReactElement => (
  <>
    <TextInput
      label="Имя"
      name="name"
      autoComplete="name"
      required
      value={name.value}
      error={name.error}
      onChange={name.onChange}
    />
    <TextInput
      label="Email"
      name="email"
      type="email"
      autoComplete="email"
      required
      value={email.value}
      error={email.error}
      onChange={email.onChange}
    />
    {/* Проверка длины пароля временно выключена: minLength={8} */}
    <PasswordInput
      label="Пароль"
      name="password"
      autoComplete="new-password"
      required
      value={password.value}
      error={password.error}
      onChange={password.onChange}
    />
  </>
);

const CalendarFields = ({
  calendarSlug,
  timeZone,
  timeZoneError,
  onTimeZone,
}: {
  calendarSlug: TextField;
  onTimeZone: (value: string) => void;
  timeZone: string;
  timeZoneError: string | undefined;
}): ReactElement => (
  <>
    <TextInput
      label="Адрес календаря"
      description="Строчные латинские буквы, цифры и дефис. Из него получается ссылка для гостей."
      name="calendarSlug"
      autoComplete="off"
      required
      minLength={3}
      maxLength={30}
      pattern="[a-z0-9-]+"
      value={calendarSlug.value}
      error={calendarSlug.error}
      onChange={calendarSlug.onChange}
    />
    <Select
      label="Часовой пояс"
      data={timeZoneNames}
      value={timeZone}
      allowDeselect={false}
      searchable
      error={timeZoneError}
      onChange={(value) => {
        if (value !== null) {
          onTimeZone(value);
        }
      }}
    />
  </>
);

const registerOwner = async (
  draft: Draft,
  setOwner: (owner: Owner) => void,
  navigate: (path: string) => void | Promise<void>,
): Promise<FieldErrors | string | undefined> => {
  const result = await api.POST("/api/auth/register", {
    body: {
      calendarSlug: draft.calendarSlug,
      email: draft.email,
      name: draft.name,
      password: draft.password,
      timeZone: draft.timeZone,
    },
  });
  if (result.data !== undefined) {
    setOwner(result.data);
    await navigate("/events");
    return undefined;
  }
  const shown = errorsFor(result.error);
  if (shown.form !== undefined) {
    return shown.form;
  }
  return shown.fields;
};

const RegisterForm = ({
  draft,
  fields,
  formError,
  onSubmit,
  pending,
}: {
  draft: Draft;
  fields: FieldErrors;
  formError: string | undefined;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  pending: boolean;
}): ReactElement => (
  <Container size="xs" py={64}>
    <Title order={1} mb="lg">
      Регистрация
    </Title>
    <form onSubmit={onSubmit}>
      <Stack>
        <FormAlert message={formError} />
        <NameEmailPassword
          name={field(draft.name, fields.name, (event) => {
            draft.setName(event.currentTarget.value);
          })}
          email={field(draft.email, fields.email, (event) => {
            draft.setEmail(event.currentTarget.value);
          })}
          password={field(draft.password, fields.password, (event) => {
            draft.setPassword(event.currentTarget.value);
          })}
        />
        <CalendarFields
          calendarSlug={field(draft.calendarSlug, fields.calendarSlug, (event) => {
            draft.setCalendarSlug(event.currentTarget.value);
          })}
          timeZone={draft.timeZone}
          timeZoneError={fields.timeZone}
          onTimeZone={draft.setTimeZone}
        />
        <Button type="submit" loading={pending}>
          Зарегистрироваться
        </Button>
        <Text>
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </Text>
      </Stack>
    </form>
  </Container>
);

const showOutcome = async (
  draft: Draft,
  sink: {
    navigate: (path: string) => void | Promise<void>;
    setFields: (fields: FieldErrors) => void;
    setFormError: (message: string | undefined) => void;
    setUser: (owner: Owner) => void;
  },
): Promise<void> => {
  const outcome = await registerOwner(draft, sink.setUser, sink.navigate);
  if (typeof outcome === "string") {
    sink.setFormError(outcome);
    return;
  }
  if (outcome !== undefined) {
    sink.setFields(outcome);
  }
};

/** Registration. A successful owner is logged in immediately. */
const Register = (): ReactElement => {
  const draft = useDraft();
  const session = useSession();
  const navigate = useNavigate();
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setPending(true);
    setFields({});
    setFormError(undefined);
    try {
      await showOutcome(draft, {
        navigate,
        setFields,
        setFormError,
        setUser: session.setUser,
      });
    } catch {
      setFormError(requestFailed);
    } finally {
      setPending(false);
    }
  };

  return (
    <RegisterForm
      draft={draft}
      fields={fields}
      formError={formError}
      onSubmit={(event) => {
        forget(onSubmit(event));
      }}
      pending={pending}
    />
  );
};

export { Register };
