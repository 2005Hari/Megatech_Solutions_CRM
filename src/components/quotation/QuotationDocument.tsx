import { forwardRef } from "react"
import { COMPANY } from "@/lib/company"
import { formatCurrency, formatDate } from "@/lib/utils"
import { lineTotal, type QuotationTotals } from "@/lib/totals"
import type { DocItem, DocSection, Term } from "./types"

type Props = {
  /** Free text for the "To," block; rendered as plain text (never as HTML). */
  customerBlock: string
  date: Date | string
  refNo: string
  subject: string
  salutation: string
  sections: DocSection[]
  items: DocItem[]
  totals: QuotationTotals
  includeGst: boolean
  gstPct: number
  includeFreight: boolean
  terms: Term[]
}

function Rows({ items }: { items: DocItem[] }) {
  return items.map((it, idx) => (
    <tr key={it.id} className="even:bg-gray-50 border-b border-gray-100 last:border-0">
      <td className="p-2 w-8 align-top">{idx + 1}</td>
      <td className="p-2 whitespace-pre-wrap align-top">
        {it.brand ? <span className="font-semibold block">{it.brand}</span> : null}
        {it.desc || "—"}
      </td>
      <td className="p-2 text-right w-16 align-top">
        {it.qty} {it.unit}
      </td>
      <td className="p-2 text-right w-20 align-top">{formatCurrency(it.rate)}</td>
      <td className="p-2 text-right w-24 align-top font-semibold">{formatCurrency(lineTotal(it.qty, it.rate))}</td>
    </tr>
  ))
}

/**
 * The formal, printable quotation. Shared by the builder preview and the
 * details page so the two can never drift apart (they previously did: the
 * details copy silently dropped every item that sat inside a section).
 */
const QuotationDocument = forwardRef<HTMLDivElement, Props>(function QuotationDocument(p, ref) {
  const th = "bg-gray-900 text-white p-2 font-semibold border-b border-gray-200"
  const totalCell = "p-1.5 px-3 border-b border-gray-200"

  return (
    <div
      ref={ref}
      className="bg-white mx-auto text-black p-0 overflow-hidden shadow-2xl"
      style={{ width: "794px", fontFamily: "'Inter', sans-serif" }}
    >
      <div className="text-center py-6 px-11 border-b-2 border-red-600">
        <div className="font-serif text-[38px] font-black text-red-600 tracking-tight leading-none">{COMPANY.name}</div>
        <div className="text-xs text-gray-600 mt-1 font-medium">{COMPANY.tagline}</div>
      </div>

      <div className="py-5 px-11">
        <div className="text-center mb-3 mt-2">
          <span className="bg-gray-900 text-white text-[11.5px] font-bold tracking-[3px] px-8 py-1.5 uppercase">
            Quotation
          </span>
        </div>

        <div className="flex justify-between text-[11px] leading-relaxed mb-3">
          <div>
            <b>To,</b>
            <div className="text-[13px] font-bold text-red-600 whitespace-pre-line">{p.customerBlock.trim() || "___________"}</div>
          </div>
          <div className="text-right">
            <b>Date:</b> {formatDate(p.date)}
          </div>
        </div>

        <div className="flex justify-between text-[11px] mb-3">
          <div>
            <b>Subject / Ref:</b> {p.subject || "—"}
          </div>
          <div>
            <b>Quotation No.:</b> {p.refNo || "—"}
          </div>
        </div>

        <div className="text-[12px] text-gray-800 leading-relaxed mb-3">
          <span>{p.salutation}</span>
          <br />
          <br />
          Thank you for your valuable enquiry. With reference to your requirement, we are pleased to submit our best
          quotation for your kind consideration.
        </div>

        <table className="w-full text-[11px] mb-3 border-collapse">
          <thead>
            <tr>
              <th className={`${th} text-left w-8`}>Sr.</th>
              <th className={`${th} text-left`}>Description</th>
              <th className={`${th} text-right w-16`}>Qty</th>
              <th className={`${th} text-right w-20`}>Rate (₹)</th>
              <th className={`${th} text-right w-24`}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {p.sections.map(sec => (
              <tr key={sec.id}>
                <td colSpan={5} className="p-0">
                  <table className="w-full">
                    <tbody>
                      <tr>
                        <td colSpan={5} className="bg-gray-200 p-2 font-bold text-gray-800">
                          {sec.name}
                        </td>
                      </tr>
                      <Rows items={sec.items} />
                    </tbody>
                  </table>
                </td>
              </tr>
            ))}

            {p.items.length > 0 && (
              <tr>
                <td colSpan={5} className="p-0">
                  <table className="w-full">
                    <tbody>
                      {p.sections.length > 0 && (
                        <tr>
                          <td colSpan={5} className="bg-gray-200 p-2 font-bold text-gray-800">
                            Other Items
                          </td>
                        </tr>
                      )}
                      <Rows items={p.items} />
                    </tbody>
                  </table>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex justify-end mb-4">
          <table className="text-[11px] border border-gray-200 rounded min-w-[220px]">
            <tbody>
              <tr>
                <td className={totalCell}>Subtotal</td>
                <td className={`${totalCell} text-right min-w-[110px]`}>{formatCurrency(p.totals.subtotal)}</td>
              </tr>
              {p.includeGst && (
                <tr>
                  <td className={totalCell}>GST ({p.gstPct}%)</td>
                  <td className={`${totalCell} text-right min-w-[110px]`}>{formatCurrency(p.totals.gstAmount)}</td>
                </tr>
              )}
              {p.includeFreight && (
                <tr>
                  <td className={totalCell}>Freight</td>
                  <td className={`${totalCell} text-right min-w-[110px]`}>{formatCurrency(p.totals.freightAmount)}</td>
                </tr>
              )}
              <tr className="bg-gray-900 text-white font-bold text-xs">
                <td className="p-1.5 px-3">Grand Total</td>
                <td className="p-1.5 px-3 text-right min-w-[110px]">{formatCurrency(p.totals.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="text-[12px] text-gray-800 leading-relaxed mb-3">
          We look forward to receiving your valuable Purchase Order and the opportunity to serve your organization.
        </div>

        {p.terms.length > 0 && (
          <div className="bg-gray-50 border-l-[3px] border-red-600 p-3 rounded-r text-[10.5px] leading-loose mb-3 text-gray-800">
            <b className="text-red-600 text-[11px]">Terms &amp; Conditions:</b>
            <div className="mt-1">
              {p.terms.map((tc, i) => (
                <div key={tc.id}>
                  <b>
                    {i + 1}. {tc.label}:
                  </b>{" "}
                  {tc.value}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-[12px] text-gray-800 leading-relaxed mb-3">
          Thanking you and assuring you of our best attention and services at all times.
        </div>

        <div className="flex justify-between pt-3 border-t border-gray-200 text-[11px] leading-relaxed">
          <div>
            <b className="text-red-600 text-[12px]">For {COMPANY.name}</b>
            <br />
            <br />
            <br />
            _________________________
            <br />
            <b>{COMPANY.signatory.name}</b>
            <br />
            {COMPANY.signatory.title}
            <br />
            <span className="text-gray-400 text-[10px]">Stamp &amp; Signature</span>
          </div>
        </div>
      </div>

      <div className="border-t-[1.5px] border-gray-300 p-2.5 px-11 text-center text-[9.5px] text-gray-500 leading-relaxed bg-gray-50">
        {COMPANY.offices.map(line => (
          <div key={line}>{line}</div>
        ))}
        <div>{COMPANY.contactLine}</div>
      </div>
    </div>
  )
})

export default QuotationDocument
