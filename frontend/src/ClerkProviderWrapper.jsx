import React, { useEffect, useState } from "react";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

/**
 * Conditionally wraps children with ClerkProvider if the Clerk publishable key
 * is set via VITE_CLERK_PUBLISHABLE_KEY. Otherwise, renders children directly
 * with zero Clerk overhead.
 */
export function ClerkProviderWrapper({ children }) {
  const [ClerkProvider, setClerkProvider] = useState(null);
  const [loaded, setLoaded] = useState(!clerkPubKey);

  useEffect(() => {
    if (!clerkPubKey) return;
    import("@clerk/clerk-react")
      .then((mod) => {
        setClerkProvider(() => mod.ClerkProvider);
        setLoaded(true);
      })
      .catch((err) => {
        console.warn("[Auth] Failed to load Clerk:", err.message);
        setLoaded(true); // Proceed without Clerk
      });
  }, []);

  if (!loaded) return null; // Brief loading state while Clerk loads

  if (ClerkProvider && clerkPubKey) {
    return (
      <ClerkProvider publishableKey={clerkPubKey}>{children}</ClerkProvider>
    );
  }

  return <>{children}</>;
}
