import { NextRequest, NextResponse } from "next/server";

import { validationError } from "@/lib/api";
import { getOrCreateInvoiceSettings, toInvoiceSettingsDTO } from "@/lib/invoice-settings";
import { requirePermission } from "@/lib/permissions";
import { ensureDatabaseInitialized, prisma } from "@/lib/prisma";
import { invoiceSettingsUpdateSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const auth = requirePermission(request, "settings:read");
  if (auth.denied) {
    return auth.denied;
  }

  await ensureDatabaseInitialized();
  const settings = await getOrCreateInvoiceSettings(prisma);
  return NextResponse.json(toInvoiceSettingsDTO(settings));
}

export async function PUT(request: NextRequest) {
  const auth = requirePermission(request, "settings:write");
  if (auth.denied) {
    return auth.denied;
  }

  await ensureDatabaseInitialized();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const parsed = invoiceSettingsUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const settings = await prisma.invoiceSettings.upsert({
    where: { id: "default" },
    update: parsed.data,
    create: {
      id: "default",
      ...parsed.data,
    },
  });

  return NextResponse.json(toInvoiceSettingsDTO(settings));
}


