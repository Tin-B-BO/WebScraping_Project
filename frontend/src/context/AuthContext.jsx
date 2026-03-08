import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchCurrentUser } from "../api/api";

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const token = localStorage.getItem("access_token");

  // hydrate auth state once on app boot
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!token) {
          if (alive) setUser(null);
          return;
        }
        const currentUser = await fetchCurrentUser();
        if (alive) setUser(currentUser);
      } catch {
        // clear expired token and reset auth state
        localStorage.removeItem("access_token");
        if (alive) setUser(null);
      } finally {
        if (alive) setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // memoize context value to avoid unnecessary consumer rerenders
  const value = useMemo(
    () => ({
      user,
      setUser,
      booting,
      logout: () => {
        localStorage.removeItem("access_token");
        setUser(null);
      },
    }),
    [user, booting]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// guard hook usage to ensure provider exists
function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export { AuthProvider, useAuth };
