type FeatureProps = {
  key: string;
  name: string;
  description: string;
};

const createFeatureRole = (
  key: string,
  create: boolean,
  view: boolean,
  deleteVal: boolean,
  activate: boolean
) => {
  return {
    key,
    create,
    view,
    delete: deleteVal,
    activate,
  };
};

export const FEATURES = {
  dashboard: {
    key: 'dashboard',
    name: 'Dashboard',
    description: 'Visualizar indicadores e métricas do sistema',
  },
  user: {
    key: 'user',
    name: 'Usuários',
    description: 'Gerenciar usuários e acessos',
  },
  role: {
    key: 'role',
    name: 'Perfis de Acesso',
    description: 'Gerenciar cargos e permissões',
  },
  product: {
    key: 'product',
    name: 'Produtos',
    description: 'Gerenciar catálogo de produtos',
  },
};

export const ROLES = {
  administrator: {
    name: 'Administrador',
    key: 'administrator',
    description: 'Acesso total ao sistema',
    feature: [
      createFeatureRole(FEATURES.dashboard.key, true, true, true, true),
      createFeatureRole(FEATURES.user.key, true, true, true, true),
      createFeatureRole(FEATURES.role.key, true, true, true, true),
      createFeatureRole(FEATURES.product.key, true, true, true, true),
    ],
  },
  manager: {
    name: 'Gerente',
    key: 'manager',
    description: 'Gerente operacional',
    feature: [
      createFeatureRole(FEATURES.dashboard.key, true, true, true, true),
      createFeatureRole(FEATURES.user.key, true, true, false, false),
      createFeatureRole(FEATURES.role.key, false, true, false, false),
      createFeatureRole(FEATURES.product.key, true, true, true, true),
    ],
  },
  operator: {
    name: 'Operador',
    key: 'operator',
    description: 'Operador de sistema',
    feature: [
      createFeatureRole(FEATURES.dashboard.key, true, true, true, true),
      createFeatureRole(FEATURES.user.key, false, false, false, false),
      createFeatureRole(FEATURES.role.key, false, false, false, false),
      createFeatureRole(FEATURES.product.key, false, true, false, false),
    ],
  },
};
