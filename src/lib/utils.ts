import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * All dates are shown in Indian time. Pinning the zone also keeps server
 * (UTC) and browser renders identical, which avoids hydration mismatches.
 */
const TIME_ZONE = "Asia/Kolkata"

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Like formatCurrency but keeps paise, for invoices-style figures. */
export function formatCurrencyExact(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function calculateDaysPending(date: Date) {
  const diffTime = Math.abs(new Date().getTime() - new Date(date).getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: TIME_ZONE,
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(date))
}

/**
 * Value for an <input type="date"> (YYYY-MM-DD) in Indian time.
 * `toISOString().split("T")[0]` is wrong here: it uses UTC, so between
 * midnight and 05:30 IST it yields yesterday's date.
 */
export function toDateInput(date: Date | string = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(date))
}
