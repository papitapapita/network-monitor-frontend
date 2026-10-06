import { SetPasswordPage } from '@/components/auth/SetPasswordPage';

/** The link in an invitation email: `/accept-invitation#token=…`, good for seven days (IDN-184). */
export default function AcceptInvitationPage() {
  return <SetPasswordPage mode="invitation" />;
}
