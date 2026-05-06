import { redirect } from "next/navigation";

export default async function InvoiceRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/invoices/${id}/preview`);
}
