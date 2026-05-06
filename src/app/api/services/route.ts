import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { validationError } from "@/lib/api";
import { requirePermission } from "@/lib/permissions";
import { ensureDatabaseInitialized, prisma } from "@/lib/prisma";
import { toServiceDTO } from "@/lib/serializers";
import { serviceInputSchema } from "@/lib/validators";

const listQuerySchema = z.object({
  includeInactive: z.enum(["true", "false"]).optional(),
  query: z.string().optional(),
});

const DEFAULT_SERVICES = [
  { name: "Refill", category: "Wimpern", defaultPriceCents: 4900, durationMinutes: 75, sortOrder: 10 },
  { name: "Neuset 1:1", category: "Wimpern", defaultPriceCents: 8900, durationMinutes: 120, sortOrder: 20 },
  { name: "Volumenset", category: "Wimpern", defaultPriceCents: 10900, durationMinutes: 140, sortOrder: 30 },
  { name: "Individuell", category: "Sonderleistung", defaultPriceCents: 0, durationMinutes: 60, sortOrder: 40 },
];

export async function GET(request: NextRequest) {
  const auth = requirePermission(request, "services:read");
  if (auth.denied) {
    return auth.denied;
  }

  await ensureDatabaseInitialized();

  const parsed = listQuerySchema.safeParse({
    includeInactive: request.nextUrl.searchParams.get("includeInactive") ?? undefined,
    query: request.nextUrl.searchParams.get("query") ?? undefined,
  });
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const query = parsed.data.query?.trim();
  const includeInactive = parsed.data.includeInactive === "true";

  let services = await prisma.service.findMany({
    where: {
      isActive: includeInactive ? undefined : true,
      OR: query
        ? [
            { name: { contains: query, mode: "insensitive" } },
            { category: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  if (services.length === 0) {
    await prisma.service.createMany({
      data: DEFAULT_SERVICES.map((service) => ({
        ...service,
        isActive: true,
        description: null,
      })),
      skipDuplicates: true,
    });

    services = await prisma.service.findMany({
      where: {
        isActive: includeInactive ? undefined : true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  return NextResponse.json(services.map((service) => toServiceDTO(service)));
}

export async function POST(request: NextRequest) {
  const auth = requirePermission(request, "services:write");
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

  const parsed = serviceInputSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const service = await prisma.service.create({
    data: {
      name: parsed.data.name.trim(),
      category: parsed.data.category?.trim() || null,
      description: parsed.data.description?.trim() || null,
      defaultPriceCents: parsed.data.defaultPriceCents ?? 0,
      durationMinutes: parsed.data.durationMinutes ?? 0,
      isActive: parsed.data.isActive ?? true,
      sortOrder: parsed.data.sortOrder ?? 0,
    },
  });

  return NextResponse.json(toServiceDTO(service), { status: 201 });
}

