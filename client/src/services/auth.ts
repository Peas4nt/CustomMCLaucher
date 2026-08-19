import { AuthState, UserProfile } from '../types';

const TOKEN_STORAGE_KEY = 'cmcl_auth_token';
const USER_STORAGE_KEY = 'cmcl_user_profile';

class AuthService {
  public getStoredToken(): string | null {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  public getStoredUser(): UserProfile | null {
    const data = localStorage.getItem(USER_STORAGE_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  public getInitialState(): AuthState {
    const token = this.getStoredToken();
    const user = this.getStoredUser();

    if (token && user) {
      return {
        token,
        user,
        isAuthenticated: true,
      };
    }

    return {
      token: null,
      user: null,
      isAuthenticated: false,
    };
  }

  public setSession(token: string, user: UserProfile): void {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }

  public clearSession(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

export const authService = new AuthService();
