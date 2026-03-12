const Stripe = require("stripe");

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;

function isStripeEnabled() {
  return !!(STRIPE_SECRET_KEY && STRIPE_PUBLISHABLE_KEY);
}

function getStripe() {
  if (!isStripeEnabled()) return null;
  return new Stripe(STRIPE_SECRET_KEY);
}

// Plan definitions with Stripe-specific config
const STRIPE_PLANS = {
  solo: {
    name: "Solo",
    description: "Single seat, cloud-hosted KARIANA-LLM for individual developers",
    monthlyPrice: 15900, // cents
    yearlyPrice: 40900,  // cents per year
    trialDays: 14,
    metadata: { plan_key: "solo", max_seats: "1", hosting: "cloud" },
  },
  team: {
    name: "Team",
    description: "1-30 seats, cloud-hosted KARIANA-LLM for teams",
    monthlyPrice: 14900,
    yearlyPrice: 90000,
    trialDays: 14,
    metadata: { plan_key: "team", max_seats: "30", hosting: "cloud" },
  },
  byom: {
    name: "BYOM",
    description: "1-30 seats, self-hosted KARIANA-LLM with bring-your-own-model support",
    monthlyPrice: 17500,
    yearlyPrice: 118800,
    trialDays: 14,
    metadata: { plan_key: "byom", max_seats: "30", hosting: "self-hosted" },
  },
};

/**
 * Ensure Stripe products and prices exist, creating them if needed.
 * Stores product/price IDs in memory for checkout session creation.
 * Returns a map: { solo: { productId, monthlyPriceId, yearlyPriceId }, ... }
 */
async function ensureStripePlans() {
  const stripe = getStripe();
  if (!stripe) return null;

  const planMap = {};

  for (const [key, plan] of Object.entries(STRIPE_PLANS)) {
    // Search for existing product by metadata
    const existingProducts = await stripe.products.search({
      query: `metadata["plan_key"]:"${key}"`,
    });

    let product;
    if (existingProducts.data.length > 0) {
      product = existingProducts.data[0];
    } else {
      product = await stripe.products.create({
        name: `KARIANA-LLM ${plan.name}`,
        description: plan.description,
        metadata: plan.metadata,
      });
      console.log(`[Stripe] Created product: ${product.name} (${product.id})`);
    }

    // Find or create monthly price
    const existingPrices = await stripe.prices.list({
      product: product.id,
      active: true,
    });

    let monthlyPrice = existingPrices.data.find(
      (p) => p.recurring?.interval === "month" && p.unit_amount === plan.monthlyPrice
    );
    if (!monthlyPrice) {
      monthlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.monthlyPrice,
        currency: "usd",
        recurring: { interval: "month" },
        metadata: { plan_key: key, billing_cycle: "monthly" },
      });
      console.log(`[Stripe] Created monthly price for ${key}: $${plan.monthlyPrice / 100}/mo`);
    }

    // Find or create yearly price
    let yearlyPrice = existingPrices.data.find(
      (p) => p.recurring?.interval === "year" && p.unit_amount === plan.yearlyPrice
    );
    if (!yearlyPrice) {
      yearlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.yearlyPrice,
        currency: "usd",
        recurring: { interval: "year" },
        metadata: { plan_key: key, billing_cycle: "yearly" },
      });
      console.log(`[Stripe] Created yearly price for ${key}: $${plan.yearlyPrice / 100}/yr`);
    }

    planMap[key] = {
      productId: product.id,
      monthlyPriceId: monthlyPrice.id,
      yearlyPriceId: yearlyPrice.id,
    };
  }

  return planMap;
}

// Cache for plan map so we don't query Stripe every time
let _planMapCache = null;
async function getPlanMap() {
  if (!_planMapCache) {
    _planMapCache = await ensureStripePlans();
  }
  return _planMapCache;
}

module.exports = {
  isStripeEnabled,
  getStripe,
  STRIPE_PLANS,
  ensureStripePlans,
  getPlanMap,
};
