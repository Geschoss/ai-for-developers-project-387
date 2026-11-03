import { MantineProvider } from "@mantine/core";
import type { ReactElement } from "react";
import { BrowserRouter } from "react-router";

import { AppRoutes } from "./AppRoutes";
import { Header } from "./Header";
import { SessionProvider } from "./session";
import { theme } from "./theme";

const App = (): ReactElement => (
  <MantineProvider theme={theme}>
    <BrowserRouter>
      <SessionProvider>
        <Header />
        <AppRoutes />
      </SessionProvider>
    </BrowserRouter>
  </MantineProvider>
);

export { App };
