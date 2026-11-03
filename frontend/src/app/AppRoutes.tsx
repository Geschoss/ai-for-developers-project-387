import type { ReactElement } from "react";
import { Route, Routes } from "react-router";

import { AdminUsers } from "../administration/AdminUsers";
import { Login } from "../identity/Login";
import { Register } from "../identity/Register";
import { Events } from "../scheduling/Events";
import { PublicCalendarPage } from "../scheduling/PublicCalendar";
import { Settings } from "../scheduling/Settings";
import { Landing } from "./Landing";
import { RequireAnonymous, RequireRole } from "./session";

const anonymousPage = (page: ReactElement): ReactElement => (
  <RequireAnonymous>{page}</RequireAnonymous>
);

/** Every page and who may see it. */
const AppRoutes = (): ReactElement => (
  <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/register" element={anonymousPage(<Register />)} />
    <Route path="/login" element={anonymousPage(<Login />)} />
    <Route path="/u/:calendarSlug" element={<PublicCalendarPage />} />
    <Route
      path="/events"
      element={
        <RequireRole role="owner">
          <Events />
        </RequireRole>
      }
    />
    <Route
      path="/settings"
      element={
        <RequireRole role="owner">
          <Settings />
        </RequireRole>
      }
    />
    <Route
      path="/admin/users"
      element={
        <RequireRole role="admin">
          <AdminUsers />
        </RequireRole>
      }
    />
  </Routes>
);

export { AppRoutes };
