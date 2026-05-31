/**
 * Database Seed Script
 *
 * Seeds the Setting table with default company configuration.
 * Run via: bunx prisma db seed
 * Or via: curl -X POST https://your-app.vercel.app/api/setup-db
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''

const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...')

  const settings = [
    { key: 'company_name', value: 'หจก.เผ่าปัญญา ทรานสปอร์ต' },
    { key: 'company_phone', value: '089-999-9999' },
    { key: 'company_address', value: 'กรุงเทพมหานคร' },
    { key: 'promptpay_id', value: '0899999999' },
    { key: 'quotation_prefix', value: 'QT' },
    { key: 'quotation_start_number', value: '1' },
    { key: 'oil_reference_name', value: 'ปตท.' },
  ]

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: { key: setting.key, value: setting.value },
    })
    console.log(`  ✓ Setting: ${setting.key} = ${setting.value}`)
  }

  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
