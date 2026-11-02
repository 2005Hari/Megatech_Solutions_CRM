/**
 * Starter product catalogue, seeded into the `Product` table (see
 * prisma/seed.ts) the first time the database is set up. Products are
 * managed from Settings after that - this file is seed data, not the live
 * catalogue; the builder and the WhatsApp bot both read from the database.
 */
export type ProductOption = { brand: string; desc: string; rate: number }

export const PRODUCTS: ProductOption[] = [
  { brand: "CP Plus", desc: "2MP Dome Camera (CP-UNC-DA21L3)", rate: 1200 },
  { brand: "CP Plus", desc: "4 Channel NVR (CP-UNR-4K411-V2)", rate: 3500 },
  { brand: "Hikvision", desc: "2MP Bullet Camera (DS-2CE16D0T-IRP)", rate: 1100 },
  { brand: "Hikvision", desc: "8 Channel DVR (DS-7208HGHI-F1)", rate: 4200 },
  { brand: "Dell", desc: "OptiPlex 3090 Tower Desktop (Core i5, 8GB, 1TB)", rate: 45000 },
  { brand: "Dell", desc: '24" Monitor (E2422H)', rate: 11000 },
  { brand: "HP", desc: "ProDesk 400 G7 Microtower (Core i3, 8GB, 512GB SSD)", rate: 38000 },
  { brand: "D-Link", desc: "8-Port Gigabit Switch (DGS-1008A)", rate: 1500 },
  { brand: "D-Link", desc: "Cat6 UTP Cable Roll (305m)", rate: 2500 },
  { brand: "TP-Link", desc: "Archer C6 Gigabit Router", rate: 2200 },
  { brand: "TP-Link", desc: "16-Port Switch (TL-SG1016D)", rate: 3500 },
]
