import { SetPasswordPage } from '@/components/auth/SetPasswordPage';

/** The link in a password reset email: `/reset-password#token=…` (IDN-182). */
export default function ResetPasswordPage() {
  return <SetPasswordPage mode="reset" />;
}
