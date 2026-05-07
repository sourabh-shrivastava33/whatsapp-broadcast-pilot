import express from 'express';
import { listMembers, inviteMember, changeMemberRole, removeMember } from './membership.controller.js';
import { requirePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../../constants/permissions.js';

const router = express.Router();

// All routes require auth + tenancy (applied upstream in index.js)

router.get('/', requirePermission(PERMISSIONS.MEMBERS_VIEW), listMembers);
router.post('/invite', requirePermission(PERMISSIONS.MEMBERS_MANAGE), inviteMember);
router.patch('/:id/role', requirePermission(PERMISSIONS.MEMBERS_MANAGE), changeMemberRole);
router.delete('/:id', requirePermission(PERMISSIONS.MEMBERS_MANAGE), removeMember);

export default router;
