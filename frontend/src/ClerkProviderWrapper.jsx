import React, { createContext, useContext, useEffect, useState } from "react";
import { ClerkProvider, useAuth, useUser } from "@clerk/clerk-react";
import { AUTH_TOKEN, AUTH_USER } from "@/utils/constants";

const ClerkConfigContext = createContext({ clerkEnabled: false, publishableKey: null, orgId: null });

export function useClerkConfig() {
  return useContext(ClerkConfigContext);
}

/**
 * Wraps the app with Clerk if enabled, otherwise renders children directly.
 * Fetches /api/system/clerk-config on mount to determine if Clerk is configured.
 */
export default function ClerkProviderWrapper({ children }) {
  const [config, setConfig] = useState({ loading: true, clerkEnabled: false, publishableKey: null, orgId: null });

  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch("/api/system/clerk-config");
        const data = await res.json();
        setConfig({
          loading: false,
          clerkEnabled: data.clerkEnabled || false,
          publishableKey: data.publishableKey || null,
          orgId: data.orgId || null,
        });
      } catch (e) {
        console.error("Failed to fetch Clerk config:", e);
        setConfig({ loading: false, clerkEnabled: false, publishableKey: null, orgId: null });
      }
    }
    fetchConfig();
  }, []);

  if (config.loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-theme-bg-primary">
        <div className="text-theme-text-primary text-lg">Loading...</div>
      </div>
    );
  }

  if (!config.clerkEnabled) {
    // Clerk not configured, render children directly (legacy auth)
    return (
      <ClerkConfigContext.Provider value={config}>
        {children}
      </ClerkConfigContext.Provider>
    );
  }

  return (
    <ClerkConfigContext.Provider value={config}>
      <ClerkProvider
        publishableKey={config.publishableKey}
        appearance={{
          variables: {
            colorPrimary: "#FF7EDC",
            colorBackground: "#231F20",
            colorText: "#E8E8E9",
            colorTextSecondary: "#B0B0B1",
            colorInputBackground: "#2A2627",
            colorInputText: "#E8E8E9",
            borderRadius: "0.5rem",
          },
          elements: {
            rootBox: "w-full",
            card: "bg-[#231F20] border border-[#3A3637] shadow-xl",
            headerTitle: "text-[#E8E8E9]",
            headerSubtitle: "text-[#B0B0B1]",
            socialButtonsBlockButton: "bg-[#2A2627] border-[#3A3637] text-[#E8E8E9] hover:bg-[#3A3637]",
            formButtonPrimary: "bg-[#FF7EDC] hover:bg-[#FF69D0] text-white",
            footerActionLink: "text-[#293DF0] hover:text-[#FF7EDC]",
            identityPreview: "bg-[#2A2627]",
            formFieldInput: "bg-[#2A2627] border-[#3A3637] text-[#E8E8E9]",
            formFieldLabel: "text-[#B0B0B1]",
            dividerLine: "bg-[#3A3637]",
            dividerText: "text-[#B0B0B1]",
            userButtonPopoverCard: "bg-[#231F20] border-[#3A3637]",
            userButtonPopoverActionButton: "text-[#E8E8E9] hover:bg-[#2A2627]",
            organizationSwitcherTrigger: "bg-[#2A2627] border-[#3A3637] text-[#E8E8E9]",
          },
        }}
      >
        <ClerkAuthBridge>
          {children}
        </ClerkAuthBridge>
      </ClerkProvider>
    </ClerkConfigContext.Provider>
  );
}

/**
 * Bridge between Clerk auth state and KARIANA-LLM's localStorage-based auth.
 * When a user signs in via Clerk, this component:
 * 1. Gets the Clerk session token
 * 2. Calls /api/system/clerk-auth to get/create the local KARIANA-LLM user
 * 3. Stores the token and user in localStorage for the existing auth system
 */
function ClerkAuthBridge({ children }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const [bridged, setBridged] = useState(false);

  useEffect(() => {
    async function bridgeAuth() {
      if (!isLoaded || !isSignedIn || !clerkUser) return;

      try {
        const token = await getToken();
        if (!token) return;

        // Call the backend to get/create local user
        const res = await fetch("/api/system/clerk-auth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.valid && data.user) {
            localStorage.setItem(AUTH_TOKEN, token);
            localStorage.setItem(AUTH_USER, JSON.stringify(data.user));
            setBridged(true);
          }
        }
      } catch (e) {
        console.error("[ClerkAuthBridge] Failed:", e);
      }
    }

    bridgeAuth();

    // Refresh the token periodically (Clerk tokens expire in ~60s)
    const interval = setInterval(async () => {
      if (!isSignedIn) return;
      try {
        const newToken = await getToken();
        if (newToken) {
          localStorage.setItem(AUTH_TOKEN, newToken);
        }
      } catch (e) {}
    }, 50000); // Refresh every 50 seconds

    return () => clearInterval(interval);
  }, [isLoaded, isSignedIn, clerkUser]);

  // Clear local auth when signed out
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      localStorage.removeItem(AUTH_TOKEN);
      localStorage.removeItem(AUTH_USER);
      setBridged(false);
    }
  }, [isLoaded, isSignedIn]);

  return children;
}
