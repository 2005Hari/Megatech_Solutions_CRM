"use client"

import { useState } from "react"
import type { ActionResult } from "@/lib/action-result"
import { useRouter } from "next/navigation"
import { Pencil, Plus, Trash2, X } from "lucide-react"
import type { Service, Unit } from "@prisma/client"
import { createService, deleteService, updateService, type ServiceInput } from "@/app/actions/services"
import { createUnit, deleteUnit, updateUnit } from "@/app/actions/units"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { useFeedback } from "@/components/ui/Feedback"
import { formatCurrency } from "@/lib/utils"

const card = "bg-card border border-card-border rounded-xl shadow-sm"
const label = "block text-[11px] font-bold text-muted-foreground uppercase mb-1.5"

function UnitsCard({ units }: { units: Unit[] }) {
  const router = useRouter()
  const { notify, confirm } = useFeedback()
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)

  const run = async <T,>(fn: () => Promise<ActionResult<T>>, message: string) => {
    setBusy(true)
    try {
      if (notify(await fn(), message)) router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={card} aria-labelledby="units-h">
      <div className="px-6 py-4 border-b border-card-border">
        <h2 id="units-h" className="font-bold text-foreground">Units</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Suggested in the Unit field of quotation lines.</p>
      </div>
      <form
        className="flex gap-2 p-4 border-b border-card-border"
        onSubmit={async e => {
          e.preventDefault()
          await run(() => createUnit({ name, active: true }), "Unit added.")
          setName("")
        }}
      >
        <Input aria-label="New unit name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Nos, Mtr, Set" required />
        <Button type="submit" disabled={busy}><Plus size={14} className="mr-1" /> Add</Button>
      </form>
      <ul className="divide-y divide-card-border">
        {units.length === 0 && <li className="p-4 text-sm text-muted-foreground">No units yet.</li>}
        {units.map(u => (
          <li key={u.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className={`flex-1 font-medium ${u.active ? "text-foreground" : "text-muted-foreground line-through"}`}>{u.name}</span>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={u.active}
                disabled={busy}
                onChange={() => run(() => updateUnit(u.id, { name: u.name, active: !u.active }), u.active ? "Unit hidden." : "Unit shown.")}
              />
              Active
            </label>
            <button
              aria-label={`Delete unit ${u.name}`}
              disabled={busy}
              className="text-muted-foreground hover:text-rose-500"
              onClick={async () => {
                if (await confirm({ title: `Delete unit "${u.name}"?`, confirmLabel: "Delete", destructive: true })) {
                  await run(() => deleteUnit(u.id), "Unit deleted.")
                }
              }}
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

const EMPTY: ServiceInput = { name: "", description: "", defaultUnit: "Nos", defaultRate: 0, sacCode: "", gstPct: 18, active: true }

function ServicesCard({ services }: { services: Service[] }) {
  const router = useRouter()
  const { notify, confirm } = useFeedback()
  const [editing, setEditing] = useState<string | "new" | null>(null)
  const [form, setForm] = useState<ServiceInput>(EMPTY)
  const [busy, setBusy] = useState(false)

  const open = (s?: Service) => {
    setEditing(s ? s.id : "new")
    setForm(
      s
        ? { name: s.name, description: s.description ?? "", defaultUnit: s.defaultUnit, defaultRate: s.defaultRate, sacCode: s.sacCode ?? "", gstPct: s.gstPct, active: s.active }
        : EMPTY,
    )
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res: ActionResult<unknown> =
        editing === "new" ? await createService(form) : await updateService(editing as string, form)
      if (!notify(res, editing === "new" ? "Service added." : "Service updated.")) return
      setEditing(null)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const set = <K extends keyof ServiceInput>(k: K, v: ServiceInput[K]) => setForm(f => ({ ...f, [k]: v }))

  return (
    <section className={card} aria-labelledby="services-h">
      <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
        <div>
          <h2 id="services-h" className="font-bold text-foreground">Services</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Pre-priced services you can pick from on a quotation line.</p>
        </div>
        <Button size="sm" onClick={() => open()}><Plus size={14} className="mr-1" /> Add service</Button>
      </div>

      {editing && (
        <form onSubmit={save} className="p-4 border-b border-card-border bg-muted/20 grid grid-cols-6 gap-3">
          <div className="col-span-3">
            <label htmlFor="svc-name" className={label}>Name</label>
            <Input id="svc-name" value={form.name} onChange={e => set("name", e.target.value)} required />
          </div>
          <div className="col-span-3">
            <label htmlFor="svc-desc" className={label}>Description</label>
            <Input id="svc-desc" value={form.description ?? ""} onChange={e => set("description", e.target.value)} />
          </div>
          <div>
            <label htmlFor="svc-unit" className={label}>Unit</label>
            <Input id="svc-unit" value={form.defaultUnit} onChange={e => set("defaultUnit", e.target.value)} required />
          </div>
          <div>
            <label htmlFor="svc-rate" className={label}>Rate (₹)</label>
            <Input id="svc-rate" type="number" min={0} step="any" value={form.defaultRate} onChange={e => set("defaultRate", Number(e.target.value) || 0)} />
          </div>
          <div>
            <label htmlFor="svc-sac" className={label}>SAC code</label>
            <Input id="svc-sac" value={form.sacCode ?? ""} onChange={e => set("sacCode", e.target.value)} />
          </div>
          <div>
            <label htmlFor="svc-gst" className={label}>GST %</label>
            <Input id="svc-gst" type="number" min={0} max={100} step="any" value={form.gstPct} onChange={e => set("gstPct", Number(e.target.value) || 0)} />
          </div>
          <label className="flex items-end gap-2 text-sm pb-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={e => set("active", e.target.checked)} /> Active
          </label>
          <div className="flex items-end justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(null)}><X size={14} className="mr-1" /> Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-card-border">
            <tr>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3">SAC</th>
              <th className="px-4 py-3 text-right">GST</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border">
            {services.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">No services yet.</td></tr>
            )}
            {services.map(s => (
              <tr key={s.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="font-semibold text-foreground">{s.name}</div>
                  {s.description && <div className="text-xs text-muted-foreground">{s.description}</div>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{s.defaultUnit}</td>
                <td className="px-4 py-3 text-right font-medium">{formatCurrency(s.defaultRate)}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.sacCode || "—"}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{s.gstPct}%</td>
                <td className="px-4 py-3 text-xs">{s.active ? "Active" : <span className="text-muted-foreground">Hidden</span>}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <button aria-label={`Edit ${s.name}`} className="text-muted-foreground hover:text-foreground" onClick={() => open(s)}><Pencil size={15} /></button>
                    <button
                      aria-label={`Delete ${s.name}`}
                      className="text-muted-foreground hover:text-rose-500"
                      onClick={async () => {
                        if (!(await confirm({ title: `Delete service "${s.name}"?`, confirmLabel: "Delete", destructive: true }))) return
                        if (notify(await deleteService(s.id), "Service deleted.")) router.refresh()
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function SettingsClient({ units, services }: { units: Unit[]; services: Service[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr] items-start">
      <UnitsCard units={units} />
      <ServicesCard services={services} />
    </div>
  )
}
