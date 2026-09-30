export type UserRole = 'VENDOR' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface LoginResponseDTO {
  token: string;
  user: AuthUser;
}
