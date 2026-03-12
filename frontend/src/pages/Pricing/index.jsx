import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X, ArrowRight, Crown, Buildings, HardDrive } from "@phosphor-icons/react";
import { AUTH_TOKEN } from "@/utils/constants";
import useLogo from "@/hooks/useLogo";

const PLAN_ICONS = {
  solo: Crown,
  team: Buildings,
  byom: HardDrive,
};

const PLAN_ACCENTS = {
  solo: { gradient: "from-[#FF7EDC] to-[#FF4DC4]", ring: "ring-[#FF7EDC]/30", glow: "shadow-[0_0_60px_-12px_rgba(255,126,220,0.4)]" },
  team: { gradient: "from-[#293DF0] to-[#6B7AFF]", ring: "ring-[#293DF0]/30", glow: "shadow-[0_0_60px_-12px_rgba(41,61,240,0.4)]" },
  byom: { gradient: "from-[#E8E8E9] to-[#B0B0B1]", ring: "ring-[#E8E8E9]/20", glow: "shadow-[0_0_60px_-12px_rgba(232,232,233,0.2)]" },
};

const FEATURE_LABELS = {
  create_teach_validate: "Create, Teach & Validate",
  vendor_asset_audits: "Vendor Asset Audits",
  naming_convention_checks: "Naming Convention Checks",
  pre_delivery_qa: "Pre-delivery QA",
  performance_profiling: "Performance Profiling",
  project_organization: "Project Organization",
  instant_troubleshooting: "Instant Troubleshooting",
  team_onboarding: "Team Onboarding",
  knowledge_capture: "Knowledge Capture",
  contextual_learning: "Contextual Learning",
  material_pipelines: "Material Pipelines",
  blueprint_authoring: "Blueprint Authoring",
  scene_assembly: "Scene Assembly",
  pcg_environment_generation: "PCG Environment Generation",
  batch_asset_operations: "Batch Asset Operations",
  lighting_cameras: "Lighting & Cameras",
  skill_recorder: "Skill Recorder",
  level_sequence_animation: "Level Sequence Animation",
  batch_rename: "Batch Rename",
  undo_system: "Undo System",
  chat_history: "Chat History",
  telemetry_opt_in: "Telemetry",
  dashboard: "Team Dashboard",
  admin_panel: "Admin Panel",
  audit_logs: "Audit Logs",
  nda_mode: "NDA Mode",
  whitelabel: "White-label Branding",
  vcs_integration: "VCS Integration",
  future_updates: "Priority Updates",
  premium_support: "Premium Support",
  unlimited_tokens: "Unlimited Tokens",
};

// Group features for display
const FEATURE_GROUPS = [
  {
    name: "Core UE Tools",
    features: [
      "create_teach_validate", "blueprint_authoring", "scene_assembly",
      "material_pipelines", "lighting_cameras", "pcg_environment_generation",
      "level_sequence_animation", "batch_asset_operations", "batch_rename",
    ],
  },
  {
    name: "Quality & Standards",
    features: [
      "vendor_asset_audits", "naming_convention_checks", "pre_delivery_qa",
      "performance_profiling", "project_organization",
    ],
  },
  {
    name: "Knowledge & Learning",
    features: [
      "instant_troubleshooting", "knowledge_capture", "contextual_learning",
      "skill_recorder", "team_onboarding",
    ],
  },
  {
    name: "Enterprise",
    features: [
      "dashboard", "admin_panel", "audit_logs", "nda_mode",
      "whitelabel", "vcs_integration", "future_updates",
      "premium_support", "unlimited_tokens",
    ],
  },
];

