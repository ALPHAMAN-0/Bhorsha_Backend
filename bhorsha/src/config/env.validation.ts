export function validateEnv(config: Record<string, unknown>) {
  const errors: string[] = [];

  const port = Number(config.PORT || 3000);
  if (isNaN(port) || port <= 0 || port > 65535) {
    errors.push('PORT must be a valid port number between 1 and 65535');
  }

  if (!config.DB_HOST) {
    errors.push('DB_HOST is required');
  }

  const dbPort = Number(config.DB_PORT || 5432);
  if (isNaN(dbPort) || dbPort <= 0 || dbPort > 65535) {
    errors.push('DB_PORT must be a valid port number between 1 and 65535');
  }

  if (!config.DB_USER) {
    errors.push('DB_USER is required');
  }

  if (!config.DB_NAME) {
    errors.push('DB_NAME is required');
  }

  if (errors.length > 0) {
    throw new Error(`[EnvValidationError] Environment boot validation failed:\n  - ${errors.join('\n  - ')}`);
  }

  return config;
}
