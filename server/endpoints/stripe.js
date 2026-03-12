const { isStripeEnabled, getStripe, getPlanMap, STRIPE_PLANS } = require("../utils/kariana/stripeConfig");
const { isClerkEnabled, getClerkClient, KARIANA_ORG_ID } = require("../utils/middleware/clerkAuth");
const { verifyToken } = require("@clerk/backend");
const { User } = require("../models/user");
const { EventLogs } = require("../models/eventLogs");

function stripeEndpoints(app) {
  if (!app) return;

  // Get Stripe config (public - no auth needed)
  app.get("/system/stripe-config", (request, response) => {
    return response.status(200).json({
      stripeEnabled: isStripeEnabled(),
      publishableKey: isStripeEnabled() ? process.env.STRIPE_PUBLISHABLE_KEY : null,
    });
  });

  // Create a Stripe Checkout session
  app.post("/system/stripe/create-checkout", async (request, response) => {
    if (!isStripeEnabled()) {
      return response.status(400).json({ error: "Stripe is not configured" });
    }

    const user = await authenticateRequest(request);
    if (!user) {
      return response.status(401).json({ error: "Authentication required" });
    }

    const { planKey, billingCycle = "monthly" } = request.body || {};
    if (!planKey || !STRIPE_PLANS[planKey]) {
      return response.status(400).json({ error: "Invalid plan" });
    }

    try {
      const stripe = getStripe();
      const planMap = await getPlanMap();
      const plan = planMap[planKey];
      if (!plan) {
        return response.status(500).json({ error: "Plan not configured in Stripe" });
      }

      const priceId = billingCycle === "yearly" ? plan.yearlyPriceId : plan.monthlyPriceId;
      const trialDays = STRIPE_PLANS[planKey].trialDays;

      // Find or create Stripe customer for this user
      const customerId = await findOrCreateCustomer(stripe, user);

      // Determine URLs
      const baseUrl = request.headers.origin || `http://localhost:${process.env.SERVER_PORT || 3001}`;
      const frontendUrl = request.headers.referer?.replace(/\/[^/]*$/, "") || "http://localhost:3000";

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          trial_period_days: trialDays,
          metadata: {
            plan_key: planKey,
            kariana_user_id: String(user.id),
            clerk_user_id: user.clerkId || "",
          },
        },
        success_url: `${frontendUrl}/?subscription=success`,
        cancel_url: `${frontendUrl}/pricing?status=cancelled`,
        metadata: {
          plan_key: planKey,
          kariana_user_id: String(user.id),
        },
      });

      // Ensure the KARIANA workspace exists before redirecting to Stripe
      // so it's ready when the user returns after payment
      await ensureKarianaWorkspaceWithGuidance();

      await EventLogs.logEvent("stripe_checkout_created", {
        userId: user.id,
        planKey,
        billingCycle,
        sessionId: session.id,
      });

      return response.status(200).json({ url: session.url, sessionId: session.id });
    } catch (error) {
      console.error("[Stripe] Checkout creation failed:", error.message);
      return response.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // Get subscription status
  app.get("/system/stripe/subscription-status", async (request, response) => {
    if (!isStripeEnabled()) {
      return response.status(200).json({
        active: true,
        plan: null,
        trialActive: false,
        trialExpired: false,
        message: "Stripe not configured — access granted",
      });
    }

    const user = await authenticateRequest(request);
    if (!user) {
      return response.status(401).json({ error: "Authentication required" });
    }

    try {
      const stripe = getStripe();
      const customerId = await findOrCreateCustomer(stripe, user);

      // Get active subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
      });

      // Find the most relevant subscription
      const activeSub = subscriptions.data.find(
        (s) => s.status === "active" || s.status === "trialing"
      );

      if (!activeSub) {
        // Check if there was ever a subscription (expired trial or cancelled)
        const pastSub = subscriptions.data.find(
          (s) => s.status === "past_due" || s.status === "canceled" || s.status === "incomplete_expired"
        );

        // No subscription at all — check if within initial 14-day grace period
        const { PLANS } = require("../utils/kariana/planConfig");
        const customerCreated = await getCustomerCreatedDate(stripe, customerId);
        const TRIAL_DAYS = 14;
        const daysSinceCreated = Math.floor((Date.now() - customerCreated) / (1000 * 60 * 60 * 24));
        const trialDaysRemaining = Math.max(0, TRIAL_DAYS - daysSinceCreated);
        const trialExpired = trialDaysRemaining === 0;

        return response.status(200).json({
          active: !trialExpired,
          plan: "trial",
          planDetails: null,
          subscriptionActive: false,
          subscriptionStatus: pastSub?.status || null,
          trialActive: !trialExpired,
          trialExpired,
          trialDaysRemaining,
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
      }

      // Has active subscription
      const planKey = activeSub.metadata?.plan_key || "solo";
      const isTrialing = activeSub.status === "trialing";
      const trialEnd = activeSub.trial_end ? new Date(activeSub.trial_end * 1000) : null;
      const trialDaysRemaining = trialEnd
        ? Math.max(0, Math.ceil((trialEnd - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

      const { PLANS } = require("../utils/kariana/planConfig");

      return response.status(200).json({
        active: true,
        plan: planKey,
        planDetails: PLANS[planKey] || null,
        subscriptionActive: true,
        subscriptionStatus: activeSub.status,
        subscriptionId: activeSub.id,
        currentPeriodEnd: new Date(activeSub.current_period_end * 1000).toISOString(),
        trialActive: isTrialing,
        trialExpired: false,
        trialDaysRemaining: isTrialing ? trialDaysRemaining : 0,
        cancelAtPeriodEnd: activeSub.cancel_at_period_end,
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
      console.error("[Stripe] Subscription status check failed:", error.message);
      return response.status(500).json({ error: "Failed to check subscription status" });
    }
  });

  // Create a Stripe Customer Portal session (for managing subscription)
  app.post("/system/stripe/customer-portal", async (request, response) => {
    if (!isStripeEnabled()) {
      return response.status(400).json({ error: "Stripe is not configured" });
    }

    const user = await authenticateRequest(request);
    if (!user) {
      return response.status(401).json({ error: "Authentication required" });
    }

    try {
      const stripe = getStripe();
      const customerId = await findOrCreateCustomer(stripe, user);
      const frontendUrl = request.headers.referer?.replace(/\/[^/]*$/, "") || "http://localhost:3000";

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${frontendUrl}/pricing`,
      });

      return response.status(200).json({ url: session.url });
    } catch (error) {
      console.error("[Stripe] Portal session failed:", error.message);
      return response.status(500).json({ error: "Failed to create portal session" });
    }
  });

  // Stripe webhook handler
  app.post("/system/stripe/webhook", async (request, response) => {
    const stripe = getStripe();
    if (!stripe) {
      return response.status(400).json({ error: "Stripe not configured" });
    }

    const sig = request.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      if (webhookSecret && sig) {
        // In production, verify the webhook signature
        const rawBody = JSON.stringify(request.body);
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      } else {
        // In development without webhook secret, trust the payload
        event = request.body;
      }
    } catch (err) {
      console.error("[Stripe Webhook] Signature verification failed:", err.message);
      return response.status(400).json({ error: "Invalid signature" });
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const planKey = session.metadata?.plan_key;
          console.log(`[Stripe] Checkout completed: ${session.id}, plan: ${planKey}`);

          // Ensure the KARIANA workspace exists with onboarding guidance
          await ensureKarianaWorkspaceWithGuidance();

          await EventLogs.logEvent("stripe_checkout_completed", {
            sessionId: session.id,
            planKey,
            customerId: session.customer,
          });
          break;
        }

        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = event.data.object;
          const planKey = subscription.metadata?.plan_key;
          console.log(`[Stripe] Subscription ${event.type}: ${subscription.id}, status: ${subscription.status}, plan: ${planKey}`);

          // Update Clerk org metadata if Clerk is enabled
          if (isClerkEnabled() && planKey) {
            try {
              const clerk = getClerkClient();
              await clerk.organizations.updateOrganizationMetadata({
                organizationId: KARIANA_ORG_ID,
                publicMetadata: {
                  plan: planKey,
                  subscriptionActive: subscription.status === "active" || subscription.status === "trialing",
                  stripeSubscriptionId: subscription.id,
                  stripeCustomerId: subscription.customer,
                },
              });
            } catch (e) {
              console.error("[Stripe] Failed to update Clerk org metadata:", e.message);
            }
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object;
          console.log(`[Stripe] Subscription cancelled: ${subscription.id}`);

          if (isClerkEnabled()) {
            try {
              const clerk = getClerkClient();
              await clerk.organizations.updateOrganizationMetadata({
                organizationId: KARIANA_ORG_ID,
                publicMetadata: {
                  subscriptionActive: false,
                },
              });
            } catch (e) {
              console.error("[Stripe] Failed to update Clerk org metadata:", e.message);
            }
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object;
          console.log(`[Stripe] Payment failed for customer: ${invoice.customer}`);
          await EventLogs.logEvent("stripe_payment_failed", {
            customerId: invoice.customer,
            invoiceId: invoice.id,
          });
          break;
        }

        default:
          break;
      }

      return response.status(200).json({ received: true });
    } catch (error) {
      console.error("[Stripe Webhook] Processing error:", error);
      return response.status(500).json({ error: "Webhook processing failed" });
    }
  });
}

/**
 * Authenticate request using Clerk token from Authorization header.
 * Returns the local user record or null.
 */
async function authenticateRequest(request) {
  if (!isClerkEnabled()) return null;

  const auth = request.header("Authorization");
  const token = auth ? auth.split(" ")[1] : null;
  if (!token) return null;

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    if (!payload?.sub) return null;
    return await User.get({ clerkId: payload.sub });
  } catch {
    return null;
  }
}

/**
 * Find or create a Stripe customer for a KARIANA user.
 */
async function findOrCreateCustomer(stripe, user) {
  // Search by metadata first
  const existing = await stripe.customers.search({
    query: `metadata["kariana_user_id"]:"${user.id}"`,
  });

  if (existing.data.length > 0) {
    return existing.data[0].id;
  }

  // Create new customer
  const customer = await stripe.customers.create({
    name: user.username,
    metadata: {
      kariana_user_id: String(user.id),
      clerk_user_id: user.clerkId || "",
    },
  });

  console.log(`[Stripe] Created customer for user ${user.username}: ${customer.id}`);
  return customer.id;
}

async function getCustomerCreatedDate(stripe, customerId) {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return customer.created * 1000; // Convert to ms
  } catch {
    return Date.now();
  }
}

/**
 * Ensure the KARIANA workspace exists and has onboarding suggested messages.
 * Called after successful Stripe checkout to prepare the post-payment experience.
 */
async function ensureKarianaWorkspaceWithGuidance() {
  try {
    const { Workspace } = require("../models/workspace");
    const { WorkspaceSuggestedMessages } = require("../models/workspacesSuggestedMessages");

    let workspace = await Workspace.get({ slug: "kariana-unreal-engine" });
    if (!workspace) {
      const result = await Workspace.new("KARIANA - Unreal Engine");
      workspace = result.workspace;
      if (workspace) {
        await Workspace.update(workspace.id, {
          openAiPrompt: `You are a KARIANA AI assistant for Unreal Engine development.
You help users install and configure KARIANA-LLM locally, and guide them through using 250+ MCP tools for controlling Unreal Engine.

When a user asks about installation, guide them through:
1. Download the KARIANA-LLM desktop installer from the team dashboard
2. Run the installer — it sets up the local server, frontend, and MCP connections automatically
3. During onboarding, point it to their Unreal Engine project (where the KARIANA plugin is installed)
4. The app auto-discovers MCP servers (mcp_server.py and mcp_remote_server.py) from the plugin
5. Once connected, all 250+ MCP tools become available for AI-driven Unreal Engine development

Tool categories include: Actor management, Blueprint operations, Material editing, Level design, Animation, Physics, UI/UMG, Asset management, PCG, and more.`,
        });
      }
    }

    // Set/update suggested messages for the workspace
    if (workspace) {
      const existing = await WorkspaceSuggestedMessages.getMessages(workspace.slug);
      if (!existing || existing.length === 0) {
        await WorkspaceSuggestedMessages.saveAll(
          [
            {
              heading: "How do I install KARIANA-LLM locally?",
              message: "Walk me through installing the KARIANA-LLM desktop app with MCP pre-configured to connect to my Unreal Engine project.",
            },
            {
              heading: "Show me available MCP tools",
              message: "List all the KARIANA MCP tool categories I can use to control Unreal Engine, with examples of what each can do.",
            },
            {
              heading: "Help me set up my first scene",
              message: "Guide me through creating a new level in Unreal Engine using KARIANA's MCP tools — set up lighting, cameras, and a few actors.",
            },
            {
              heading: "What can KARIANA do?",
              message: "Give me an overview of KARIANA's capabilities for Unreal Engine development and how the MCP integration works.",
            },
          ],
          workspace.slug
        );
      }
    }
  } catch (error) {
    console.error("[Stripe] Failed to ensure KARIANA workspace:", error.message);
  }
}

module.exports = { stripeEndpoints };
