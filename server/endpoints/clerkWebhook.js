const { Webhook } = require("svix");
const { User } = require("../models/user");
const { ApiKey } = require("../models/apiKeys");
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

    // Use the raw body buffer for webhook signature verification
    const payload = request.rawBody || JSON.stringify(request.body);
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

/**
 * CLI Auth endpoint - serves a page with Clerk SignIn for CLI authentication.
 * After successful sign-in, generates an API key and redirects to the CLI's callback.
 */
function cliAuthEndpoints(app) {
  if (!app) return;

  // Serves the Clerk login page for CLI authentication
  app.get("/v1/cli-auth", (request, response) => {
    if (!isClerkEnabled()) {
      return response.status(400).send("Clerk authentication is not configured on this server.");
    }

    const callback = request.query.callback;
    if (!callback) {
      return response.status(400).send("Missing callback parameter.");
    }

    const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
    const orgId = process.env.CLERK_ORG_ID || "org_3AWsdum8b7FHgYszVZirCcLeVbR";

    // Serve a self-contained HTML page with Clerk sign-in
    response.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kariana CLI — Sign In</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f1117;
      color: #e2e8f0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .container {
      text-align: center;
      max-width: 400px;
      width: 100%;
      padding: 2rem;
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #c084fc; }
    .subtitle { color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem; }
    #clerk-mount { min-height: 300px; display: flex; justify-content: center; }
    .status {
      margin-top: 1.5rem;
      padding: 1rem;
      border-radius: 8px;
      display: none;
    }
    .status.loading { display: block; background: #1e293b; color: #94a3b8; }
    .status.success { display: block; background: #064e3b; color: #6ee7b7; }
    .status.error { display: block; background: #7f1d1d; color: #fca5a5; }
    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid #94a3b8;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      vertical-align: middle;
      margin-right: 8px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <h1>Kariana CLI</h1>
    <p class="subtitle">Sign in to connect your terminal</p>
    <div id="clerk-mount"></div>
    <div id="status" class="status"></div>
  </div>

  <script
    async
    crossorigin="anonymous"
    data-clerk-publishable-key="${publishableKey}"
    src="https://cdn.jsdelivr.net/npm/@clerk/clerk-js@latest/dist/clerk.browser.js"
    type="text/javascript"
  ></script>

  <script>
    const CALLBACK_URL = ${JSON.stringify(callback)};

    window.addEventListener("load", async () => {
      const statusEl = document.getElementById("status");

      try {
        await window.Clerk.load();

        // If already signed in, skip the sign-in form
        if (window.Clerk.user) {
          await handleAuthenticated();
          return;
        }

        // Mount Clerk SignIn component
        window.Clerk.mountSignIn(document.getElementById("clerk-mount"), {
          appearance: {
            baseTheme: undefined,
            variables: { colorPrimary: "#c084fc" },
            elements: {
              rootBox: { width: "100%" },
              card: { background: "#1e293b", border: "1px solid #334155", boxShadow: "none" },
            },
          },
        });

        // Listen for auth state change
        window.Clerk.addListener(async ({ user }) => {
          if (user) {
            window.Clerk.unmountSignIn(document.getElementById("clerk-mount"));
            await handleAuthenticated();
          }
        });
      } catch (err) {
        statusEl.className = "status error";
        statusEl.textContent = "Failed to load authentication: " + err.message;
      }
    });

    async function handleAuthenticated() {
      const statusEl = document.getElementById("status");
      statusEl.className = "status loading";
      statusEl.innerHTML = '<span class="spinner"></span> Generating API key...';

      try {
        // Get the Clerk session token
        const token = await window.Clerk.session.getToken();

        // Call the server to generate an API key
        const res = await fetch("/api/v1/cli-auth/generate-key", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
          },
        });

        const data = await res.json();

        if (!res.ok || data.error) {
          throw new Error(data.error || "Failed to generate API key");
        }

        statusEl.className = "status success";
        statusEl.textContent = "Authenticated! Redirecting to CLI...";

        // Redirect to CLI callback with the API key
        setTimeout(() => {
          window.location.href = CALLBACK_URL + "?token=" + encodeURIComponent(data.apiKey);
        }, 500);
      } catch (err) {
        statusEl.className = "status error";
        statusEl.textContent = "Error: " + err.message;
        // Redirect with error
        setTimeout(() => {
          window.location.href = CALLBACK_URL + "?error=" + encodeURIComponent(err.message);
        }, 2000);
      }
    }
  </script>
</body>
</html>`);
  });

  // Generate an API key for an authenticated Clerk user
  app.post("/v1/cli-auth/generate-key", async (request, response) => {
    if (!isClerkEnabled()) {
      return response.status(400).json({ error: "Clerk is not configured" });
    }

    const auth = request.header("Authorization");
    const token = auth ? auth.split(" ")[1] : null;

    if (!token) {
      return response.status(401).json({ error: "No auth token" });
    }

    try {
      // Verify the Clerk token
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });

      if (!payload?.sub) {
        return response.status(401).json({ error: "Invalid token" });
      }

      const clerkUserId = payload.sub;
      let user = await User.get({ clerkId: clerkUserId });

      // Auto-provision user if needed (same logic as /system/clerk-auth)
      if (!user) {
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
          await autoAssignWorkspace(user.id);
        }
      }

      if (!user) {
        return response.status(500).json({ error: "Failed to provision user" });
      }

      if (user.suspended) {
        return response.status(401).json({ error: "Account suspended" });
      }

      // Generate an API key for CLI usage
      const { apiKey, error } = await ApiKey.create(user.id);
      if (error) {
        return response.status(500).json({ error: "Failed to generate API key" });
      }

      await EventLogs.logEvent("api_key_created", {
        source: "cli-auth",
        userId: user.id,
        username: user.username,
      }, user.id);

      return response.status(200).json({
        apiKey: apiKey.secret,
        user: User.filterFields(user),
      });
    } catch (error) {
      console.error("[CLI Auth] Error:", error.message);
      return response.status(401).json({ error: "Authentication failed" });
    }
  });
}

module.exports = { clerkWebhookEndpoints, cliAuthEndpoints };
