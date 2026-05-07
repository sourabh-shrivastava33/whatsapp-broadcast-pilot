/**
 * Membership Controller
 * 
 * Handles team management operations within a workspace:
 * - List members
 * - Invite user by email
 * - Change member role
 * - Remove member
 * 
 * Business rules:
 * - Cannot change or remove the last OWNER
 * - Cannot escalate your own role
 * - Cannot invite someone who is already a member
 * - Only OWNER can transfer ownership
 * 
 * @module modules/membership
 */

import { prisma } from '../../db.js';
import { ROLES, ROLE_HIERARCHY, isRoleAtLeast } from '../../constants/permissions.js';

/**
 * GET /api/members
 * List all members of the current workspace
 */
export const listMembers = async (req, res) => {
  try {
    const memberships = await prisma.membership.findMany({
      where: { workspaceId: req.workspaceId },
      include: {
        user: {
          select: { id: true, email: true, name: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(
      memberships.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        createdAt: m.createdAt,
        user: m.user,
      }))
    );
  } catch (error) {
    console.error('List members error:', error);
    res.status(500).json({ error: 'Failed to list members' });
  }
};

/**
 * POST /api/members/invite
 * Invite a user by email to the workspace
 * Body: { email: string, role?: string }
 */
export const inviteMember = async (req, res) => {
  try {
    const { email, role = ROLES.MEMBER } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate role
    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ error: `Invalid role: ${role}` });
    }

    // Cannot invite as OWNER
    if (role === ROLES.OWNER) {
      return res.status(400).json({ error: 'Cannot directly invite as OWNER. Use role transfer instead.' });
    }

    // Check the inviter's role — must be higher than or equal to the role they're assigning
    const inviterRole = req.membership.role;
    if (!isRoleAtLeast(inviterRole, role) && inviterRole !== ROLES.OWNER) {
      return res.status(403).json({ error: 'Cannot assign a role higher than your own' });
    }

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'No user found with that email. They must register first.' });
    }

    // Check if already a member
    const existing = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: req.workspaceId,
        },
      },
    });

    if (existing) {
      return res.status(409).json({ error: 'User is already a member of this workspace' });
    }

    // Create membership
    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        workspaceId: req.workspaceId,
        role,
      },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    res.status(201).json({
      id: membership.id,
      userId: membership.userId,
      role: membership.role,
      user: membership.user,
    });
  } catch (error) {
    console.error('Invite member error:', error);
    res.status(500).json({ error: 'Failed to invite member' });
  }
};

/**
 * PATCH /api/members/:id/role
 * Change a member's role
 * Body: { role: string }
 */
export const changeMemberRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role: newRole } = req.body;

    if (!newRole || !Object.values(ROLES).includes(newRole)) {
      return res.status(400).json({ error: `Invalid role: ${newRole}` });
    }

    // Find the target membership
    const target = await prisma.membership.findUnique({ where: { id } });
    if (!target || target.workspaceId !== req.workspaceId) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Cannot change your own role
    if (target.userId === req.user.id) {
      return res.status(403).json({ error: 'Cannot change your own role' });
    }

    // Cannot modify an OWNER unless you're also an OWNER
    if (target.role === ROLES.OWNER && req.membership.role !== ROLES.OWNER) {
      return res.status(403).json({ error: 'Only an OWNER can modify another OWNER' });
    }

    // Cannot assign OWNER role (use transfer instead)
    if (newRole === ROLES.OWNER) {
      return res.status(400).json({ error: 'Cannot assign OWNER role directly. Use ownership transfer.' });
    }

    // Cannot demote the last OWNER
    if (target.role === ROLES.OWNER) {
      const ownerCount = await prisma.membership.count({
        where: { workspaceId: req.workspaceId, role: ROLES.OWNER },
      });
      if (ownerCount <= 1) {
        return res.status(400).json({ error: 'Cannot demote the last workspace OWNER' });
      }
    }

    const updated = await prisma.membership.update({
      where: { id },
      data: { role: newRole },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    res.json({
      id: updated.id,
      userId: updated.userId,
      role: updated.role,
      user: updated.user,
    });
  } catch (error) {
    console.error('Change role error:', error);
    res.status(500).json({ error: 'Failed to change role' });
  }
};

/**
 * DELETE /api/members/:id
 * Remove a member from the workspace
 */
export const removeMember = async (req, res) => {
  try {
    const { id } = req.params;

    const target = await prisma.membership.findUnique({ where: { id } });
    if (!target || target.workspaceId !== req.workspaceId) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Cannot remove yourself
    if (target.userId === req.user.id) {
      return res.status(403).json({ error: 'Cannot remove yourself. Use "Leave Workspace" instead.' });
    }

    // Cannot remove an OWNER unless you're also an OWNER
    if (target.role === ROLES.OWNER && req.membership.role !== ROLES.OWNER) {
      return res.status(403).json({ error: 'Only an OWNER can remove another OWNER' });
    }

    // Cannot remove the last OWNER
    if (target.role === ROLES.OWNER) {
      const ownerCount = await prisma.membership.count({
        where: { workspaceId: req.workspaceId, role: ROLES.OWNER },
      });
      if (ownerCount <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last workspace OWNER' });
      }
    }

    await prisma.membership.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
};
