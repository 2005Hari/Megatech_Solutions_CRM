import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

export default async function MarginsPage() {
  const cpos = await prisma.customerPO.findMany({
    include: { items: true, customer: true, supplierPOs: { include: { items: true } } },
    orderBy: { date: 'desc' }
  });

  let totalRev = 0, totalCost = 0, totalProfit = 0;
  
  const orderMargins = cpos.map(cpo => {
    const rev = cpo.items.reduce((s, i) => s + (i.qty * i.sellPrice), 0);
    const spo = cpo.supplierPOs[0];
    const cost = spo ? spo.items.reduce((s, i) => s + (i.qty * (i.buyPrice || 0)), 0) : null;
    const profit = cost !== null ? rev - cost : null;
    const margin = profit !== null && rev > 0 ? (profit / rev) * 100 : null;

    if (cost !== null && profit !== null) {
      totalRev += rev;
      totalCost += cost;
      totalProfit += profit;
    }

    return { cpo, spo, rev, cost, profit, margin };
  }).sort((a, b) => (b.margin || -999) - (a.margin || -999));

  const avgMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Margin & Profitability</h1>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Total Revenue</div>
          <div className="text-3xl font-bold text-blue-600 mb-1">{formatCurrency(totalRev)}</div>
          <div className="text-xs text-gray-500">All open orders</div>
        </div>
        <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Total Cost</div>
          <div className="text-3xl font-bold text-gray-800 mb-1">{formatCurrency(totalCost)}</div>
          <div className="text-xs text-gray-500">Supplier cost</div>
        </div>
        <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Total Profit</div>
          <div className="text-3xl font-bold text-green-600 mb-1">{formatCurrency(totalProfit)}</div>
          <div className="text-xs text-gray-500">Revenue - Cost</div>
        </div>
        <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Avg Margin</div>
          <div className="text-3xl font-bold text-purple-600 mb-1">{avgMargin.toFixed(1)}%</div>
          <div className="text-xs text-gray-500">Across all orders</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-800">Order-wise Profitability</h2>
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Customer PO</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3 text-right">Revenue</th>
                <th className="px-5 py-3 text-right">Cost</th>
                <th className="px-5 py-3 text-right">Profit</th>
                <th className="px-5 py-3 text-right">Margin %</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orderMargins.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-6 text-center text-gray-500">No margin data yet</td></tr>
              ) : orderMargins.map(r => (
                <tr key={r.cpo.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4 font-mono font-medium text-blue-600">
                    <Link href={`/cpo/${r.cpo.id}`}>{r.cpo.refNo}</Link>
                  </td>
                  <td className="px-5 py-4 font-medium text-gray-800">{r.cpo.customer.name}</td>
                  <td className="px-5 py-4 text-right">{formatCurrency(r.rev)}</td>
                  <td className="px-5 py-4 text-right">{r.cost !== null ? formatCurrency(r.cost) : <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded text-xs">No SPO</span>}</td>
                  <td className={`px-5 py-4 text-right font-bold ${r.profit !== null && r.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {r.profit !== null ? formatCurrency(r.profit) : '—'}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {r.margin !== null ? (
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${r.margin >= 20 ? 'bg-green-50 text-green-700' : r.margin >= 10 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                        {r.margin.toFixed(1)}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-bold">{r.cpo.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
