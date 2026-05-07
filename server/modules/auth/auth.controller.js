import { prisma } from '../../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-this';
const COOKIE_EXPIRE = 24 * 60 * 60 * 1000; // 24 hours

const cookieOptions = {
  httpOnly: true,
  secure: true,
  maxAge: COOKIE_EXPIRE,
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
};

// Helper to ensure user has a default workspace
async function ensureDefaultWorkspace(userId, userName) {
  const existingMembership = await prisma.membership.findFirst({
    where: { userId }
  });

  if (!existingMembership) {
    const workspaceName = `${userName || 'My'}'s Workspace`;
    const slug = workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36);
    
    const workspace = await prisma.workspace.create({
      data: {
        name: workspaceName,
        slug,
        memberships: {
          create: {
            userId,
            role: 'OWNER'
          }
        }
      }
    });
    return workspace;
  }
  return null;
}

export const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
    });

    // Create default workspace for new user
    await ensureDefaultWorkspace(user.id, user.name);

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('token', token, cookieOptions);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Auto-migrate legacy user to a default workspace if they have none
    await ensureDefaultWorkspace(user.id, user.name);

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('token', token, cookieOptions);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const logout = (req, res) => {
  res.clearCookie('token', cookieOptions);
  res.json({ message: 'Logged out successfully' });
};

export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getWorkspaces = async (req, res) => {
  try {
    // Ensure default workspace exists even during fetch
    await ensureDefaultWorkspace(req.user.id, null);

    const memberships = await prisma.membership.findMany({
      where: { userId: req.user.id },
      include: { workspace: true },
    });
    // Include the user's role for each workspace (needed by frontend RBAC)
    res.json(memberships.map(m => ({
      ...m.workspace,
      role: m.role,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const createWorkspace = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36);

    const workspace = await prisma.workspace.create({
      data: {
        name,
        slug,
        memberships: {
          create: {
            userId: req.user.id,
            role: 'OWNER',
          },
        },
      },
    });

    res.status(201).json(workspace);
  } catch (error) {
    console.error('Create workspace error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
