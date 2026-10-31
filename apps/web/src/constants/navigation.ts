import { Role } from '@/constants/roles';
import { ROUTES } from '@/constants/routes';
export const NAVIGATION = [{ label: 'Overview', href: ROUTES.DASHBOARD, allowedRoles: [Role.ADMIN, Role.MANAGER, Role.USER] }] as const;
