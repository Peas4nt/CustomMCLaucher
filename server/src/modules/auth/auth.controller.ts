import { Request, Response } from 'express';
import { authService } from './auth.service.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

export class AuthController {
  public async getAdminStatus(_req: Request, res: Response): Promise<void> {
    try {
      const hasAdmin = await authService.hasAdminUser();
      res.json({ hasAdmin });
    } catch (error: any) {
      console.error('[AuthController] Get admin status error:', error);
      res.status(500).json({ error: 'Failed to query admin status' });
    }
  }

  public async setupFirstAdmin(req: Request, res: Response): Promise<void> {
    try {
      const { email, username, password } = req.body;
      if (!email || !username || !password) {
        res.status(400).json({ error: 'Email, username, and password are required' });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters' });
        return;
      }

      const result = await authService.setupFirstAdmin(email, username, password);
      res.status(201).json(result);
    } catch (error: any) {
      console.error('[AuthController] Setup first admin error:', error);
      res.status(400).json({ error: error.message || 'Failed to setup first admin account' });
    }
  }

  public async checkNickname(req: Request, res: Response): Promise<void> {
    try {
      const username = (req.query.username as string) || req.body?.username;
      if (!username) {
        res.status(400).json({ error: 'Username parameter is required' });
        return;
      }

      const available = await authService.checkNicknameAvailable(username);
      res.json({ username, available });
    } catch (error: any) {
      console.error('[AuthController] Check nickname error:', error);
      res.status(500).json({ error: 'Failed to check nickname availability' });
    }
  }

  public async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, username, password } = req.body;
      if (!email || !username || !password) {
        res.status(400).json({ error: 'Email, username, and password are required' });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters' });
        return;
      }

      const result = await authService.register(email, username, password);
      res.status(201).json(result);
    } catch (error: any) {
      console.error('[AuthController] Registration error:', error);
      res.status(400).json({ error: error.message || 'Registration failed' });
    }
  }

  public async login(req: Request, res: Response): Promise<void> {
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password) {
        res.status(400).json({ error: 'Email/Nickname and password are required' });
        return;
      }

      const result = await authService.login(identifier, password);
      res.json(result);
    } catch (error: any) {
      console.error('[AuthController] Login error:', error);
      res.status(401).json({ error: error.message || 'Invalid credentials' });
    }
  }

  public async me(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const user = await authService.getUserById(req.user.id);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json(user);
    } catch (error) {
      console.error('[AuthController] Me endpoint error:', error);
      res.status(500).json({ error: 'Failed to retrieve user profile' });
    }
  }

  public async listUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const status = req.query.status as 'ACTIVE' | 'DEACTIVATED' | undefined;
      const users = await authService.listUsers(status);
      res.json(users);
    } catch (error: any) {
      console.error('[AuthController] List users error:', error);
      res.status(500).json({ error: 'Failed to retrieve users' });
    }
  }

  public async createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { email, username, password, role } = req.body;
      if (!email || !username || !password) {
        res.status(400).json({ error: 'Email, username, and password are required' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters' });
        return;
      }

      const user = await authService.createUser({
        email,
        username,
        passwordPlain: password,
        role: role || 'USER',
      });
      res.status(201).json(user);
    } catch (error: any) {
      console.error('[AuthController] Create user error:', error);
      res.status(400).json({ error: error.message || 'Failed to create user' });
    }
  }

  public async updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { email, username, role, status, password } = req.body;

      const updated = await authService.updateUser(id, { email, username, role, status, password });
      res.json(updated);
    } catch (error: any) {
      console.error('[AuthController] Update user error:', error);
      res.status(400).json({ error: error.message || 'Failed to update user' });
    }
  }

  public async deleteUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const permanent = req.query.permanent === 'true';

      if (permanent) {
        await authService.deleteUserPermanently(id);
        res.json({ message: 'User permanently deleted' });
      } else {
        const result = await authService.softDeleteUser(id);
        res.json({ message: 'User deactivated (soft-deleted)', user: result });
      }
    } catch (error: any) {
      console.error('[AuthController] Delete user error:', error);
      res.status(400).json({ error: error.message || 'Failed to delete user' });
    }
  }

  public async restoreUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await authService.restoreUser(id);
      res.json({ message: 'User reactivated', user: result });
    } catch (error: any) {
      console.error('[AuthController] Restore user error:', error);
      res.status(400).json({ error: error.message || 'Failed to restore user' });
    }
  }
}

export const authController = new AuthController();
