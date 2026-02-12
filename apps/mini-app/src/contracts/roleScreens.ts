export type RoleTabId = 'dashboard' | 'tasks' | 'plan_fact' | 'modules' | 'project';

export interface RoleTabDefinition {
  path: string;
  icon: string;
  label: string;
}

export interface RoleAccessContract {
  defaultRoute: string;
  allowedRoutes: string[];
  tabs: RoleTabId[];
}

export interface RoleScreenContract {
  version: string;
  tabs: Record<RoleTabId, RoleTabDefinition>;
  roles: Record<string, RoleAccessContract>;
}

const FALLBACK_CONTRACT: RoleScreenContract = {
  version: 'fallback',
  tabs: {
    dashboard: { path: '/', icon: '📊', label: 'Сводка' },
    tasks: { path: '/tasks', icon: '📋', label: 'Задачи' },
    plan_fact: { path: '/plan-fact', icon: '📝', label: 'План-Факт' },
    modules: { path: '/modules', icon: '📦', label: 'Модули' },
    project: { path: '/project', icon: '🏗', label: 'Объект' },
  },
  roles: {
    viewer: {
      defaultRoute: '/',
      allowedRoutes: ['/', '/project'],
      tabs: ['dashboard', 'project'],
    },
    admin: {
      defaultRoute: '/',
      allowedRoutes: ['/', '/tasks', '/plan-fact', '/modules', '/project'],
      tabs: ['dashboard', 'tasks', 'plan_fact', 'modules', 'project'],
    },
  },
};

let contractPromise: Promise<RoleScreenContract> | null = null;

export async function loadRoleScreenContract(): Promise<RoleScreenContract> {
  if (!contractPromise) {
    contractPromise = fetch('/contracts/role-screen-contracts.json')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch role screen contract: ${response.status}`);
        }
        return response.json() as Promise<RoleScreenContract>;
      })
      .catch((_error) => FALLBACK_CONTRACT);
  }

  return contractPromise;
}

export function extractRoleSystemName(user: any): string {
  return (
    user?.user_roles?.[0]?.roles?.system_name ||
    user?.user_roles?.[0]?.role?.system_name ||
    'viewer'
  );
}

export function resolveRoleAccess(
  contract: RoleScreenContract,
  roleSystemName: string,
): RoleAccessContract {
  return (
    contract.roles[roleSystemName] ||
    contract.roles.viewer ||
    FALLBACK_CONTRACT.roles.viewer
  );
}

export function getTabsForRole(
  contract: RoleScreenContract,
  roleAccess: RoleAccessContract,
): RoleTabDefinition[] {
  return roleAccess.tabs
    .map((tabId) => contract.tabs[tabId])
    .filter((tab): tab is RoleTabDefinition => Boolean(tab));
}

export function isRouteAllowed(roleAccess: RoleAccessContract, pathname: string): boolean {
  return roleAccess.allowedRoutes.includes(pathname);
}
