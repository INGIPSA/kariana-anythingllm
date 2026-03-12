const { Webhook } = require("svix");
const { User } = require("../models/user");
const { EventLogs } = require("../models/eventLogs");
const { mapClerkRole, KARIANA_ORG_ID, isClerkEnabled, getClerkClient } = require("../utils/middleware/clerkAuth");
const { verifyToken } = require("@clerk/backend");

function clerkWebhookEndpoints(app) {
  if (!app) return;

  // Clerk webhook endpoint - no auth required (verified via svix signature)
  app.post("/system/clerk-webhook", async (request, response) => {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
    if (!WEBHOOK_SECRET) {
      console.error("[Clerk Webhook] CLERK_WEBHOOK_SECRET not configured");
      return response.status(500).json({ error: "Webhook secret not configured" });
    }

    // Get the raw body for verification
    const payload = JSON.stringify(request.body);
    const headers = {
      "svix-id": request.headers["svix-id"],
      "svix-timestamp": request.headers["svix-timestamp"],
      "svix-signature": request.headers["svix-signature"],
    };

    let evt;
    try {
      const wh = new Webhook(WEBHOOK_SECRET);
      evt = wh.verify(payload, headers);
    } catch (err) {
      console.error("[Clerk Webhook] Verification failed:", err.message);
      return response.status(400).json({ error: "Invalid webhook signature" });
    }

    try {
      switch (evt.type) {
        case "user.created": {
          const { id, username, email_addresses, first_name, last_name, image_url } = evt.data;
          const email = email_addresses?.[0]?.email_address;
          const displayName = username || email?.split("@")[0] || `user_${id.slice(-8)}`;

          // Check if user already exists
          const existing = await User.get({ clerkId: id });
          if (existing) break;

          const result = await User.createFromClerk({
            clerkId: id,
            username: displayName.toLowerCase().replace(/[^a-z0-9._@-]/g, "_").substring(0, 32),
            role: "default",
            pfpFilename: image_url || null,
          });

          if (result.user) {
            // Auto-assign to KARIANA workspace
            await autoAssignToKarianaWorkspace(result.user.id);

            await EventLogs.logEvent("clerk_user_created", {
              clerkId: id,
              username: result.user.username,
            });
          }
          break;
        }

        case "user.updated": {
          const { id, username, image_url } = evt.data;
          const existing = await User.get({ clerkId: id });
          if (!existing) break;

          const updates = {};
          if (image_url) updates.pfpFilename = image_url;
          // Don't update username to avoid conflicts

          if (Object.keys(updates).length > 0) {
            await User._update(existing.id, updates);
          }
          break;
        }

        case "user.deleted": {
          const { id } = evt.data;
          const existing = await User.get({ clerkId: id });
          if (existing) {
            await User.delete({ id: existing.id });
            await EventLogs.logEvent("clerk_user_deleted", {
              clerkId: id,
              username: existing.username,
            });
          }
          break;
        }

        case "organizationMembership.created":
        case "organizationMembership.updated": {
          const { organization, public_user_data, role } = evt.data;
          if (organization?.id !== KARIANA_ORG_ID) break;

          const clerkUserId = public_user_data?.user_id;
          if (!clerkUserId) break;

          const existing = await User.get({ clerkId: clerkUserId });
          if (existing) {
            const newRole = mapClerkRole(role);
            if (existing.role !== newRole) {
              await User._update(existing.id, { role: newRole });
              await EventLogs.logEvent("clerk_role_updated", {
                clerkId: clerkUserId,
                oldRole: existing.role,
                newRole,
              });
            }
          }
          break;
        }

        case "organizationMembership.deleted": {
          const { organization, public_user_data } = evt.data;
          if (organization?.id !== KARIANA_ORG_ID) break;

          const clerkUserId = public_user_data?.user_id;
          if (!clerkUserId) break;

          const existing = await User.get({ clerkId: clerkUserId });
          if (existing) {
            // Suspend user when removed from org
            await User._update(existing.id, { suspended: 1 });
            await EventLogs.logEvent("clerk_user_suspended", {
              clerkId: clerkUserId,
              reason: "Removed from organization",
            });
          }
          break;
        }

        default:
          break;
      }

      return response.status(200).json({ received: true });
    } catch (error) {
      console.error("[Clerk Webhook] Processing error:", error);
      return response.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Clerk auth endpoint - frontend calls this after Clerk sign-in
  // to get the local KARIANA-LLM user and session info
  app.post("/system/clerk-auth", async (request, response) => {
    if (!isClerkEnabled()) {
      return response.status(400).json({ error: "Clerk is not configured" });
    }

    const auth = request.header("Authorization");
    const token = auth ? auth.split(" ")[1] : null;

    if (!token) {
      return response.status(401).json({ error: "No auth token" });
    }

    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });

      if (!payload?.sub) {
        return response.status(401).json({ error: "Invalid token" });
      }

      const clerkUserId = payload.sub;
      let user = await User.get({ clerkId: clerkUserId });

      if (!user) {
        // Auto-provision
        const clerk = getClerkClient();
        const clerkUser = await clerk.users.getUser(clerkUserId);
        const username = clerkUser.username ||
          clerkUser.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
          `user_${clerkUserId.slice(-8)}`;

        let role = "default";
        try {
          const memberships = await clerk.organizations.getOrganizationMembershipList({
            organizationId: KARIANA_ORG_ID,
          });
          const membership = memberships.data?.find(m => m.publicUserData?.userId === clerkUserId);
          if (membership) role = mapClerkRole(membership.role);
        } catch (e) {}

        const result = await User.createFromClerk({
          clerkId: clerkUserId,
          username: username.toLowerCase().replace(/[^a-z0-9._@-]/g, "_").substring(0, 32),
          role,
        });

        if (result.user) {
          user = result.user;
          // Auto-assign workspace
          const prisma = require("../utils/prisma");
          const workspace = await prisma.workspaces.findFirst({ where: { slug: "kariana-unreal-engine" } });
          if (workspace) {
            await prisma.workspace_users.create({
              data: { user_id: user.id, workspace_id: workspace.id },
            }).catch(() => {});
          }
        }
      }

      if (!user) {
        return response.status(500).json({ error: "Failed to provision user" });
      }

      if (user.suspended) {
        return response.status(401).json({ error: "Account suspended" });
      }

      return response.status(200).json({
        valid: true,
        user: User.filterFields(user),
        token: token, // Pass through the Clerk token
        message: null,
      });
    } catch (error) {
      console.error("[Clerk Auth] Error:", error.message);
      return response.status(401).json({ error: "Authentication failed" });
    }
  });

  // Public endpoint - no auth needed
  app.get("/system/clerk-config", (request, response) => {
    return response.status(200).json({
      clerkEnabled: isClerkEnabled(),
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY || null,
      orgId: isClerkEnabled() ? (process.env.CLERK_ORG_ID || "org_3AWsdum8b7FHgYszVZirCcLeVbR") : null,
    });
  });

  // Subscription status endpoint - checks Clerk org billing status
  app.get("/system/subscription-status", async (request, response) => {
    if (!isClerkEnabled()) {
      return response.status(200).json({
        active: true,
        plan: null,
        trialActive: false,
        trialExpired: false,
        message: "Billing not configured",
      });
    }

    const auth = request.header("Authorization");
    const token = auth ? auth.split(" ")[1] : null;
    if (!token) {
      return response.status(401).json({ error: "No auth token" });
    }

    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
      if (!payload?.sub) {
        return response.status(401).json({ error: "Invalid token" });
      }

      const clerk = getClerkClient();
      const org = await clerk.organizations.getOrganization({
        organizationId: KARIANA_ORG_ID,
      });

      const publicMetadata = org.publicMetadata || {};
      const plan = publicMetadata.plan || null;
      const trialStartDate = publicMetadata.trialStartDate || org.createdAt;
      const subscriptionActive = publicMetadata.subscriptionActive === true;

      // Calculate trial status
      const TRIAL_DAYS = 14;
      const trialStart = new Date(trialStartDate);
      const now = new Date();
      const daysSinceTrialStart = Math.floor(
        (now - trialStart) / (1000 * 60 * 60 * 24)
      );
      const trialDaysRemaining = Math.max(0, TRIAL_DAYS - daysSinceTrialStart);
      const trialExpired = trialDaysRemaining === 0;
      const trialActive = !trialExpired && !subscriptionActive;

      // User has access if: subscription is active OR trial hasn't expired
      const active = subscriptionActive || !trialExpired;

      const { PLANS } = require("../utils/kariana/planConfig");

      return response.status(200).json({
        active,
        plan: plan || "trial",
        planDetails: plan ? PLANS[plan] || null : null,
        subscriptionActive,
        trialActive,
        trialExpired: trialExpired && !subscriptionActive,
        trialDaysRemaining,
        trialStartDate: trialStart.toISOString(),
        plans: Object.entries(PLANS).map(([key, p]) => ({
          key,
          name: p.name,
          description: p.description,
          pricing: p.pricing,
          maxSeats: p.maxSeats,
          hosting: p.hosting,
          features: p.features,
          support: p.support,
        })),
      });
    } catch (error) {
      console.error("[Subscription Status] Error:", error.message);
      return response.status(500).json({ error: "Failed to check subscription" });
    }
  });
}

async function autoAssignToKarianaWorkspace(userId) {
  try {
    const prisma = require("../utils/prisma");
    // Find the KARIANA workspace
    const workspace = await prisma.workspaces.findFirst({
      where: { slug: "kariana-unreal-engine" },
    });
    if (!workspace) return;

    // Check if already assigned
    const existing = await prisma.workspace_users.findFirst({
      where: { user_id: userId, workspace_id: workspace.id },
    });
    if (existing) return;

    await prisma.workspace_users.create({
      data: { user_id: userId, workspace_id: workspace.id },
    });
  } catch (error) {
    console.error("[Clerk] Failed to auto-assign workspace:", error.message);
  }
}

module.exports = { clerkWebhookEndpoints };
