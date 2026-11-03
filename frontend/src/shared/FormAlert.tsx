import { Alert } from "@mantine/core";
import type { ReactElement } from "react";

/** A form-level message. Nothing, when the form has no error. */
export const FormAlert = ({ message }: { message: string | undefined }): ReactElement => {
  if (message === undefined) {
    return <></>;
  }
  return <Alert color="red">{message}</Alert>;
};
