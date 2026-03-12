const { createClerkClient, verifyToken } = require("@clerk/backend");

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY;
const KARIANA_ORG_ID = process.env.CLERK_ORG_ID || "org_3AWsdum8b7FHgYszVZirCcLeVbR";

// Role mapping: Clerk org role -> KARIANA-LLM role
const CLERK_ROLE_MAP = {
  "org:admin": "admin",
  "org:manager": "manager",
  "org:member": "default",
  "admin": "admin",
  "manager": "manager",
  "member": "default",
};

function mapClerkRole(clerkRole) {
  return CLERK_ROLE_MAP[clerkRole] || "default";
}

function isClerkEnabled() {
  return !!(CLERK_SECRET_KEY && CLERK_PUBLISHABLE_KEY);
}

function getClerkClient() {
  if (!isClerkEnabled()) return null;
  return createClerkClient({
    secretKey: CLERK_SECRET_KEY,
    publishableKey: CLERK_PUBLISHABLE_KEY,
  });
}

/**
 * Middleware that verifies Clerk JWT tokens from the Authorization header.
 * On success, sets response.locals.user with the local KARIANA-LLM user record
 * and response.locals.clerkUserId with the Clerk user ID.
 */
async function clerkAuthMiddleware(request, response, next) {
  if (!isClerkEnabled()) {
    // Fall back to legacy auth if Clerk is not configured
    const { validatedRequest } = require("./validatedRequest");
    return validatedRequest(request, response, next);
  }

  // Always set multiUserMode true when Clerk is enabled
  response.locals.multiUserMode = true;

  const auth = request.header("Authorization");
  const token = auth ? auth.split(" ")[1] : null;

  if (!token) {
    return response.status(401).json({ error: "No auth token found." });
  }

  try {
    // Verify the Clerk session token
    const payload = await verifyToken(token, {
      secretKey: CLERK_SECRET_KEY,
      authorizedParties: [], // Allow all parties for now
    });

    if (!payload || !payload.sub) {
      return response.status(401).json({ error: "Invalid auth token." });
    }

    const clerkUserId = payload.sub;

    // Look up the local user by clerkId
    const { User } = require("../../models/user");
    let user = await User.get({ clerkId: clerkUserId });

    if (!user) {
      // Auto-provision the user if they don't exist locally yet
      // This handles the case where webhook hasn't fired yet
      const clerk = getClerkClient();
      const clerkUser = await clerk.users.getUser(clerkUserId);

      const username = clerkUser.username ||
        clerkUser.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
        `user_${clerkUserId.slice(-8)}`;

      // Determine role from org membership
      let role = "default";
      try {
        const memberships = await clerk.organizations.getOrganizationMembershipList({
          organizationId: KARIANA_ORG_ID,
        });
        const membership = memberships.data?.find(m => m.publicUserData?.userId === clerkUserId);
        if (membership) {
          role = mapClerkRole(membership.role);
        }
      } catch (e) {
        console.error("[Clerk] Failed to fetch org membership:", e.message);
      }

      const result = await User.createFromClerk({
        clerkId: clerkUserId,
        username: username.toLowerCase().replace(/[^a-z0-9._@-]/g, "_").substring(0, 32),
        role,
        pfpFilename: clerkUser.imageUrl || null,
      });

      if (result.user) {
        user = result.user;
      } else {
        // If creation failed (e.g., username conflict), try to find by username
        user = await User.get({ clerkId: clerkUserId });
        if (!user) {
          return response.status(401).json({ error: "Failed to provision user account." });
        }
      }
    }

    if (user.suspended) {
      return response.status(401).json({ error: "User is suspended from system" });
    }

    response.locals.user = user;
    response.locals.clerkUserId = clerkUserId;
    next();
  } catch (error) {
    console.error("[Clerk Auth] Token verification failed:", error.message);
    return response.status(401).json({ error: "Invalid or expired auth token." });
  }
}

module.exports = {
  clerkAuthMiddleware,
  isClerkEnabled,
  getClerkClient,
  mapClerkRole,
  KARIANA_ORG_ID,
};
