import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Warning, ArrowRight, Clock } from "@phosphor-icons/react";
import { AUTH_TOKEN } from "@/utils/constants";
import { useClerkConfig } from "@/ClerkProviderWrapper";
import useLogo from "@/hooks/useLogo";

// Pages that should never be blocked by the paywall
const EXEMPT_PATHS = ["/pricing", "/login", "/onboarding"];

/**
 * Context provider that checks subscription status and shows a paywall
 * if the free trial has expired and no active subscription exists.
 */
export default function TrialExpiredPaywall({ children }) {
  const { clerkEnabled } = useClerkConfig();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const { loginLogo } = useLogo();
  const navigate = useNavigate();
  const location = useLocation();
  const isExemptPath = EXEMPT_PATHS.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (!clerkEnabled) {
      setLoading(false);
      return;
    }
    checkSubscription();
    // Re-check every 5 minutes
    const interval = setInterval(checkSubscription, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [clerkEnabled]);

  async function checkSubscription() {
    try {
      const token = localStorage.getItem(AUTH_TOKEN);
      if (!token) {
        setLoading(false);
        return;
      }
      let res = await fetch("/api/system/stripe/subscription-status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        res = await fetch("/api/system/subscription-status", {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error("[TrialPaywall] Check failed:", e);
    } finally {
      setLoading(false);
    }
  }

  // Don't block if Clerk isn't enabled, still loading, subscription is active, or on exempt path
  if (!clerkEnabled || loading || !status || status.active || isExemptPath) {
    return (
      <>
        {children}
        {/* Show trial banner if trial is active with days remaining */}
        {status?.trialActive && status?.trialDaysRemaining <= 7 && !dismissed && (
          <TrialBanner
            daysRemaining={status.trialDaysRemaining}
            onDismiss={() => setDismissed(true)}
            onUpgrade={() => navigate("/pricing")}
          />
        )}
      </>
    );
  }

  // Trial expired and no subscription — show paywall
  return (
    <div className="fixed inset-0 z-[9999] bg-[#231F20] flex items-center justify-center overflow-auto">
      {/* Background atmosphere */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-red-500/[0.03] rounded-full blur-[100px]" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-[#FF7EDC]/[0.04] rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 max-w-lg w-full mx-6">
        <div className="bg-[#1A1718] rounded-2xl border border-[#3A3637]/60 p-10 text-center">
          {/* Logo */}
          <img src={loginLogo} alt="KARIANA" className="h-8 mx-auto mb-8 opacity-60" />

          {/* Warning icon */}
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Clock size={32} weight="fill" className="text-red-400" />
          </div>

          {/* Title */}
          <h1
            className="text-3xl text-[#E8E8E9] mb-3"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Your free trial has ended
          </h1>

          {/* Description */}
          <p
            className="text-[#B0B0B1] mb-8 leading-relaxed"
            style={{ fontFamily: "'Instrument Sans', sans-serif" }}
          >
            Your 14-day free trial of KARIANA-LLM has expired.
            Choose a plan to continue using AI-powered Unreal Engine development tools.
          </p>

          {/* CTA */}
          <button
            onClick={() => navigate("/pricing")}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#FF7EDC] to-[#FF4DC4] text-white font-semibold flex items-center justify-center gap-2 hover:shadow-[0_0_30px_-5px_rgba(255,126,220,0.5)] hover:scale-[1.01] transition-all duration-300"
            style={{ fontFamily: "'Instrument Sans', sans-serif" }}
          >
            View Plans & Upgrade
            <ArrowRight size={18} weight="bold" />
          </button>

          {/* Secondary info */}
          <p
            className="mt-6 text-xs text-[#B0B0B1]/60"
            style={{ fontFamily: "'Instrument Sans', sans-serif" }}
          >
            Questions? Contact{" "}
            <a href="mailto:business@kariana.ai" className="text-[#293DF0] hover:text-[#FF7EDC] transition-colors">
              business@kariana.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Floating banner shown during the last 7 days of trial
 */
function TrialBanner({ daysRemaining, onDismiss, onUpgrade }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9998] animate-in slide-in-from-bottom-4">
      <div
        className="flex items-center gap-4 bg-[#1A1718]/95 backdrop-blur-md border border-[#FF7EDC]/20 rounded-2xl px-6 py-3.5 shadow-[0_0_40px_-10px_rgba(255,126,220,0.2)]"
        style={{ fontFamily: "'Instrument Sans', sans-serif" }}
      >
        <Warning size={20} weight="fill" className="text-[#FF7EDC] flex-shrink-0" />
        <span className="text-sm text-[#E8E8E9]">
          <strong className="text-[#FF7EDC]">{daysRemaining} day{daysRemaining !== 1 ? "s" : ""}</strong> left in your free trial
        </span>
        <button
          onClick={onUpgrade}
          className="text-xs font-semibold bg-[#FF7EDC] text-[#231F20] px-4 py-1.5 rounded-full hover:bg-[#FF69D0] transition-colors"
        >
          Upgrade
        </button>
        <button
          onClick={onDismiss}
          className="text-[#B0B0B1] hover:text-[#E8E8E9] transition-colors ml-1"
        >
          <span className="text-lg leading-none">&times;</span>
        </button>
      </div>
    </div>
  );
}
