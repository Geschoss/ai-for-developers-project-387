// oxlint-disable-next-line eslint/no-magic-numbers -- spec: the shortest Тип события is 30 minutes
const minimumDurationMinutes = 30;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: 09:00–18:00 is 540 minutes
const maximumDurationMinutes = 540;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: duration steps by 30 minutes
const durationStepMinutes = 30;
const minimumTextLength = 1;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a Тип события name is at most 100 characters
const maximumNameLength = 100;
// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a Тип события description is at most 1000 characters
const maximumDescriptionLength = 1000;

const nameMessage = "Название — от 1 до 100 символов";
const descriptionMessage = "Описание — от 1 до 1000 символов";
const durationMessage = "Длительность — от 30 до 540 минут, шаг 30";

interface EventTypeDraft {
  description: string;
  durationMinutes: string;
  name: string;
}

interface EventTypeFields {
  description?: string;
  durationMinutes?: string;
  name?: string;
}

interface NewEventType {
  description: string;
  durationMinutes: number;
  name: string;
}

type Checked =
  | { fields: EventTypeFields; kind: "invalid" }
  | { eventType: NewEventType; kind: "valid" };

const emptyDraft = (): EventTypeDraft => ({ description: "", durationMinutes: "", name: "" });

const textFits = (value: string, maximum: number): boolean =>
  value.length >= minimumTextLength && value.length <= maximum;

const durationOf = (value: string): number | undefined => {
  if (!/^\d+$/u.test(value)) {
    return undefined;
  }
  const parsed = Number(value);
  if (
    parsed < minimumDurationMinutes ||
    parsed > maximumDurationMinutes ||
    parsed % durationStepMinutes !== 0
  ) {
    return undefined;
  }
  return parsed;
};

const textFields = (draft: EventTypeDraft): EventTypeFields => {
  const fields: EventTypeFields = {};
  if (!textFits(draft.name, maximumNameLength)) {
    fields.name = nameMessage;
  }
  if (!textFits(draft.description, maximumDescriptionLength)) {
    fields.description = descriptionMessage;
  }
  return fields;
};

/** Client check before the server. The same bounds are `validation_failed` on the contract. */
const checkedEventType = (draft: EventTypeDraft): Checked => {
  const fields = textFields(draft);
  const durationMinutes = durationOf(draft.durationMinutes);
  if (durationMinutes === undefined) {
    fields.durationMinutes = durationMessage;
    return { fields, kind: "invalid" };
  }
  if (Object.keys(fields).length > 0) {
    return { fields, kind: "invalid" };
  }
  return {
    eventType: { description: draft.description, durationMinutes, name: draft.name },
    kind: "valid",
  };
};

export {
  type EventTypeDraft,
  type EventTypeFields,
  type NewEventType,
  checkedEventType,
  durationMessage,
  durationStepMinutes,
  emptyDraft,
  maximumDurationMinutes,
  minimumDurationMinutes,
};
