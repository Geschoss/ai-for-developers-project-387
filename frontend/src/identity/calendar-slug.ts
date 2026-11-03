// oxlint-disable-next-line eslint/no-magic-numbers -- Адрес календаря is at most 30 characters
const maxCalendarSlugLength = 30;

const localPart = (email: string): string => {
  const at = email.indexOf("@");
  if (at === -1) {
    return email;
  }
  return email.slice(0, at);
};

/** The part of an email before `@`, kept to characters an Адрес календаря allows. */
const slugFromEmail = (email: string): string =>
  localPart(email)
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]+/gu, "")
    .slice(0, maxCalendarSlugLength);

export { slugFromEmail };
