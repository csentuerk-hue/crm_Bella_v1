import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/permissions";
import { STRIPE_ENABLED, stripeClient } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const auth = requirePermission(request, "invoices:write");
  if (auth.denied) {
    return auth.denied;
  }

  if (!STRIPE_ENABLED || !stripeClient) {
    return NextResponse.json(
      {
        enabled: false,
        message:
          "Stripe ist vorbereitet, aber deaktiviert. Setze STRIPE_ACTIVE=true und den Secret Key für Live-Nutzung.",
      },
      { status: 501 },
    );
  }

  return NextResponse.json(
    { enabled: true, message: "Stripe-Checkout ist vorbereitet und aktivierbar." },
    { status: 200 },
  );
}

