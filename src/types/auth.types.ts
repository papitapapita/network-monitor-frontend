export type UserRole = 'VENDOR' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

/** A finished sign-in. `trustedBrowserToken` also arrives as a cookie, which is what the browser uses. */
export interface SessionDTO {
  token: string;
  user: AuthUser;
  trustedBrowserToken?: string;
}

/** 'setup' the first time an account signs in, 'verify' every time after. */
export type TwoFactorStep = 'setup' | 'verify';

/** A right password: the session comes from the two-factor step this names (IDN-166). */
export interface LoginChallengeDTO {
  twoFactor: TwoFactorStep;
  /** Bearer token for the two-factor routes only; 5 minutes. */
  challengeToken: string;
}

/** A remembered browser skips the code and gets the session straight away (IDN-171). */
export type LoginResponseDTO = SessionDTO | LoginChallengeDTO;

export interface TwoFactorSetupDTO {
  /** Base32, for typing into the app by hand. */
  secret: string;
  /** `otpauth://totp/...` — rendered as a QR code. */
  otpauthUri: string;
}

export interface TwoFactorConfirmDTO extends SessionDTO {
  /** Shown once, now; each works a single time. */
  recoveryCodes: string[];
}

/** Exactly one of `code` and `recoveryCode`. */
export interface TwoFactorVerifyDTO {
  code?: string;
  recoveryCode?: string;
  rememberBrowser?: boolean;
}
