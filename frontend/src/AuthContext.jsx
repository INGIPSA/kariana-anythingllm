import React, { useState, createContext, useEffect } from "react";
import {
  AUTH_TIMESTAMP,
  AUTH_TOKEN,
  AUTH_USER,
  USER_PROMPT_INPUT_MAP,
} from "@/utils/constants";
import System from "./models/system";
import { useNavigate } from "react-router-dom";
import { safeJsonParse } from "@/utils/request";

const CLERK_TOKEN_KEY = "kariana_clerk_token";
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export const AuthContext = createContext(null);
export function AuthProvider(props) {
  const localUser = localStorage.getItem(AUTH_USER);
  const localAuthToken = localStorage.getItem(AUTH_TOKEN);
  const [store, setStore] = useState({
    user: localUser ? safeJsonParse(localUser, null) : null,
    authToken: localAuthToken ? localAuthToken : null,
  });

  const navigate = useNavigate();

  /* NOTE:
   * 1. There's no reason for these helper functions to be stateful. They could
   * just be regular funcs or methods on a basic object.
   * 2. These actions are not being invoked anywhere in the
   * codebase, dead code.
   */
  const [actions] = useState({
    updateUser: (user, authToken = "") => {
      localStorage.setItem(AUTH_USER, JSON.stringify(user));
      localStorage.setItem(AUTH_TOKEN, authToken);
      setStore({ user, authToken });
    },
    unsetUser: () => {
      localStorage.removeItem(AUTH_USER);
      localStorage.removeItem(AUTH_TOKEN);
      localStorage.removeItem(AUTH_TIMESTAMP);
      localStorage.removeItem(USER_PROMPT_INPUT_MAP);
      localStorage.removeItem(CLERK_TOKEN_KEY);
      setStore({ user: null, authToken: null });
    },
  });

  /*
   * On initial mount and whenever the token changes, fetch a new user object
   * If the user is suspended, (success === false and data === null) logout the user and redirect to the login page
   * If success is true and data is not null, update the user object in the store (multi-user mode only)
   * If success is true and data is null, do nothing (single-user mode only) with or without password protection
   */
  useEffect(() => {
    async function refreshUser() {
      const { success, user: refreshedUser } = await System.refreshUser();
      if (success && refreshedUser === null) return;

      if (!success) {
        localStorage.removeItem(AUTH_USER);
        localStorage.removeItem(AUTH_TOKEN);
        localStorage.removeItem(AUTH_TIMESTAMP);
        localStorage.removeItem(USER_PROMPT_INPUT_MAP);
        localStorage.removeItem(CLERK_TOKEN_KEY);
        setStore({ user: null, authToken: null });
        navigate("/login");
        return;
      }

      localStorage.setItem(AUTH_USER, JSON.stringify(refreshedUser));
      setStore((prev) => ({
        ...prev,
        user: refreshedUser,
      }));
    }
    if (store.authToken) refreshUser();
  }, [store.authToken]);

  return (
    <AuthContext.Provider value={{ store, actions }}>
      {clerkPubKey ? (
        <ClerkTokenSync setStore={setStore}>{props.children}</ClerkTokenSync>
      ) : (
        props.children
      )}
    </AuthContext.Provider>
  );
}

/**
 * Inner component that syncs the Clerk session token to localStorage
 * so that baseHeaders() can pick it up for API requests.
 * Only rendered when Clerk is enabled.
 */
function ClerkTokenSync({ children, setStore }) {
  const [clerkLoaded, setClerkLoaded] = useState(false);
  const [ClerkHooks, setClerkHooks] = useState(null);

  useEffect(() => {
    import("@clerk/clerk-react")
      .then((mod) => {
        setClerkHooks(mod);
        setClerkLoaded(true);
      })
      .catch(() => setClerkLoaded(true));
  }, []);

  if (!clerkLoaded) return <>{children}</>;
  if (!ClerkHooks) return <>{children}</>;

  return (
    <ClerkTokenSyncInner ClerkHooks={ClerkHooks} setStore={setStore}>
      {children}
    </ClerkTokenSyncInner>
  );
}

function ClerkTokenSyncInner({ children, ClerkHooks, setStore }) {
  const { useAuth, useUser } = ClerkHooks;
  const { getToken, isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();

  useEffect(() => {
    if (!isSignedIn) {
      localStorage.removeItem("kariana_clerk_token");
      return;
    }

    async function syncToken() {
      try {
        const token = await getToken();
        if (token) {
          localStorage.setItem("kariana_clerk_token", token);
          // Also set as the main auth token so existing code picks it up
          localStorage.setItem(AUTH_TOKEN, token);

          // Map Clerk user to local user shape for the store
          if (clerkUser) {
            const mappedUser = {
              username:
                clerkUser.username ||
                clerkUser.primaryEmailAddress?.emailAddress ||
                "clerk-user",
              role: "default", // Will be determined server-side
            };
            localStorage.setItem(AUTH_USER, JSON.stringify(mappedUser));
            setStore((prev) => ({
              ...prev,
              user: mappedUser,
              authToken: token,
            }));
          }
        }
      } catch (e) {
        console.warn("[Auth] Failed to get Clerk token:", e.message);
      }
    }

    syncToken();
    // Refresh token periodically (Clerk tokens are short-lived)
    const interval = setInterval(syncToken, 50000); // ~50 seconds
    return () => clearInterval(interval);
  }, [isSignedIn, clerkUser, getToken, setStore]);

  return <>{children}</>;
}
