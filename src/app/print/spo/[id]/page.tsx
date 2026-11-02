import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { COMPANY } from "@/lib/company";
import { isPriced, spoTotalCost } from "@/lib/finance";
import { lineTotal } from "@/lib/totals";
import { formatCurrency, formatDate } from "@/lib/utils";
import AutoPrint from "./AutoPrint";

export const dynamic = "force-dynamic";

export default async function SPOPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const spo = await prisma.supplierPO.findUnique({
    where: { id },
    include: { items: true, supplier: true, cpo: true }
  });

  if (!spo) notFound();

  const totalCost = spoTotalCost(spo.items);

  return (
    <div className="bg-slate-100 min-h-screen py-8 print:py-0 print-wrapper">
      <style>{`
        aside {
          display: none !important;
        }
        main {
          margin-left: 0 !important;
        }
        @media print {
          body, html {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-wrapper {
            padding: 0 !important;
            background: white !important;
            min-height: 0 !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
      {/* Formal A4 styled page container */}
      <div className="bg-white mx-auto text-black p-0 overflow-hidden shadow-2xl print:shadow-none border border-slate-200 print:border-none print-container" style={{ width: "794px", fontFamily: "'Inter', sans-serif" }}>
        
        {/* Header */}
        <div className="text-center py-6 px-11 border-b-2 border-red-600">
          <div className="font-serif text-[38px] font-black text-red-600 tracking-tight leading-none">{COMPANY.name}</div>
          <div className="text-xs text-gray-600 mt-1 font-medium">{COMPANY.tagline}</div>
        </div>

        <div className="py-5 px-11">
          {/* Title Box */}
          <div className="text-center mb-4 mt-2">
            <span className="bg-gray-900 text-white text-[11.5px] font-bold tracking-[3px] px-8 py-1.5 uppercase">Purchase Order</span>
          </div>

          {/* Supplier Info & PO Dates */}
          <div className="flex justify-between text-[11px] leading-relaxed mb-4">
            <div>
              <b>To Supplier,</b><br/>
              <span className="text-[13px] font-bold text-red-600">
                {spo.supplier?.name || "Supplier Not Assigned"}
              </span>
              {spo.supplier?.contactDetails && (
                <div className="text-gray-700 mt-0.5 whitespace-pre-line">
                  {spo.supplier.contactDetails}
                </div>
              )}
            </div>
            <div className="text-right leading-loose">
              <div><b>PO Date:</b> {formatDate(spo.date)}</div>
              {spo.deliveryDate && <div><b>Expected Delivery:</b> {formatDate(spo.deliveryDate)}</div>}
            </div>
          </div>

          {/* References */}
          <div className="flex justify-between text-[11px] mb-4 border-b border-slate-100 pb-2">
            <div><b>PO Number:</b> {spo.refNo}</div>
            {spo.cpo && <div><b>Linked Customer PO:</b> {spo.cpo.refNo}</div>}
          </div>

          <div className="text-[12px] text-gray-800 leading-relaxed mb-4">
            Dear Sir / Madam,<br/><br/>
            With reference to our discussions / your commercial offer, we are pleased to place this purchase order with your organization for the following materials:
          </div>

          {/* Products Table */}
          <table className="w-full text-[11px] mb-4 border-collapse">
            <thead>
              <tr>
                <th className="bg-gray-900 text-white p-2 font-semibold text-left border-b border-gray-200 w-8">Sr.</th>
                <th className="bg-gray-900 text-white p-2 font-semibold text-left border-b border-gray-200">Product Description</th>
                <th className="bg-gray-900 text-white p-2 font-semibold text-right border-b border-gray-200 w-16">Qty</th>
                <th className="bg-gray-900 text-white p-2 font-semibold text-left border-b border-gray-200 w-16">Unit</th>
                <th className="bg-gray-900 text-white p-2 font-semibold text-right border-b border-gray-200 w-24">Buy Rate (₹)</th>
                <th className="bg-gray-900 text-white p-2 font-semibold text-right border-b border-gray-200 w-28">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {spo.items.map((it, idx) => (
                <tr key={it.id} className="even:bg-gray-50">
                  <td className="p-2.5 border-b border-gray-100 text-center">{idx + 1}</td>
                  <td className="p-2.5 border-b border-gray-100 font-semibold text-gray-800">{it.productName}</td>
                  <td className="p-2.5 border-b border-gray-100 text-right">{it.qty}</td>
                  <td className="p-2.5 border-b border-gray-100 text-left">{it.unit || "nos"}</td>
                  <td className="p-2.5 border-b border-gray-100 text-right">{isPriced(it.buyPrice) ? formatCurrency(it.buyPrice) : "Pending"}</td>
                  <td className="p-2.5 border-b border-gray-100 text-right font-bold">{formatCurrency(lineTotal(it.qty, it.buyPrice ?? 0))}</td>
                </tr>
              ))}
              {/* Filler lines to make it look professional */}
              {[...Array(Math.max(0, 4 - spo.items.length))].map((_, i) => (
                <tr key={`filler-${i}`} className="h-8">
                  <td className="border-b border-gray-100"></td>
                  <td className="border-b border-gray-100"></td>
                  <td className="border-b border-gray-100"></td>
                  <td className="border-b border-gray-100"></td>
                  <td className="border-b border-gray-100"></td>
                  <td className="border-b border-gray-100"></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Cost Summary */}
          <div className="flex justify-end mb-4">
            <table className="text-[11px] border border-gray-200 rounded min-w-[240px]">
              <tbody>
                <tr className="bg-gray-900 text-white font-bold text-xs">
                  <td className="p-2 px-3">Total Purchase Cost</td>
                  <td className="p-2 px-3 text-right min-w-[120px]">{formatCurrency(totalCost)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="text-[11.5px] text-gray-800 leading-relaxed mb-4">
            Please supply the material in good condition. Quote our Purchase Order number on your invoice for auditing.
          </div>

          {/* Terms Box */}
          <div className="bg-gray-50 border-l-[3px] border-red-600 p-3 rounded-r text-[10.5px] leading-loose mb-4 text-gray-800">
            <b className="text-red-600 text-[11px] uppercase">Purchase Terms:</b><br/>
            <div className="mt-1">
              {spo.notes ? (
                <div className="whitespace-pre-line leading-relaxed">{spo.notes}</div>
              ) : (
                <div className="space-y-0.5">
                  <div><b>1. Delivery:</b> Material must be delivered in original packaging.</div>
                  <div><b>2. Commercials:</b> Rates are final as per this PO. Invoice must reflect PO pricing.</div>
                  <div><b>3. Invoicing:</b> Please reference the PO Number on all billing invoices.</div>
                </div>
              )}
            </div>
          </div>

          {/* Signatures */}
          <div className="flex justify-between pt-4 border-t border-gray-200 text-[11px] leading-relaxed">
            <div>
              <b className="text-red-600 text-[12px]">For {COMPANY.name}</b><br/><br/>
              <br/>_________________________<br/>
              <b>{COMPANY.signatory.name}</b><br/>{COMPANY.signatory.title}<br/>
              <span className="text-gray-400 text-[10px]">Stamp & Signature</span>
            </div>
          </div>
        </div>

        {/* Office Footer Address Block */}
        <div className="border-t-[1.5px] border-gray-300 p-2.5 px-11 text-center text-[9.5px] text-gray-500 leading-relaxed bg-gray-50 mt-4">
          {COMPANY.offices.map(line => (
            <div key={line}>{line}</div>
          ))}
          <div>{COMPANY.contactLine}</div>
        </div>
      </div>

      <AutoPrint />
    </div>
  );
}
