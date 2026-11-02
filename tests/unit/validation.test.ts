import { describe, expect, it } from "vitest"
import { UserError } from "@/lib/errors"
import {
  dateFrom,
  money,
  oneOf,
  optionalDate,
  optionalMoney,
  optionalString,
  percent,
  positiveInt,
  requiredString,
  round2,
} from "@/lib/validation"

describe("validation", () => {
  it("rounds money to 2dp", () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(10.239)).toBe(10.24)
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })

  it("requiredString trims and enforces presence/length", () => {
    expect(requiredString("  hi ", "Name")).toBe("hi")
    expect(() => requiredString("   ", "Name")).toThrow(UserError)
    expect(() => requiredString(undefined, "Name")).toThrow("Name is required")
    expect(() => requiredString("x".repeat(11), "Name", 10)).toThrow(/at most 10/)
  })

  it("optionalString returns null for blank", () => {
    expect(optionalString("", "x")).toBeNull()
    expect(optionalString(undefined, "x")).toBeNull()
    expect(optionalString(" a ", "x")).toBe("a")
    expect(() => optionalString(5, "x")).toThrow(UserError)
  })

  it("positiveInt rejects fractions, zero, negatives, NaN", () => {
    expect(positiveInt(3, "Qty")).toBe(3)
    for (const bad of [1.5, 0, -2, NaN, Infinity, "3", null]) {
      expect(() => positiveInt(bad, "Qty")).toThrow(UserError)
    }
  })

  it("money rejects negatives and non-finite, rounds", () => {
    expect(money(12.345, "Rate")).toBe(12.35)
    expect(() => money(-1, "Rate")).toThrow(/negative/)
    expect(() => money(NaN, "Rate")).toThrow(UserError)
    expect(() => money("5", "Rate")).toThrow(UserError)
  })

  it("optionalMoney passes null/undefined through", () => {
    expect(optionalMoney(undefined, "x")).toBeNull()
    expect(optionalMoney(null, "x")).toBeNull()
    expect(optionalMoney(0, "x")).toBe(0)
  })

  it("percent allows 0 (a valid GST rate) and bounds at 100", () => {
    expect(percent(0, "GST")).toBe(0)
    expect(percent(18, "GST")).toBe(18)
    expect(() => percent(101, "GST")).toThrow(UserError)
    expect(() => percent(-1, "GST")).toThrow(UserError)
  })

  it("dates", () => {
    expect(dateFrom("2026-11-02", "Date").toISOString()).toBe("2026-11-02T00:00:00.000Z")
    expect(() => dateFrom("not a date", "Date")).toThrow(/not a valid date/)
    expect(() => dateFrom("", "Date")).toThrow(/required/)
    expect(optionalDate("", "d")).toBeNull()
    expect(optionalDate(undefined, "d")).toBeNull()
  })

  it("oneOf", () => {
    expect(oneOf("a", ["a", "b"] as const, "X")).toBe("a")
    expect(() => oneOf("c", ["a", "b"] as const, "X")).toThrow(UserError)
  })
})
