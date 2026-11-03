import { Anchor, Button, Container, Group } from "@mantine/core";
import type { ReactElement } from "react";
import { Link } from "react-router";

import { forget } from "../shared/forget";
import { type Owner, useSession } from "./session";

const copyGuestLink = async (calendarSlug: string): Promise<void> => {
  const url = new URL(`/u/${calendarSlug}`, globalThis.location.origin).toString();
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    // The clipboard can be blocked; the page stays usable.
  }
};

const OwnerBar = ({
  onLogout,
  owner,
}: {
  onLogout: () => Promise<void>;
  owner: Owner;
}): ReactElement => {
  const copy = (): void => {
    forget(copyGuestLink(owner.calendarSlug));
  };

  return (
    <Container component="header" size="lg" py="sm">
      <Group justify="space-between">
        <Group>
          <Anchor component={Link} to={`/u/${owner.calendarSlug}`}>
            Мой календарь
          </Anchor>
          <Button variant="subtle" onClick={copy}>
            Скопировать ссылку
          </Button>
          <Anchor component={Link} to="/events">
            Предстоящие события
          </Anchor>
          <Anchor component={Link} to="/settings">
            Настройки
          </Anchor>
        </Group>
        <Button
          variant="subtle"
          onClick={() => {
            forget(onLogout());
          }}
        >
          Выйти
        </Button>
      </Group>
    </Container>
  );
};

const AdminBar = ({ onLogout }: { onLogout: () => Promise<void> }): ReactElement => (
  <Container component="header" size="lg" py="sm">
    <Group justify="space-between">
      <Anchor component={Link} to="/admin/users">
        Пользователи
      </Anchor>
      <Button
        variant="subtle"
        onClick={() => {
          forget(onLogout());
        }}
      >
        Выйти
      </Button>
    </Group>
  </Container>
);

/** Header of a logged-in user, by role. Absent for an anonymous visitor. */
const Header = (): ReactElement => {
  const { logout, user } = useSession();
  if (user === undefined) {
    return <></>;
  }
  if (user.role === "admin") {
    return <AdminBar onLogout={logout} />;
  }
  return <OwnerBar owner={user} onLogout={logout} />;
};

export { Header };
