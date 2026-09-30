import dotenv from "dotenv";

dotenv.config({ override: true });

const DEFAULT_PORT = 3023;
const DEFAULT_FRONTEND_ORIGIN = "http://localhost:3022";

function requiredUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is missing. Copy backend/.env.example to backend/.env.",
    );
  }
  return url;
}

export const env = {
  port: Number(process.env.PORT ?? DEFAULT_PORT),
  databaseUrl: requiredUrl(),
  frontendOrigins: (process.env.FRONTEND_ORIGIN ?? DEFAULT_FRONTEND_ORIGIN)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};

/** Keeps database credentials out of logs and error responses. */
export function redactSecrets(value: string): string {
  return value.replace(/mysql:\/\/[^@\s]+@/gi, "mysql://***@");
}

export function errorMessage(error: unknown): string {
  return redactSecrets(
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
}
