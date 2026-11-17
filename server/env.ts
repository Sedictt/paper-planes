import { z } from 'zod';

const DEV_IP_HASH_SALT = 'paper-planes-dev-salt-change-in-prod';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z
      .string()
      .trim()
      .url('DATABASE_URL must be a valid PostgreSQL connection string.')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    IP_HASH_SALT: z.string().min(8).default(DEV_IP_HASH_SALT),
    ALLOWED_ORIGINS: z.string().optional(),
    FEEDBACK_TO_EMAIL: z
      .string()
      .trim()
      .email('FEEDBACK_TO_EMAIL must be a valid email address.')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    RESEND_API_KEY: z
      .string()
      .trim()
      .min(1)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    RESEND_FROM_EMAIL: z
      .string()
      .trim()
      .min(1)
      .optional()
      .or(z.literal('').transform(() => undefined)),
  })
  .refine((e) => e.NODE_ENV !== 'production' || e.IP_HASH_SALT !== DEV_IP_HASH_SALT, {
    message: 'IP_HASH_SALT must be set to a unique secret in production.',
    path: ['IP_HASH_SALT'],
  })
  .refine((e) => e.NODE_ENV !== 'production' || Boolean(e.DATABASE_URL), {
    message: 'DATABASE_URL must be set in production.',
    path: ['DATABASE_URL'],
  });

export type AppEnv = z.infer<typeof EnvSchema>;

let cachedEnv: AppEnv | null = null;

/**
 * Parses and caches process environment variables at startup.
 * Throws immediately if a configured variable is malformed.
 */
export function getEnv(): AppEnv {
  if (cachedEnv) return cachedEnv;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

/**
 * Resets cached env (used in tests).
 */
export function resetEnvCache(): void {
  cachedEnv = null;
}
