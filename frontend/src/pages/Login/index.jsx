import React from "react";
import PasswordModal, { usePasswordModal } from "@/components/Modals/Password";
import { FullScreenLoader } from "@/components/Preloader";
import { Navigate } from "react-router-dom";
import paths from "@/utils/paths";
import useQuery from "@/hooks/useQuery";
import useSimpleSSO from "@/hooks/useSimpleSSO";
import { useClerkConfig } from "@/ClerkProviderWrapper";
import ClerkLogin from "./ClerkLogin";
import { SignedIn, SignedOut } from "@clerk/clerk-react";

export default function Login() {
  const { clerkEnabled } = useClerkConfig();

  // If Clerk is enabled, use Clerk login
  if (clerkEnabled) {
    return (
      <>
        <SignedIn>
          <Navigate to={paths.home()} />
        </SignedIn>
        <SignedOut>
          <ClerkLogin />
        </SignedOut>
      </>
    );
  }

  // Legacy login flow
  return <LegacyLogin />;
}

function LegacyLogin() {
  const query = useQuery();
  const { loading: ssoLoading, ssoConfig } = useSimpleSSO();
  const { loading, requiresAuth, mode } = usePasswordModal(!!query.get("nt"));

  if (loading || ssoLoading) return <FullScreenLoader />;

  if (ssoConfig.enabled && ssoConfig.noLogin) {
    if (!!ssoConfig.noLoginRedirect && !query.has("token"))
      return window.location.replace(ssoConfig.noLoginRedirect);
    else return <Navigate to={paths.sso.login()} />;
  }

  if (requiresAuth === false) return <Navigate to={paths.home()} />;

  return <PasswordModal mode={mode} />;
}
