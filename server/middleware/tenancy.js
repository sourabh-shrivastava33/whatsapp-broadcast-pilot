import { tenantContext } from '../context.js';
import { prisma } from '../db.js';

export const tenancyMiddleware = async (req, res, next) => {
  // 1. Try to get workspace ID from header
  let workspaceId = req.headers['x-workspace-id'];

  // 2. If no workspaceId in header and user is logged in, try to find their workspaces
  if (!workspaceId && req.user) {
    const membership = await prisma.membership.findFirst({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'asc' },
    });
    if (membership) {
      workspaceId = membership.workspaceId;
    }
  }

  // 3. If we have a workspaceId, verify the user has access
  if (workspaceId && req.user) {
    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: req.user.id,
          workspaceId: workspaceId,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({ error: 'Access denied to this workspace' });
    }
  }

  // 4. Run the request within the tenancy context
  tenantContext.run({ tenantId: workspaceId }, () => {
    // Attach workspaceId to req for convenience
    req.workspaceId = workspaceId;
    next();
  });
};
