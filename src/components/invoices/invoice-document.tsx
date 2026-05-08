"use client";

import { CreditCard, ReceiptText } from "lucide-react";

import { buildInvoiceLayoutModel, INVOICE_LAYOUT_DIMENSIONS } from "@/lib/invoice-layout";
import type { InvoiceDTO } from "@/types/crm";

type Props = {
  invoice: InvoiceDTO;
};

export function InvoiceDocument({ invoice }: Props) {
  const layout = buildInvoiceLayoutModel(invoice);
  const senderBrandLine = layout.senderLines[0] ?? "Bella by Sobiella";
  const footerSenderLines = layout.senderLines.slice(1);

  return (
    <article
      data-testid="invoice-document"
      className="mx-auto w-full border border-[#e7dddd] bg-white py-9 text-[14px] text-[#3f3a39] shadow-[0_12px_30px_rgba(71,43,35,0.09)] print:max-w-none print:border-none print:px-0 print:py-0 print:shadow-none"
      style={{
        maxWidth: `${INVOICE_LAYOUT_DIMENSIONS.pageWidth}px`,
        paddingInline: `${INVOICE_LAYOUT_DIMENSIONS.pagePaddingX}px`,
      }}
    >
      <header className="grid gap-8 md:grid-cols-[minmax(0,1fr)_234px]">
        <div className="space-y-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/bella-logo-transparent.png"
            alt="Bella by Sobiella Logo"
            width={INVOICE_LAYOUT_DIMENSIONS.logoMaxWidth}
            height={INVOICE_LAYOUT_DIMENSIONS.logoMaxHeight}
            className="block h-auto object-contain"
            style={{
              width: `${INVOICE_LAYOUT_DIMENSIONS.logoMaxWidth}px`,
              maxWidth: "100%",
              height: "auto",
            }}
          />
          <div className="max-w-[280px] text-[13px] leading-5 text-[#514948]">
            <p className="font-semibold text-[#a56f56]">{senderBrandLine}</p>
          </div>

          <section
            className="max-w-[292px] border border-[#eadfd9] bg-[#fff8f5] px-4 py-3"
            style={{ width: `${INVOICE_LAYOUT_DIMENSIONS.recipientBoxWidth}px` }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b57f65]">
              Rechnungsempfänger
            </p>
            <div className="mt-2.5 space-y-0.5 text-[14px] leading-6 text-[#423c3a]">
              {layout.recipientLines.map((line, index) => (
                <p key={`${line}-${index}`} className={index === 1 ? "font-semibold" : undefined}>
                  {line}
                </p>
              ))}
            </div>
          </section>
        </div>

        <section
          className="self-start rounded-xl border border-[#eadfd9] bg-[#fff8f5] px-5 py-5"
          style={{ width: `${INVOICE_LAYOUT_DIMENSIONS.metaColumnWidth}px` }}
        >
          <h1 className="text-center font-serif text-[27px] tracking-[0.22em] text-[#b0765d]">
            RECHNUNG
          </h1>
          <dl className="mt-5 space-y-3 text-[13px] text-[#403a39]">
            <div className="grid grid-cols-[1fr_auto] items-center gap-x-4">
              <dt className="font-semibold">Rechnungsnummer</dt>
              <dd>{layout.invoiceLabel}</dd>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-x-4">
              <dt className="font-semibold">Rechnungsdatum</dt>
              <dd>{layout.issueDate}</dd>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-x-4">
              <dt className="font-semibold">Leistungsdatum</dt>
              <dd>{layout.serviceDate}</dd>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-x-4">
              <dt className="font-semibold">Kundennummer</dt>
              <dd>{layout.customerNumberLabel}</dd>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-x-4">
              <dt className="font-semibold">Zahlungsart</dt>
              <dd>{layout.paymentMethodLabel}</dd>
            </div>
          </dl>
        </section>
      </header>

      <section className="mt-8 overflow-hidden border-y border-[#e7dfdb]">
        <table className="w-full border-collapse text-[13px]">
          <thead className="text-[#b17961]">
            <tr>
              <th className="border-b border-[#efe7e4] px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.15em]">
                Leistung
              </th>
              <th className="w-[92px] border-b border-[#efe7e4] px-2 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.15em]">
                Anzahl
              </th>
              <th className="w-[116px] border-b border-[#efe7e4] px-2 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.15em]">
                Einzelpreis
              </th>
              <th className="w-[116px] border-b border-[#efe7e4] px-2 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.15em]">
                Betrag
              </th>
            </tr>
          </thead>
          <tbody>
            {layout.items.map((item) => (
              <tr key={item.id} className="border-t border-[#f1ebe8] text-[#3e3938]">
                <td className="px-2 py-4 align-top">
                  <p className="font-semibold">{item.service}</p>
                  {item.description ? (
                    <p className="mt-0.5 text-[12px] text-[#857d79]">{item.description}</p>
                  ) : null}
                </td>
                <td className="px-2 py-4 text-right align-top tabular-nums">{item.quantity}</td>
                <td className="px-2 py-4 text-right align-top tabular-nums">{item.unitPrice}</td>
                <td className="px-2 py-4 text-right align-top font-medium tabular-nums">{item.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8 grid gap-7 md:grid-cols-[minmax(0,1fr)_214px]">
        <div className="space-y-5">
          <section
            data-testid="invoice-payment-block"
            className="rounded-xl border border-[#eadfd9] bg-[#fffaf7] px-4 py-3 text-[13px] leading-6 text-[#494240] [overflow-wrap:anywhere] [word-break:break-word]"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex size-8 items-center justify-center rounded-full border border-[#ecd9d1] bg-[#fff2eb] text-[#b17961]">
                <CreditCard className="size-4" />
              </span>
              <div className="flex-1 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b17961]">
                  Zahlungsinformationen
                </p>
                <p className="font-semibold text-[#433c3a]">{layout.payment.title}</p>
                {layout.payment.leftLines.map((line, index) => (
                  <p key={`${line}-${index}`}>{line}</p>
                ))}
                {layout.payment.rightLines.map((line, index) => (
                  <p key={`${line}-${index}`}>{line}</p>
                ))}
              </div>
            </div>
          </section>

          {layout.legalNote ? (
            <section className="rounded-xl border border-[#eadfd9] bg-[#fffaf7] px-4 py-3 text-[13px] leading-6 text-[#494240]">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex size-8 items-center justify-center rounded-full border border-[#ecd9d1] bg-[#fff2eb] text-[#b17961]">
                  <ReceiptText className="size-4" />
                </span>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b17961]">
                    Rechtlicher Hinweis
                  </p>
                  <p>{layout.legalNote}</p>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <aside
          className="self-end rounded-xl border border-[#eadfd9] bg-[#fffaf7] text-[13px] text-[#413b39]"
          style={{ width: `${INVOICE_LAYOUT_DIMENSIONS.totalsBoxWidth}px` }}
        >
          <div className="space-y-2 px-4 py-3">
            <div className="flex items-center justify-between">
              <span>Zwischensumme</span>
              <span className="tabular-nums">{layout.subtotalDisplay}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Rabatt</span>
              <span className="tabular-nums">{layout.discountDisplay}</span>
            </div>
          </div>
          <div className="flex items-center justify-between border-y border-[#e4d2cb] bg-[#f7ebe6] px-4 py-3 text-[#4f2e2c]">
            <span className="text-[20px] font-semibold">Gesamtbetrag</span>
            <span className="text-[30px] font-bold tabular-nums">{layout.totalDisplay}</span>
          </div>
          <p className="px-4 py-3 text-right text-[12px] text-[#6a5a54]">{layout.payableHint}</p>
        </aside>
      </section>

      <footer className="mt-8 border-t border-[#e9e0dc] pt-4">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="grid gap-y-1 text-[12px] leading-5 text-[#5a514f] md:grid-cols-2 md:gap-x-10">
            {footerSenderLines.map((line, index) => (
              <p key={`footer-${line}-${index}`}>{line}</p>
            ))}
          </div>
          <div className="space-y-2 text-right">
            {layout.closingText ? (
              <p className="font-serif text-[28px] italic text-[#c58f74]">{layout.closingText}</p>
            ) : null}
            {layout.additionalFooterNote ? (
              <p className="text-[12px] leading-5 text-[#706762]">{layout.additionalFooterNote}</p>
            ) : null}
          </div>
        </div>
      </footer>
    </article>
  );
}