export default function PricingPage() {
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const { loginLogo } = useLogo();
  const navigate = useNavigate();

  useEffect(() => {
    fetchSubscriptionStatus();
  }, []);

  async function fetchSubscriptionStatus() {
    try {
      const token = localStorage.getItem(AUTH_TOKEN);
      // Try Stripe endpoint first, fall back to Clerk-only endpoint
      let res = await fetch("/api/system/stripe/subscription-status", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        res = await fetch("/api/system/subscription-status", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      }
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
        setSubscription(data);
      }
    } catch (e) {
      console.error("Failed to fetch subscription:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckout(planKey) {
    setCheckoutLoading(planKey);
    try {
      const token = localStorage.getItem(AUTH_TOKEN);
      const res = await fetch("/api/system/stripe/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ planKey, billingCycle }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      }
      const err = await res.json().catch(() => ({}));
      console.error("Checkout failed:", err);
    } catch (e) {
      console.error("Checkout error:", e);
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleManageSubscription() {
    try {
      const token = localStorage.getItem(AUTH_TOKEN);
      const res = await fetch("/api/system/stripe/customer-portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        }
      }
    } catch (e) {
      console.error("Portal error:", e);
    }
  }

  function getPriceForPlan(plan) {
    const prices = plan.pricing?.[billingCycle];
    if (!prices) return null;
    const firstKey = Object.keys(prices)[0];
    return prices[firstKey];
  }

  function getAnnualMonthly(plan) {
    const yearlyPrices = plan.pricing?.yearly;
    if (!yearlyPrices) return null;
    const firstKey = Object.keys(yearlyPrices)[0];
    return Math.round(yearlyPrices[firstKey] / 12);
  }

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#231F20]">
        <div className="w-8 h-8 border-2 border-[#FF7EDC] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#231F20] overflow-auto">
      {/* Atmospheric background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#FF7EDC]/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-[#293DF0]/[0.04] rounded-full blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <img
            src={loginLogo}
            alt="KARIANA"
            className="h-10 mx-auto mb-8 opacity-80"
          />
          <h1
            className="text-5xl md:text-6xl text-[#E8E8E9] mb-4 tracking-tight"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Choose your plan
          </h1>
          <p className="text-[#B0B0B1] text-lg max-w-xl mx-auto leading-relaxed" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
            Unlock the full power of AI-driven Unreal Engine development.
            {subscription?.trialActive && (
              <span className="block mt-2 text-[#FF7EDC]">
                {subscription.trialDaysRemaining} days remaining in your free trial
              </span>
            )}
            {subscription?.trialExpired && (
              <span className="block mt-2 text-red-400">
                Your free trial has expired. Choose a plan to continue.
              </span>
            )}
          </p>
        </div>

        {/* Billing cycle toggle */}
        <div className="flex items-center justify-center gap-4 mb-14">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
              billingCycle === "monthly"
                ? "bg-[#FF7EDC] text-[#231F20]"
                : "bg-[#2A2627] text-[#B0B0B1] hover:text-[#E8E8E9] border border-[#3A3637]"
            }`}
            style={{ fontFamily: "'Instrument Sans', sans-serif" }}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
              billingCycle === "yearly"
                ? "bg-[#FF7EDC] text-[#231F20]"
                : "bg-[#2A2627] text-[#B0B0B1] hover:text-[#E8E8E9] border border-[#3A3637]"
            }`}
            style={{ fontFamily: "'Instrument Sans', sans-serif" }}
          >
            Annual
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              billingCycle === "yearly" ? "bg-[#231F20]/30 text-[#231F20]" : "bg-[#FF7EDC]/10 text-[#FF7EDC]"
            }`}>
              Save up to 57%
            </span>
          </button>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {plans.map((plan) => {
            const accent = PLAN_ACCENTS[plan.key] || PLAN_ACCENTS.solo;
            const Icon = PLAN_ICONS[plan.key] || Crown;
            const price = getPriceForPlan(plan);
            const annualMonthly = getAnnualMonthly(plan);
            const isCurrentPlan = subscription?.plan === plan.key && subscription?.subscriptionActive;
            const isPopular = plan.key === "team";

            return (
              <div
                key={plan.key}
                className={`relative group rounded-2xl border transition-all duration-500 ${
                  isPopular
                    ? `border-[#293DF0]/40 ${accent.glow}`
                    : "border-[#3A3637]/60 hover:border-[#3A3637]"
                } bg-[#1A1718]/80 backdrop-blur-sm`}
              >
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span
                      className="bg-gradient-to-r from-[#293DF0] to-[#6B7AFF] text-white text-xs font-semibold px-4 py-1.5 rounded-full"
                      style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                    >
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="p-8">
                  {/* Plan header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accent.gradient} flex items-center justify-center`}>
                      <Icon size={20} weight="fill" className="text-white" />
                    </div>
                    <div>
                      <h3
                        className="text-xl text-[#E8E8E9] font-medium"
                        style={{ fontFamily: "'Instrument Serif', serif" }}
                      >
                        {plan.name}
                      </h3>
                      <p className="text-xs text-[#B0B0B1]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                        {plan.hosting === "cloud" ? "Cloud-hosted" : "Self-hosted"} &middot; {plan.maxSeats === 1 ? "1 seat" : `Up to ${plan.maxSeats} seats`}
                      </p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-8">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-light text-[#E8E8E9] tracking-tight" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                        ${billingCycle === "monthly" ? price : annualMonthly}
                      </span>
                      <span className="text-[#B0B0B1] text-sm" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                        /mo
                      </span>
                    </div>
                    {billingCycle === "yearly" && (
                      <p className="text-xs text-[#B0B0B1] mt-1" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                        Billed as ${price}/year
                      </p>
                    )}
                    {billingCycle === "monthly" && annualMonthly && (
                      <p className="text-xs text-[#FF7EDC]/70 mt-1" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                        ${annualMonthly}/mo billed annually
                      </p>
                    )}
                  </div>

                  {/* CTA */}
                  <button
                    disabled={isCurrentPlan || checkoutLoading === plan.key}
                    onClick={() => isCurrentPlan ? handleManageSubscription() : handleCheckout(plan.key)}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 mb-8 ${
                      isCurrentPlan
                        ? "bg-[#2A2627] text-[#B0B0B1] cursor-pointer border border-[#3A3637] hover:border-[#FF7EDC]/30"
                        : isPopular
                        ? "bg-gradient-to-r from-[#293DF0] to-[#6B7AFF] text-white hover:shadow-[0_0_30px_-5px_rgba(41,61,240,0.5)] hover:scale-[1.02]"
                        : `bg-gradient-to-r ${accent.gradient} text-white hover:scale-[1.02] hover:${accent.glow}`
                    }`}
                    style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                  >
                    {checkoutLoading === plan.key ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : isCurrentPlan ? (
                      "Manage Subscription"
                    ) : (
                      <>Get Started <ArrowRight size={16} weight="bold" /></>
                    )}
                  </button>

                  {/* Feature list */}
                  <div className="space-y-2.5">
                    <p className="text-xs uppercase tracking-widest text-[#B0B0B1]/60 mb-3" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                      {plan.key === "solo" ? "Includes" : plan.key === "team" ? "Everything in Solo, plus" : "Everything in Team, plus"}
                    </p>
                    {getHighlightFeatures(plan.key).map((feature) => (
                      <div key={feature} className="flex items-start gap-2.5">
                        <Check
                          size={14}
                          weight="bold"
                          className={`mt-0.5 flex-shrink-0 ${
                            plan.key === "solo" ? "text-[#FF7EDC]" :
                            plan.key === "team" ? "text-[#6B7AFF]" :
                            "text-[#E8E8E9]"
                          }`}
                        />
                        <span className="text-sm text-[#B0B0B1]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                          {FEATURE_LABELS[feature] || feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature comparison table */}
        <div className="mb-20">
          <h2
            className="text-3xl text-[#E8E8E9] text-center mb-10"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Compare all features
          </h2>

          <div className="rounded-2xl border border-[#3A3637]/60 bg-[#1A1718]/60 backdrop-blur-sm overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-4 border-b border-[#3A3637]/60 bg-[#2A2627]/40">
              <div className="p-5" />
              {plans.map((plan) => (
                <div key={plan.key} className="p-5 text-center">
                  <span
                    className="text-[#E8E8E9] font-medium"
                    style={{ fontFamily: "'Instrument Serif', serif" }}
                  >
                    {plan.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Feature groups */}
            {FEATURE_GROUPS.map((group) => (
              <div key={group.name}>
                <div className="px-5 py-3 bg-[#2A2627]/20 border-b border-[#3A3637]/30">
                  <span
                    className="text-xs uppercase tracking-widest text-[#B0B0B1]/60 font-semibold"
                    style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                  >
                    {group.name}
                  </span>
                </div>
                {group.features.map((feature, idx) => (
                  <div
                    key={feature}
                    className={`grid grid-cols-4 ${
                      idx !== group.features.length - 1 ? "border-b border-[#3A3637]/20" : "border-b border-[#3A3637]/40"
                    }`}
                  >
                    <div className="p-4 pl-5">
                      <span className="text-sm text-[#B0B0B1]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                        {FEATURE_LABELS[feature] || feature}
                      </span>
                    </div>
                    {plans.map((plan) => {
                      const has = plan.features?.includes(feature);
                      return (
                        <div key={plan.key} className="p-4 flex justify-center">
                          {has ? (
                            <Check size={16} weight="bold" className="text-[#FF7EDC]" />
                          ) : (
                            <X size={16} weight="bold" className="text-[#3A3637]" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Back to app */}
        {subscription?.active && (
          <div className="text-center pb-10">
            <button
              onClick={() => navigate("/")}
              className="text-[#B0B0B1] hover:text-[#E8E8E9] text-sm transition-colors"
              style={{ fontFamily: "'Instrument Sans', sans-serif" }}
            >
              Back to KARIANA-LLM
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function getHighlightFeatures(planKey) {
  switch (planKey) {
    case "solo":
      return [
        "create_teach_validate", "blueprint_authoring", "scene_assembly",
        "material_pipelines", "performance_profiling", "batch_asset_operations",
        "instant_troubleshooting", "knowledge_capture", "skill_recorder",
      ];
    case "team":
      return [
        "team_onboarding", "dashboard", "admin_panel",
        "audit_logs", "nda_mode", "whitelabel",
        "vcs_integration", "future_updates",
      ];
    case "byom":
      return [
        "premium_support", "unlimited_tokens",
      ];
    default:
      return [];
  }
}
