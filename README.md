This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Математичний помічник (`/student/prep`)

Серверні змінні (лише сервер, без префікса `NEXT_PUBLIC_`):

| Змінна | Обов’язкова | Призначення |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | так | ключ Anthropic API |
| `ANTHROPIC_MODEL` | ні | модель, типово `claude-haiku-5-5` |
| `PREP_SESSION_SECRET` | рекомендовано | ≥32 випадкові символи для підпису сесій підготовки; без неї ключ виводиться з `SUPABASE_SERVICE_ROLE_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` | так | як і раніше |

Міграція `supabase-migration-math-helper.sql` (необов’язкова): спільний для всіх інстансів ліміт частоти й облік токенів у `prep_logs`.

Тести (з імітацією Anthropic API, без мережі й без бази): `npm test`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
