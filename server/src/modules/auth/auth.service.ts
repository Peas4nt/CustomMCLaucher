import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database.js';
import { AuthTokens, UserPayload } from '../../types/index.js';

export class AuthService {
  private jwtSecret: string;
  private jwtExpiresIn: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'super-secret-cmcl-jwt-key-change-in-production';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '30d';
  }

  public generateToken(user: UserPayload): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.status,
      },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
    );
  }

  public async hasAdminUser(): Promise<boolean> {
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN', status: 'ACTIVE' },
    });
    return adminCount > 0;
  }

  public async setupFirstAdmin(email: string, username: string, passwordPlain: string): Promise<AuthTokens> {
    const hasAdmin = await this.hasAdminUser();
    if (hasAdmin) {
      throw new Error('An administrator account already exists. Setup route is disabled.');
    }

    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();

    const existingEmail = await prisma.user.findUnique({ where: { email: trimmedEmail } });
    if (existingEmail) {
      throw new Error('An account with this email already exists');
    }

    const existingUsername = await prisma.user.findUnique({ where: { username: trimmedUsername } });
    if (existingUsername) {
      throw new Error('This username/nickname is already taken');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordPlain, salt);

    const admin = await prisma.user.create({
      data: {
        email: trimmedEmail,
        username: trimmedUsername,
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    const userPayload: UserPayload = {
      id: admin.id,
      email: admin.email,
      username: admin.username,
      role: 'ADMIN',
      status: 'ACTIVE',
    };

    const token = this.generateToken(userPayload);

    return {
      accessToken: token,
      expiresIn: this.jwtExpiresIn,
      user: userPayload,
    };
  }

  public async checkNicknameAvailable(username: string): Promise<boolean> {
    const trimmed = username.trim();
    if (!trimmed) return false;
    const existing = await prisma.user.findUnique({
      where: { username: trimmed },
    });
    return !existing;
  }

  public async register(email: string, username: string, passwordPlain: string): Promise<AuthTokens> {
    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();

    const existingEmail = await prisma.user.findUnique({ where: { email: trimmedEmail } });
    if (existingEmail) {
      throw new Error('An account with this email already exists');
    }

    const existingUsername = await prisma.user.findUnique({ where: { username: trimmedUsername } });
    if (existingUsername) {
      throw new Error('This username/nickname is already taken');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordPlain, salt);

    // Clients registered via launcher MUST NEVER be granted admin role automatically
    const user = await prisma.user.create({
      data: {
        email: trimmedEmail,
        username: trimmedUsername,
        passwordHash,
        role: 'USER',
        status: 'ACTIVE',
      },
    });

    const userPayload: UserPayload = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: 'USER',
      status: 'ACTIVE',
    };

    const token = this.generateToken(userPayload);

    return {
      accessToken: token,
      expiresIn: this.jwtExpiresIn,
      user: userPayload,
    };
  }

  public async login(identifier: string, passwordPlain: string): Promise<AuthTokens> {
    const trimmed = identifier.trim();
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: trimmed }, { username: trimmed }],
      },
    });

    if (!user) {
      throw new Error('Invalid email/nickname or password');
    }

    if (user.status === 'DEACTIVATED') {
      throw new Error('This account has been deactivated. Please contact an administrator.');
    }

    const isMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid email/nickname or password');
    }

    const userPayload: UserPayload = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role as 'ADMIN' | 'USER',
      status: user.status as 'ACTIVE' | 'DEACTIVATED',
    };

    const token = this.generateToken(userPayload);

    return {
      accessToken: token,
      expiresIn: this.jwtExpiresIn,
      user: userPayload,
    };
  }

  public async getUserById(id: string): Promise<UserPayload | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role as 'ADMIN' | 'USER',
      status: user.status as 'ACTIVE' | 'DEACTIVATED',
    };
  }

  public async listUsers(statusFilter?: 'ACTIVE' | 'DEACTIVATED'): Promise<UserPayload[]> {
    const whereClause: any = {};
    if (statusFilter) {
      whereClause.status = statusFilter;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      role: u.role as 'ADMIN' | 'USER',
      status: u.status as 'ACTIVE' | 'DEACTIVATED',
    }));
  }

  public async updateUser(
    id: string,
    data: { email?: string; username?: string; role?: 'ADMIN' | 'USER'; status?: 'ACTIVE' | 'DEACTIVATED'; password?: string }
  ): Promise<UserPayload> {
    const updateData: any = {};
    if (data.email) updateData.email = data.email.trim();
    if (data.username) updateData.username = data.username.trim();
    if (data.role) updateData.role = data.role;
    if (data.status) updateData.status = data.status;
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(data.password, salt);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    return {
      id: updated.id,
      email: updated.email,
      username: updated.username,
      role: updated.role as 'ADMIN' | 'USER',
      status: updated.status as 'ACTIVE' | 'DEACTIVATED',
    };
  }

  public async softDeleteUser(id: string): Promise<UserPayload> {
    const updated = await prisma.user.update({
      where: { id },
      data: { status: 'DEACTIVATED' },
    });

    return {
      id: updated.id,
      email: updated.email,
      username: updated.username,
      role: updated.role as 'ADMIN' | 'USER',
      status: updated.status as 'ACTIVE' | 'DEACTIVATED',
    };
  }

  public async restoreUser(id: string): Promise<UserPayload> {
    const updated = await prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    return {
      id: updated.id,
      email: updated.email,
      username: updated.username,
      role: updated.role as 'ADMIN' | 'USER',
      status: updated.status as 'ACTIVE' | 'DEACTIVATED',
    };
  }

  public async createUser(data: {
    email: string;
    username: string;
    passwordPlain: string;
    role?: 'ADMIN' | 'USER';
  }): Promise<UserPayload> {
    const trimmedEmail = data.email.trim();
    const trimmedUsername = data.username.trim();

    const existingEmail = await prisma.user.findUnique({ where: { email: trimmedEmail } });
    if (existingEmail) {
      throw new Error('An account with this email already exists');
    }

    const existingUsername = await prisma.user.findUnique({ where: { username: trimmedUsername } });
    if (existingUsername) {
      throw new Error('This username is already taken');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.passwordPlain, salt);

    const user = await prisma.user.create({
      data: {
        email: trimmedEmail,
        username: trimmedUsername,
        passwordHash,
        role: data.role || 'USER',
        status: 'ACTIVE',
      },
    });

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role as 'ADMIN' | 'USER',
      status: user.status as 'ACTIVE' | 'DEACTIVATED',
    };
  }

  public async deleteUserPermanently(id: string): Promise<void> {
    await prisma.user.delete({ where: { id } });
  }
}

export const authService = new AuthService();
