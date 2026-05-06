import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const STRIPE_ENABLED = process.env.STRIPE_ACTIVE === "true";

export const stripeClient =
  stripeSecretKey && STRIPE_ENABLED
    ? new Stripe(stripeSecretKey, { apiVersion: "2026-03-25.dahlia" })
    : null;
