import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Clear existing
  await prisma.statusHistory.deleteMany()
  await prisma.supplierPOItem.deleteMany()
  await prisma.supplierPO.deleteMany()
  await prisma.customerPOItem.deleteMany()
  await prisma.customerPO.deleteMany()
  await prisma.quotationItem.deleteMany()
  await prisma.quotation.deleteMany()
  await prisma.supplier.deleteMany()
  await prisma.customer.deleteMany()

  // Create Customers
  const customer1 = await prisma.customer.create({
    data: { name: 'Rajan Enterprises', contactDetails: 'contact@rajan.com' }
  })
  const customer2 = await prisma.customer.create({
    data: { name: 'Sharma Industries', contactDetails: 'info@sharma.com' }
  })

  // Create Suppliers
  const supplier1 = await prisma.supplier.create({
    data: { name: 'National Wire Co.', contactDetails: 'sales@nationalwire.com' }
  })

  // Create Quotations
  const q1 = await prisma.quotation.create({
    data: {
      refNo: 'QT-2024-001',
      date: new Date('2024-11-01'),
      validUntil: new Date('2024-11-15'),
      status: 'Won',
      customerId: customer1.id,
      notes: 'Bulk order for Q4',
      items: {
        create: [
          { productName: 'Copper Wire 2.5mm', qty: 500, unit: 'kg', sellPrice: 520 },
          { productName: 'PVC Conduit 25mm', qty: 200, unit: 'pcs', sellPrice: 85 }
        ]
      }
    }
  })

  // Create Customer PO
  const cpo1 = await prisma.customerPO.create({
    data: {
      refNo: 'CPO-2024-001',
      date: new Date('2024-11-05'),
      deliveryDate: new Date('2024-11-20'),
      status: 'Open',
      quotationId: q1.id,
      customerId: customer1.id,
      notes: '50% advance received',
      items: {
        create: [
          { productName: 'Copper Wire 2.5mm', qty: 500, unit: 'kg', sellPrice: 520 },
          { productName: 'PVC Conduit 25mm', qty: 200, unit: 'pcs', sellPrice: 85 }
        ]
      }
    }
  })

  // Create Supplier PO
  await prisma.supplierPO.create({
    data: {
      refNo: 'SPO-2024-001',
      date: new Date('2024-11-06'),
      deliveryDate: new Date('2024-11-18'),
      status: 'Sent',
      cpoId: cpo1.id,
      supplierId: supplier1.id,
      items: {
        create: [
          { productName: 'Copper Wire 2.5mm', qty: 500, unit: 'kg', buyPrice: 420 },
          { productName: 'PVC Conduit 25mm', qty: 200, unit: 'pcs', buyPrice: 62 }
        ]
      },
      statusHistory: {
        create: [
          { status: 'Draft', createdAt: new Date('2024-11-05') },
          { status: 'Sent', createdAt: new Date('2024-11-06') }
        ]
      }
    }
  })

  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
