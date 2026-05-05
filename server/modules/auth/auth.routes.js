import express from 'express';
import { register, login, logout, getMe, getWorkspaces, createWorkspace } from './auth.controller.js';
import { protect } from './auth.middleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.get('/workspaces', protect, getWorkspaces);
router.post('/workspaces', protect, createWorkspace);

export default router;
