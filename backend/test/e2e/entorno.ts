// Se carga antes de cada archivo de test e2e (setupFiles): AppModule lee estas variables al importarse.
const URL_TEST =
  process.env.TEST_DATABASE_URL ??
  'postgresql://ferremax@localhost:5433/ferremax_test?schema=public';
Object.assign(process.env, {
  DATABASE_URL: URL_TEST,
  DIRECT_URL: URL_TEST,
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'test-pass-e2e',
  JWT_SECRET: 'secreto-de-pruebas-e2e-0123456789abcdef',
  FRONTEND_ORIGIN: 'http://localhost:3000',
  NODE_ENV: 'test',
});
