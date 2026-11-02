import { describe, expect, it } from "vitest"
import { digitsOnly } from "@/lib/whatsapp/allowlist"

describe("digitsOnly", () => {
  it("strips everything but digits", () => {
    expect(digitsOnly("+91 98765-43210")).toBe("919876543210")
    expect(digitsOnly("919876543210")).toBe("919876543210")
    expect(digitsOnly("(91) 9876 543 210")).toBe("919876543210")
  })
})
