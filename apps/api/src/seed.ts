import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';
import { seedDemo } from './demo/demo.seed';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const r = await seedDemo(prisma);
    console.log('\n✅ Seed complete.');
    console.log(`   users=${r.users}  tickets=${r.tickets} (completed=${r.completed}, wip=${r.wip})`);
    console.log(
      `   activity=${r.activity}  comments=${r.comments}  attachments=${r.attachments}  notifications=${r.notifications}`,
    );
    console.log(`   team "${r.teamName}"  id=${r.teamId}`);
    console.log(`\n   🔑 Demo login →  ${r.email}  /  ${r.password}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
