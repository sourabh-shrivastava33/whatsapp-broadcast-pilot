import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";

if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: '../.env' });
}

if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  console.log(`📡 Database attempt: ${url.protocol}//${url.username}@${url.host}${url.pathname}`);
}

import { getTenantId } from "./context.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const basePrisma = new PrismaClient({ adapter });

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        // Models that are NOT tenant-scoped
        const globalModels = ['Workspace', 'User', 'Membership', 'AuditLog', 'SystemConfig'];
        
        if (globalModels.includes(model)) {
          return query(args);
        }

        const tenantId = getTenantId();
        
        // Operations that should be scoped
        const scopedOperations = [
          'findFirst', 'findFirstOrThrow', 'findMany', 'findUnique', 'findUniqueOrThrow',
          'count', 'aggregate', 'groupBy',
          'update', 'updateMany', 'upsert', 'delete', 'deleteMany'
        ];

        if (scopedOperations.includes(operation) && tenantId) {
          args.where = { ...args.where, workspaceId: tenantId };
        }
        
        // Auto-assign workspaceId on creation
        if ((operation === 'create' || operation === 'createMany') && tenantId) {
          if (operation === 'create') {
            args.data = { ...args.data, workspaceId: tenantId };
          } else if (operation === 'createMany') {
            if (Array.isArray(args.data)) {
              args.data = args.data.map(item => ({ ...item, workspaceId: tenantId }));
            } else {
              args.data = { ...args.data, workspaceId: tenantId };
            }
          }
        }

        return query(args);
      },
    },
  },
});
