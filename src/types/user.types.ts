import type { UserRole } from './auth.types';

/** A staff account (IDN-140). There is no delete: an account is disabled instead. */
export interface UserAccountDTO {
  id: string;
  email: string;
  role: UserRole;
  disabled: boolean;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** VENDOR is set up from the server's environment (IDN-011) and cannot be given through the API. */
export type AssignableRole = Exclude<UserRole, 'VENDOR'>;

export interface CreateUserDTO {
  email: string;
  password: string;
  role: AssignableRole;
}

/** At least one field. Every change but re-enabling signs the user out everywhere. */
export interface UpdateUserDTO {
  role?: AssignableRole;
  disabled?: boolean;
  /** A reset — no current password needed. */
  password?: string;
}

export interface ChangeMyPasswordDTO {
  currentPassword: string;
  newPassword: string;
}

/** NOT-131: what the retention sweep removed. */
export interface DataPurgeResultDTO {
  pingResultsDeleted: number;
  alertsDeleted: number;
  wirelessSnapshotsDeleted: number;
  wirelessAlertRecordsDeleted: number;
}
