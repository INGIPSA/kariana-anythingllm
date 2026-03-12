/**
 * KARIANA-LLM Plan Configuration
 * Maps Clerk organization metadata to feature access.
 *
 * Plans (from Clerk org public_metadata.plan):
 *   - solo: Single seat, cloud-hosted, basic features
 *   - team: Multi-seat, cloud-hosted, full features
 *   - byom: Multi-seat, self-hosted, full features + premium support
 *
 * Roles (from Clerk org membership role):
 *   - org:admin  → admin  (19 permissions, full access)
 *   - org:manager → manager (8 permissions, team management)
 *   - org:member  → default (2 permissions, basic access)
 */

const PLANS = {
  solo: {
    name: "Solo",
    description: "Our software on our cloud - single seat",
    hosting: "cloud",
    maxSeats: 1,
    features: [
      "create_teach_validate",
      "vendor_asset_audits",
      "naming_convention_checks",
      "pre_delivery_qa",
      "performance_profiling",
      "project_organization",
      "instant_troubleshooting",
      "knowledge_capture",
      "contextual_learning",
      "material_pipelines",
      "blueprint_authoring",
      "scene_assembly",
      "pcg_environment_generation",
      "batch_asset_operations",
      "lighting_cameras",
      "skill_recorder",
      "level_sequence_animation",
      "batch_rename",
      "undo_system",
      "chat_history",
      "telemetry_opt_in",
    ],
    support: "standard",
    pricing: {
      monthly: { 1: 159 },
      yearly: { 1: 409 },
    },
  },
  team: {
    name: "Team",
    description: "Our software on our cloud - team",
    hosting: "cloud",
    maxSeats: 30,
    features: [
      // All Solo features
      "create_teach_validate",
      "vendor_asset_audits",
      "naming_convention_checks",
      "pre_delivery_qa",
      "performance_profiling",
      "project_organization",
      "instant_troubleshooting",
      "team_onboarding",
      "knowledge_capture",
      "contextual_learning",
      "material_pipelines",
      "blueprint_authoring",
      "scene_assembly",
      "pcg_environment_generation",
      "batch_asset_operations",
      "lighting_cameras",
      "skill_recorder",
      "level_sequence_animation",
      "batch_rename",
      "undo_system",
      "chat_history",
      "telemetry_opt_in",
      // Team-only features
      "dashboard",
      "admin_panel",
      "audit_logs",
      "nda_mode",
      "whitelabel",
      "vcs_integration",
      "future_updates",
    ],
    support: "standard",
    pricing: {
      monthly: { "1-5": 149, "6-15": 119, "16-30": 75 },
      yearly: { "1-5": 1499, "6-15": 1199, "16-30": 749 },
    },
  },
  byom: {
    name: "BYOM",
    description: "Our software on your cloud",
    hosting: "self-hosted",
    maxSeats: 30,
    features: [
      // All Team features
      "create_teach_validate",
      "vendor_asset_audits",
      "naming_convention_checks",
      "pre_delivery_qa",
      "performance_profiling",
      "project_organization",
      "instant_troubleshooting",
      "team_onboarding",
      "knowledge_capture",
      "contextual_learning",
      "material_pipelines",
      "blueprint_authoring",
      "scene_assembly",
      "pcg_environment_generation",
      "batch_asset_operations",
      "lighting_cameras",
      "skill_recorder",
      "level_sequence_animation",
      "batch_rename",
      "undo_system",
      "chat_history",
      "telemetry_opt_in",
      "dashboard",
      "admin_panel",
      "audit_logs",
      "nda_mode",
      "whitelabel",
      "vcs_integration",
      "future_updates",
      // BYOM-only features
      "premium_support",
      "unlimited_tokens",
    ],
    support: "premium",
    pricing: {
      monthly: { "1-5": 175, "6-15": 149, "16-30": 99 },
      yearly: { "1-5": 1749, "6-15": 1499, "16-30": 999 },
    },
  },
};

// Features that require specific Clerk permissions
const FEATURE_PERMISSION_MAP = {
  dashboard: "org:features:dashboard",
  admin_panel: "org:features:admin_panel",
  audit_logs: "org:features:audit_logs",
  whitelabel: "org:features:whitelabel",
  nda_mode: "org:features:nda_mode",
  vcs_integration: "org:features:vcs",
  future_updates: "org:features:future_updates",
  premium_support: "org:features:premium_support",
};

/**
 * Get plan config by plan key
 */
function getPlan(planKey) {
  return PLANS[planKey] || PLANS.solo;
}

/**
 * Check if a plan has a specific feature
 */
function planHasFeature(planKey, feature) {
  const plan = getPlan(planKey);
  return plan.features.includes(feature);
}

/**
 * Get the Clerk permission key for a feature (if any)
 */
function getFeaturePermission(feature) {
  return FEATURE_PERMISSION_MAP[feature] || null;
}

/**
 * Get pricing for a plan at a specific seat count
 */
function getPricing(planKey, seatCount, billingCycle = "monthly") {
  const plan = getPlan(planKey);
  const prices = plan.pricing[billingCycle];
  if (!prices) return null;

  for (const [range, price] of Object.entries(prices)) {
    if (range.includes("-")) {
      const [min, max] = range.split("-").map(Number);
      if (seatCount >= min && seatCount <= max) return price;
    } else if (seatCount === Number(range)) {
      return price;
    }
  }
  return null;
}

module.exports = {
  PLANS,
  FEATURE_PERMISSION_MAP,
  getPlan,
  planHasFeature,
  getFeaturePermission,
  getPricing,
};
