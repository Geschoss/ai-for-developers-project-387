import { Button, Container, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { type ChangeEvent, type ReactElement, type SubmitEvent, useState } from "react";
import { Link, useNavigate } from "react-router";

import { homeOf, type User, useSession } from "../app/session";
import { api } from "../shared/api";
import { forget } from "../shared/forget";
import { FormAlert } from "../shared/FormAlert";
import { errorsFor, type FieldErrors } from "../shared/problems";

const requestFailed = "Не удалось выполнить запрос";

interface LoginFields {
  email: string;
  fields: FieldErrors;
  formError: string | undefined;
  onEmail: (event: ChangeEvent<HTMLInputElement>) => void;
  onPassword: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  password: string;
  pending: boolean;
}

const LoginForm = ({
  email,
  fields,
  formError,
  onEmail,
  onPassword,
  onSubmit,
  password,
  pending,
}: LoginFields): ReactElement => (
  <Container size="xs" py={64}>
    <Title order={1} mb="lg">
      Вход
    </Title>
    <form onSubmit={onSubmit}>
      <Stack>
        <FormAlert message={formError} />
        <TextInput
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          error={fields.email}
          onChange={onEmail}
        />
        <PasswordInput
          label="Пароль"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          error={fields.password}
          onChange={onPassword}
        />
        <Button type="submit" loading={pending}>
          Войти
        </Button>
        <Text>
          Нет аккаунта? <Link to="/register">Регистрация</Link>
        </Text>
      </Stack>
    </form>
  </Container>
);

/** On success publishes the user and opens their start page: events for an owner, the owners list for the admin. */
const sendLogin = async (input: {
  email: string;
  navigate: (path: string) => void | Promise<void>;
  password: string;
  setUser: (user: User) => void;
}): Promise<FieldErrors | string | undefined> => {
  const result = await api.POST("/api/auth/login", {
    body: { email: input.email, password: input.password },
  });
  if (result.data !== undefined) {
    input.setUser(result.data);
    await input.navigate(homeOf(result.data));
    return undefined;
  }
  const shown = errorsFor(result.error);
  if (shown.form !== undefined) {
    return shown.form;
  }
  return shown.fields;
};

const showLoginErrors = (
  outcome: FieldErrors | string | undefined,
  report: {
    setFields: (fields: FieldErrors) => void;
    setFormError: (message: string | undefined) => void;
  },
): void => {
  if (typeof outcome === "string") {
    report.setFormError(outcome);
    return;
  }
  if (outcome !== undefined) {
    report.setFields(outcome);
  }
};

const useLoginForm = (): LoginFields => {
  const session = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setPending(true);
    setFields({});
    setFormError(undefined);
    try {
      showLoginErrors(await sendLogin({ email, navigate, password, setUser: session.setUser }), {
        setFields,
        setFormError,
      });
    } catch {
      setFormError(requestFailed);
    } finally {
      setPending(false);
    }
  };

  return {
    email,
    fields,
    formError,
    onEmail: (event) => {
      setEmail(event.currentTarget.value);
    },
    onPassword: (event) => {
      setPassword(event.currentTarget.value);
    },
    onSubmit: (event) => {
      forget(onSubmit(event));
    },
    password,
    pending,
  };
};

/** Login by email and password. The error does not say which of the two is wrong. */
const Login = (): ReactElement => <LoginForm {...useLoginForm()} />;

export { Login };
