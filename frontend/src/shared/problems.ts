interface FieldErrors {
  calendarSlug?: string;
  dailyBookingLimit?: string;
  email?: string;
  name?: string;
  password?: string;
  planningHorizonDays?: string;
  timeZone?: string;
}

interface ShownErrors {
  fields: FieldErrors;
  form?: string;
}

const messageByPath: Record<keyof FieldErrors, string> = {
  calendarSlug: "Адрес календаря: от 3 до 30 символов, строчные латинские буквы, цифры и дефис",
  dailyBookingLimit: "Лимит бронирований — целое число от 1 до 18",
  email: "Укажите корректный email",
  name: "Укажите имя",
  password: "Пароль должен быть не короче 8 символов",
  planningHorizonDays: "Горизонт планирования — целое число от 1 до 60",
  timeZone: "Выберите часовой пояс из списка",
};

const requestFailed = "Не удалось выполнить запрос";

const ownCalendarMessage = "Свой календарь бронировать нельзя";

const bookingMessageByCode: Record<string, string> = {
  daily_limit_reached: "На этот день уже достигнут лимит бронирований",
  outside_planning_horizon: "Этот слот за Горизонтом планирования",
  own_calendar: ownCalendarMessage,
  slot_in_past: "Этот слот уже начался или прошёл",
  slot_taken: "Этот слот уже занят",
};

const bookingMessage = (code: string): string | undefined => bookingMessageByCode[code];

const fieldByPath: Record<string, keyof FieldErrors | undefined> = {
  "/body/calendarSlug": "calendarSlug",
  "/body/dailyBookingLimit": "dailyBookingLimit",
  "/body/email": "email",
  "/body/guest/email": "email",
  "/body/guest/name": "name",
  "/body/name": "name",
  "/body/password": "password",
  "/body/planningHorizonDays": "planningHorizonDays",
  "/body/timeZone": "timeZone",
};

const fieldName = (path: string): keyof FieldErrors | undefined => fieldByPath[path];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const issuesOf = (value: unknown): { path: string }[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((issue: unknown) => {
    if (!isRecord(issue) || typeof issue["path"] !== "string") {
      return [];
    }
    return [{ path: issue["path"] }];
  });
};

const codeOf = (error: unknown): string | undefined => {
  if (!isRecord(error) || typeof error["code"] !== "string") {
    return undefined;
  }
  return error["code"];
};

const fieldsFromIssues = (error: unknown): FieldErrors => {
  const fields: FieldErrors = {};
  if (!isRecord(error)) {
    return fields;
  }
  for (const issue of issuesOf(error["issues"])) {
    const name = fieldName(issue.path);
    if (name !== undefined) {
      fields[name] = messageByPath[name];
    }
  }
  return fields;
};

const validationOrFallback = (code: string | undefined, error: unknown): ShownErrors => {
  if (code === "validation_failed") {
    const fields = fieldsFromIssues(error);
    if (Object.keys(fields).length > 0) {
      return { fields };
    }
  }
  return { fields: {}, form: requestFailed };
};

const bookingErrors = (code: string | undefined): ShownErrors | undefined => {
  if (code === undefined) {
    return undefined;
  }
  const form = bookingMessage(code);
  if (form === undefined) {
    return undefined;
  }
  return { fields: {}, form };
};

/** Turns an API problem into Russian text. `invalid_credentials` stays a single form message. */
const errorsFor = (error: unknown): ShownErrors => {
  const code = codeOf(error);
  if (code === "email_taken") {
    return { fields: { email: "Этот email уже зарегистрирован" } };
  }
  if (code === "slug_taken") {
    return { fields: { calendarSlug: "Этот адрес календаря уже занят" } };
  }
  if (code === "invalid_credentials") {
    return { fields: {}, form: "Неверный email или пароль" };
  }
  return bookingErrors(code) ?? validationOrFallback(code, error);
};

export { errorsFor, type FieldErrors, messageByPath, ownCalendarMessage, requestFailed };
