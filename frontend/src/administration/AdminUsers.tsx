import { Alert, Anchor, Container, Loader, Table, Title } from "@mantine/core";
import { type ReactElement, useEffect, useState } from "react";
import type { components } from "spec/api";

import { api } from "../shared/api";
import { forget } from "../shared/forget";

type Owner = components["schemas"]["Owner"];

const guestLink = (calendarSlug: string): string =>
  new URL(`/u/${calendarSlug}`, globalThis.location.origin).toString();

const registrationDate = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short" });

const loadOwners = async (): Promise<Owner[] | undefined> => {
  try {
    const result = await api.GET("/api/admin/owners");
    if (result.data === undefined) {
      return undefined;
    }
    return result.data.owners;
  } catch {
    return undefined;
  }
};

const OwnerRow = ({ owner }: { owner: Owner }): ReactElement => {
  const link = guestLink(owner.calendarSlug);
  return (
    <Table.Tr>
      <Table.Td>{owner.name}</Table.Td>
      <Table.Td>{owner.email}</Table.Td>
      <Table.Td>
        <Anchor href={link}>{link}</Anchor>
      </Table.Td>
      <Table.Td>{owner.timeZone}</Table.Td>
      <Table.Td>{registrationDate.format(new Date(owner.registeredAt))}</Table.Td>
    </Table.Tr>
  );
};

const OwnerTable = ({ owners }: { owners: Owner[] }): ReactElement => (
  <Table striped>
    <Table.Thead>
      <Table.Tr>
        <Table.Th>Имя</Table.Th>
        <Table.Th>Email</Table.Th>
        <Table.Th>Ссылка</Table.Th>
        <Table.Th>Часовой пояс</Table.Th>
        <Table.Th>Дата регистрации</Table.Th>
      </Table.Tr>
    </Table.Thead>
    <Table.Tbody>
      {owners.map((owner) => (
        <OwnerRow key={owner.calendarSlug} owner={owner} />
      ))}
    </Table.Tbody>
  </Table>
);

const OwnersState = ({ owners }: { owners: Owner[] | "failed" | undefined }): ReactElement => {
  if (owners === undefined) {
    return <Loader />;
  }
  if (owners === "failed") {
    return <Alert color="red">Не удалось загрузить список пользователей</Alert>;
  }
  return <OwnerTable owners={owners} />;
};

/** Every Владелец, for the Администратор. Read-only. */
const AdminUsers = (): ReactElement => {
  const [owners, setOwners] = useState<Owner[] | "failed">();

  useEffect(() => {
    const load = async (): Promise<void> => {
      setOwners((await loadOwners()) ?? "failed");
    };
    forget(load());
  }, []);

  return (
    <Container size="lg" py={64}>
      <Title order={1} mb="lg">
        Пользователи
      </Title>
      <OwnersState owners={owners} />
    </Container>
  );
};

export { AdminUsers };
