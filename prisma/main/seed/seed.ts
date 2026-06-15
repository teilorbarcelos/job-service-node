import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from "@prisma/client";
import { Pool } from 'pg';
import { FEATURES, ROLES } from "./RolesData";

const pool = new Pool({ connectionString: process.env.DATABASE_URL || '' });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const key in FEATURES) {
    const feature = FEATURES[key as keyof typeof FEATURES];
    await prisma.feature.upsert({
      where: { id: feature.key },
      update: {
        name: feature.name,
        description: feature.description,
      },
      create: {
        id: feature.key,
        name: feature.name,
        description: feature.description,
      },
    });
  }

  for (const key in ROLES) {
    const role = ROLES[key as keyof typeof ROLES];
    const createdRole = await prisma.role.upsert({
      where: { id: role.key },
      update: {
        name: role.name,
        description: role.description,
      },
      create: {
        id: role.key,
        name: role.name,
        description: role.description,
      },
    });

    for (const featureRole of role.feature) {
      await prisma.roleFeature.upsert({
        where: {
          id_feature_id_role: {
            id_feature: featureRole.key,
            id_role: createdRole.id,
          },
        },
        update: {
          create: featureRole.create,
          view: featureRole.view,
          delete: featureRole.delete,
          activate: featureRole.activate,
        },
        create: {
          id_feature: featureRole.key,
          id_role: createdRole.id,
          create: featureRole.create,
          view: featureRole.view,
          delete: featureRole.delete,
          activate: featureRole.activate,
        },
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
