import Anthropic from '@anthropic-ai/sdk';
import { handleAiPrep } from '@/lib/math-helper/handler';
import { supabasePrepDb } from '@/lib/math-helper/access-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handleAiPrep(req, {
    db: supabasePrepDb,
    createClient: () => {
      const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
      if (!apiKey) return null;
      return new Anthropic({ apiKey, maxRetries: 1, timeout: 60_000 });
    },
    // Технічна телеметрія: лише модель, режим, статус і кількість токенів — без вмісту.
    log: (event) => console.info(JSON.stringify(event)),
  });
}
