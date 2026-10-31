import type { ReactNode } from 'react';
import type { RoleDto } from '@odoo/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/hooks/auth/use-auth';
interface RoleGuardProps { roles: readonly RoleDto[]; children: ReactNode }
export function RoleGuard({ roles, children }: RoleGuardProps): React.JSX.Element {
  const { hasRole } = useAuth();
  if (!hasRole(...roles)) return <Alert><AlertTitle>Access restricted</AlertTitle><AlertDescription>This area isn’t available for your role.</AlertDescription></Alert>;
  return <>{children}</>;
}
