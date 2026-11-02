import { UserError } from "./errors"

/** Server-side input validation. Every helper throws a UserError on bad input. */

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function requiredString(value: unknown, label: string, max = 500): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new UserError(`${label} is required.`)
  }
  const v = value.trim()
  if (v.length > max) throw new UserError(`${label} must be at most ${max} characters.`)
  return v
}

export function optionalString(value: unknown, label: string, max = 5000): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") throw new UserError(`${label} is invalid.`)
  const v = value.trim()
  if (!v) return null
  if (v.length > max) throw new UserError(`${label} must be at most ${max} characters.`)
  return v
}

export function positiveInt(value: unknown, label: string, max = 1_000_000): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new UserError(`${label} must be a whole number.`)
  }
  if (value < 1) throw new UserError(`${label} must be at least 1.`)
  if (value > max) throw new UserError(`${label} is too large.`)
  return value
}

/** A non-negative monetary amount, rounded to 2 decimal places. */
export function money(value: unknown, label: string, max = 1_000_000_000): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new UserError(`${label} must be a number.`)
  }
  if (value < 0) throw new UserError(`${label} cannot be negative.`)
  if (value > max) throw new UserError(`${label} is too large.`)
  return round2(value)
}

export function optionalMoney(value: unknown, label: string): number | null {
  if (value === undefined || value === null) return null
  return money(value, label)
}

export function percent(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new UserError(`${label} must be between 0 and 100.`)
  }
  return round2(value)
}

export function dateFrom(value: unknown, label: string): Date {
  if (typeof value !== "string" || !value) throw new UserError(`${label} is required.`)
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw new UserError(`${label} is not a valid date.`)
  return d
}

export function optionalDate(value: unknown, label: string): Date | null {
  if (value === undefined || value === null || value === "") return null
  return dateFrom(value, label)
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new UserError(`${label} is invalid.`)
  }
  return value as T
}

export function requiredId(value: unknown, label = "Record"): string {
  if (typeof value !== "string" || !value.trim()) throw new UserError(`${label} id is missing.`)
  return value
}
