export const AuthResponseSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    message: { type: 'string' },
    valid: { type: 'boolean' },
    token: { type: 'string' },
    refreshToken: { type: 'string' },
    user: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
        role: {
          type: 'object',
          nullable: true,
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            permissions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  feature: { type: 'string' },
                  view: { type: 'boolean' },
                  create: { type: 'boolean' },
                  delete: { type: 'boolean' },
                  activate: { type: 'boolean' }
                }
              }
            }
          }
        }
      }
    }
  }
};

export const RefreshSchema = {
  type: 'object',
  required: ['refreshToken'],
  properties: {
    refreshToken: { type: 'string' }
  }
};

export const LoginSchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string' }
  }
};

export const RequestResetSchema = {
  type: 'object',
  required: ['email'],
  properties: {
    email: { type: 'string', format: 'email' }
  }
};

export const ValidateResetSchema = {
  type: 'object',
  required: ['email', 'token'],
  properties: {
    email: { type: 'string', format: 'email' },
    token: { type: 'string' }
  }
};

export const ChangePasswordSchema = {
  type: 'object',
  required: ['email', 'token', 'password'],
  properties: {
    email: { type: 'string', format: 'email' },
    token: { type: 'string' },
    password: { type: 'string' }
  }
};
