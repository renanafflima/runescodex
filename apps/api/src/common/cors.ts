const DEFAULT_WEB_ORIGINS = [
  'https://tritec.app.br',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
] as const;

export function resolveCorsOrigins(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const extra =
    env.CORS_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  return [...new Set<string>([...DEFAULT_WEB_ORIGINS, ...extra])];
}

export function corsOptions(env: NodeJS.ProcessEnv = process.env) {
  return {
    origin: resolveCorsOrigins(env),
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
    credentials: true,
    optionsSuccessStatus: 204,
  };
}
