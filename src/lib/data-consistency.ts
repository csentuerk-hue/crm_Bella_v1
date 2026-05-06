import { prisma } from "@/lib/prisma";

type ConsistencyResult = {
  setBilled: number;
  downgraded: number;
};

// Keeps appointment status aligned with invoice existence.
// Rule: "ABGERECHNET" is only valid when a persisted invoice exists.
export async function reconcileAppointmentInvoiceConsistency(): Promise<ConsistencyResult> {
  const [setBilled, downgraded] = await prisma.$transaction([
    prisma.appointment.updateMany({
      where: {
        invoice: {
          is: {
            lifecycleStatus: "FINALISIERT",
          },
        },
        OR: [
          { status: { not: "ABGERECHNET" } },
          { isCancelled: true },
          { cancellationReason: { not: null } },
        ],
      },
      data: {
        status: "ABGERECHNET",
        isCancelled: false,
        cancellationReason: null,
      },
    }),
    prisma.appointment.updateMany({
      where: {
        OR: [
          { invoice: { is: null } },
          {
            invoice: {
              is: {
                lifecycleStatus: "ENTWURF",
              },
            },
          },
        ],
        status: "ABGERECHNET",
      },
      data: {
        status: "ERLEDIGT",
      },
    }),
  ]);

  return {
    setBilled: setBilled.count,
    downgraded: downgraded.count,
  };
}
