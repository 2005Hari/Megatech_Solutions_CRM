"use client"

import { memo } from "react"
import { Plus, Trash2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { lineTotal } from "@/lib/totals"
import type { BuilderItem, ProductOption, ServiceOption } from "./builder-model"

const field = "w-full border border-card-border bg-transparent text-foreground rounded p-2 text-sm outline-none"

/** Whole numbers only: quantities are stored as integers. */
function parseQty(value: string): number {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) && n > 0 ? n : 0
}

function parseMoney(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

type RowProps = {
  item: BuilderItem
  index: number
  products: ProductOption[]
  services: ServiceOption[]
  onChange: (item: BuilderItem) => void
  onRemove: (id: string) => void
}

const ItemRow = memo(function ItemRow({ item, index, products, services, onChange, onRemove }: RowProps) {
  const handleDescription = (desc: string) => {
    const product = products.find(p => p.desc === desc)
    const service = services.find(s => s.name === desc)
    if (product) {
      onChange({ ...item, type: "PRODUCT", desc: product.desc, brand: product.brand, rate: product.rate })
    } else if (service) {
      onChange({
        ...item,
        type: "SERVICE",
        desc: service.name + (service.description ? "\n" + service.description : ""),
        rate: service.defaultRate,
        unit: service.defaultUnit,
      })
    } else {
      onChange({ ...item, desc })
    }
  }

  return (
    <tr className="border-b border-card-border last:border-0 hover:bg-muted/30">
      <td className="p-2 text-center text-xs font-bold text-muted-foreground">{index + 1}</td>
      <td className="p-2">
        <select
          aria-label="Item type"
          value={item.type}
          onChange={e => onChange({ ...item, type: e.target.value === "SERVICE" ? "SERVICE" : "PRODUCT" })}
          className={`${field} text-xs`}
        >
          <option value="PRODUCT">Product</option>
          <option value="SERVICE">Service</option>
        </select>
      </td>
      <td className="p-2">
        <div className="flex flex-col gap-1">
          {item.type === "PRODUCT" && (
            <input
              aria-label="Brand"
              value={item.brand}
              onChange={e => onChange({ ...item, brand: e.target.value })}
              className={`${field} text-xs`}
              placeholder="Brand"
            />
          )}
          <textarea
            aria-label="Description"
            value={item.desc}
            onChange={e => handleDescription(e.target.value)}
            rows={2}
            className={`${field} resize-y`}
            placeholder="Product / Service Description"
          />
        </div>
      </td>
      <td className="p-2">
        <input
          aria-label="Quantity"
          type="number"
          min={1}
          step={1}
          value={item.qty}
          onChange={e => onChange({ ...item, qty: parseQty(e.target.value) })}
          className={`${field} text-right`}
        />
      </td>
      <td className="p-2">
        <input
          aria-label="Unit"
          list="dl_units"
          value={item.unit}
          onChange={e => onChange({ ...item, unit: e.target.value })}
          className={field}
          placeholder="Nos"
        />
      </td>
      <td className="p-2">
        <input
          aria-label="Rate"
          type="number"
          min={0}
          step="any"
          value={item.rate}
          onChange={e => onChange({ ...item, rate: parseMoney(e.target.value) })}
          className={`${field} text-right`}
        />
      </td>
      <td className="p-2">
        <input
          aria-label="Estimated cost per unit"
          type="number"
          min={0}
          step="any"
          value={item.estCost}
          onChange={e => onChange({ ...item, estCost: parseMoney(e.target.value) })}
          className={`${field} text-right text-muted-foreground`}
        />
      </td>
      <td className="p-2 text-right font-bold text-foreground">{formatCurrency(lineTotal(item.qty, item.rate))}</td>
      <td className="p-2 text-center">
        <button
          type="button"
          aria-label="Remove item"
          onClick={() => onRemove(item.id)}
          className="text-muted-foreground hover:text-rose-500 p-1 rounded hover:bg-rose-50"
        >
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  )
})

type TableProps = {
  items: BuilderItem[]
  products: ProductOption[]
  services: ServiceOption[]
  onAdd: () => void
  onChange: (item: BuilderItem) => void
  onRemove: (id: string) => void
  hideHeader?: boolean
}

export default function ItemTable({ items, products, services, onAdd, onChange, onRemove, hideHeader }: TableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm text-left border-collapse">
        {!hideHeader && (
          <thead>
            <tr className="bg-muted/50 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-card-border">
              <th className="p-2 w-10 text-center">Sr.</th>
              <th className="p-2 w-24">Type</th>
              <th className="p-2">Description</th>
              <th className="p-2 w-16 text-right">Qty</th>
              <th className="p-2 w-20">Unit</th>
              <th className="p-2 w-24 text-right">Rate</th>
              <th className="p-2 w-24 text-right" title="Your estimated cost per unit. Not shown to the customer.">
                Est. Cost
              </th>
              <th className="p-2 w-24 text-right">Amount</th>
              <th className="p-2 w-10"></th>
            </tr>
          </thead>
        )}
        <tbody>
          {items.map((item, idx) => (
            <ItemRow
              key={item.id}
              item={item}
              index={idx}
              products={products}
              services={services}
              onChange={onChange}
              onRemove={onRemove}
            />
          ))}
        </tbody>
      </table>
      <div className="p-2">
        <button type="button" onClick={onAdd} className="text-xs font-bold text-accent hover:underline flex items-center gap-1">
          <Plus size={12} /> Add Item
        </button>
      </div>
    </div>
  )
}
