import { Center, Loader } from "@mantine/core";
import {
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Navigate } from "react-router";
import type { components } from "spec/api";

import { api } from "../shared/api";
import { forget } from "../shared/forget";

type Owner = components["schemas"]["CurrentOwner"];
type User = components["schemas"]["CurrentUser"];

interface Session {
  logout: () => Promise<void>;
  ready: boolean;
  setUser: (user: User) => void;
  user: User | undefined;
}

/** Where a logged-in user starts: an owner at their events, the admin at the owners list. */
const homeOf = (user: User): string => {
  if (user.role === "admin") {
    return "/admin/users";
  }
  return "/events";
};

const SessionContext = createContext<Session | undefined>(undefined);

const useSession = (): Session => {
  const session = useContext(SessionContext);
  if (session === undefined) {
    throw new Error("SessionProvider is missing");
  }
  return session;
};

const loadUser = async (): Promise<User | undefined> => {
  try {
    const result = await api.GET("/api/auth/me");
    return result.data;
  } catch {
    return undefined;
  }
};

const Waiting = (): ReactElement => (
  <Center h="100vh">
    <Loader />
  </Center>
);

/** Loads the current user once. Registration and login publish the user they just received. */
const SessionProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const [user, setUserState] = useState<User>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        setUserState(await loadUser());
      } finally {
        setReady(true);
      }
    };
    forget(load());
  }, []);

  const session = useMemo<Session>(
    () => ({
      logout: async (): Promise<void> => {
        try {
          await api.POST("/api/auth/logout");
        } catch {
          // The local session is cleared below even when the request does not land.
        }
        setUserState(undefined);
      },
      ready,
      setUser: setUserState,
      user,
    }),
    [user, ready],
  );

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
};

/** Pages of one role. An anonymous visitor goes to `/login`, a user of the other role to their own start page. */
const RequireRole = ({
  children,
  role,
}: {
  children: ReactNode;
  role: User["role"];
}): ReactElement => {
  const { ready, user } = useSession();
  if (user === undefined) {
    if (ready) {
      return <Navigate to="/login" replace />;
    }
    return <Waiting />;
  }
  if (user.role !== role) {
    return <Navigate to={homeOf(user)} replace />;
  }
  return <>{children}</>;
};

/** `/register` and `/login`. A logged-in user goes to their start page. */
const RequireAnonymous = ({ children }: { children: ReactNode }): ReactElement => {
  const { ready, user } = useSession();
  if (user === undefined) {
    if (ready) {
      return <>{children}</>;
    }
    return <Waiting />;
  }
  return <Navigate to={homeOf(user)} replace />;
};

export {
  homeOf,
  type Owner,
  RequireAnonymous,
  RequireRole,
  SessionProvider,
  type User,
  useSession,
};
