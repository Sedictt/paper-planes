import { z } from 'zod';

export const TimeOfDaySchema = z.enum([
  'dawn',
  'morning',
  'afternoon',
  'dusk',
  'evening',
  'midnight',
]);

export const PaperTintSchema = z.enum(['cream', 'rose', 'sky', 'sage', 'gold']);

export const CountryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Use a 2-letter ISO country code.')
  .refine((code) => code !== 'XX' && code !== 'T1', 'Invalid country code.');

export const CreatePlaneSchema = z
  .object({
    title: z
      .string()
      .trim()
      .max(80, 'Keep your title under 80 characters.')
      .optional(),
    text: z
      .string()
      .trim()
      .min(3, 'Write at least a few words before folding.')
      .max(320, 'Keep your note under 320 characters so the plane stays light.'),
    biome: z.string().trim().min(1).max(48).optional().default('Downtown Rooftops'),
    timeOfDay: TimeOfDaySchema.optional().default('dusk'),
    paperTint: PaperTintSchema.optional().default('cream'),
    stamp: z.string().trim().min(1).max(24).optional().default('AIRMAIL'),
    countryCode: CountryCodeSchema.optional(),
  })
  .strict();

export const ListPlanesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(15),
  cursor: z.string().trim().min(1).max(128).optional(),
  biome: z.string().trim().min(1).max(48).optional(),
  timeOfDay: TimeOfDaySchema.optional(),
  country: CountryCodeSchema.optional(),
});

export const RandomPlaneQuerySchema = z.object({
  exclude: z
    .string()
    .trim()
    .max(512)
    .optional(),
  country: CountryCodeSchema.optional(),
});

export const ReadPlaneSchema = z
  .object({
    id: z.string().trim().min(1, 'Plane id is required.').max(64),
  })
  .strict();

export const FlagPlaneSchema = z
  .object({
    id: z.string().trim().min(1, 'Plane id is required.').max(64),
    undo: z.boolean().optional().default(false),
  })
  .strict();

export const FeedbackSchema = z
  .object({
    kind: z.enum(['feedback', 'bug']),
    message: z
      .string()
      .trim()
      .min(5, 'Please write at least 5 characters before sending.')
      .max(1200, 'Please keep your message under 1200 characters.'),
    replyTo: z
      .string()
      .trim()
      .email('Please enter a valid email address.')
      .max(120)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    context: z
      .object({
        biome: z.string().trim().max(48).optional(),
        timeOfDay: TimeOfDaySchema.optional(),
        viewport: z.string().trim().max(32).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
