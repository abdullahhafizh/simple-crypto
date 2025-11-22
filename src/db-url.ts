export function buildDatabaseUrlFromEnv(): string {
  const {
    DB_HOST = "localhost",
    DB_PORT = "5432",
    DB_NAME,
    DB_USER,
    DB_PASS,
    DB_SSL_MODE,
  } = process.env;

  if (!DB_NAME || !DB_USER || !DB_PASS) {
    throw new Error(
      "Missing DB_NAME, DB_USER or DB_PASS environment variables for DATABASE_URL",
    );
  }

  const auth = `${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASS)}`;

  const base = `postgresql://${auth}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;

  const ssl =
    DB_SSL_MODE && DB_SSL_MODE !== "false"
      ? `?sslmode=${encodeURIComponent(DB_SSL_MODE)}`
      : "";

  return base + ssl;
}
