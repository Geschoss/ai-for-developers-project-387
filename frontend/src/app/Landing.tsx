import {
  Badge,
  Button,
  Card,
  Container,
  Group,
  List,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import type { ReactElement } from "react";
import { Link } from "react-router";

export const Landing = (): ReactElement => (
  <Container size="lg" py={64}>
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing={48}>
      <Stack align="flex-start" gap="lg">
        <Badge variant="light" color="gray">
          Быстрая запись на звонок
        </Badge>
        <Title order={1} fz={48}>
          Календарь звонков
        </Title>
        <Text size="lg" c="dimmed">
          Поделитесь ссылкой на свой календарь, и Гости сами выберут свободный Слот для звонка.
        </Text>
        <Group>
          <Button component={Link} to="/register" size="md">
            Регистрация
          </Button>
          <Button component={Link} to="/login" size="md" variant="default">
            Войти
          </Button>
        </Group>
      </Stack>
      <Card withBorder padding="lg">
        <Title order={3} mb="md">
          Как это работает
        </Title>
        <List spacing="xs" c="dimmed">
          <List.Item>30-минутные Слоты с 09:00 до 18:00 в вашем часовом поясе.</List.Item>
          <List.Item>Гостю не нужен аккаунт: только имя и email.</List.Item>
          <List.Item>Все Бронирования — в разделе «Предстоящие события».</List.Item>
        </List>
      </Card>
    </SimpleGrid>
  </Container>
);
