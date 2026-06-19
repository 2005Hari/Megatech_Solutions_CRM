import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function calculateDaysPending(date: Date) {
  const diffTime = Math.abs(new Date().getTime() - new Date(date).getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
  return diffDays;
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date))
}
