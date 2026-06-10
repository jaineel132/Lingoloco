# LingoLoco Issue Tracker

## 🔴 CRITICAL (Crashes & Security)

| # | Issue | Location | Status |
|---|-------|----------|--------|
| 1 | Secrets committed to git - `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` exposed | `.env.local` | ✅ Fixed - replaced with placeholders, ensure user rotates exposed keys |
| 2 | No auth verification on duel-result API - anyone can forge wins | `app/api/compete/duel-result/route.ts` | ✅ Fixed - added Bearer token verification, server-side winner determination |
| 3 | No auth verification on submit-round API - cheatable | `app/api/duel/submit-round/route.ts` | ✅ Fixed - added Bearer token verification from auth header |
| 4 | RLS blocks opponent profile reads - duel page crashes | `lib/db/migrations/002_enable_rls_policies.sql` | ✅ Fixed - added `007_fix_rls_policies.sql` with duel_participants select policy |
| 5 | `duel_matches` has RLS enabled but no policies - all client queries fail | `lib/db/migrations/004_ranking_system.sql` | ✅ Fixed - added SELECT/INSERT policies in `007_fix_rls_policies.sql` |
| 6 | Roleplay result page: `params` not typed as Promise - build crash | `app/roleplay/[id]/result/page.tsx` | ✅ False positive - already correctly used `Promise` + `use()` |
| 7 | `tournaments` table doesn't exist in any migration - silent failure | `app/compete/page.tsx` + migrations | ✅ Fixed - created `008_tournaments.sql` migration |

## 🟠 MAJOR (Broken Functionality)

| # | Issue | Location | Status |
|---|-------|----------|--------|
| 8 | Eternal duel lockout - players can only duel once ever | `app/compete/duel/[id]/page.tsx` | ✅ Already fixed in current code - filters by `neq('status', 'finished')` |
| 9 | Score inversion on loss in duel-result | `app/api/compete/duel-result/route.ts` | ✅ Fixed - winner/loser determined server-side from scores |
| 10 | Hardcoded `/dashboard` links causing 404s | `app/flashcards/page.tsx` | ✅ Fixed - now dynamic based on user's target language via `/api/dashboard` |
| 11 | Edge Runtime + `cookies()` conflict in leaderboard | `app/api/compete/leaderboard/route.ts` | ✅ Not a bug - `cookies()` is supported in Edge Runtime |
| 12 | Duplicated ELO calculation logic | `submit-round/route.ts` + `duel-result/route.ts` | ✅ Fixed - extracted shared `processDuelResult()` into `lib/elo.ts` |
| 13 | Flashcards hardcoded to Spanish regardless of user language | `app/flashcards/page.tsx` | ✅ Fixed - dynamically fetches user's target language |
| 14 | Roleplay result is static hardcoded data | `app/roleplay/[id]/result/page.tsx` | ✅ Fixed - stores session data in sessionStorage, dynamic score/label/feedback |
| 15 | Avatar stores base64 data URIs in DB instead of storage | `app/api/user/profile/route.ts` | ✅ Fixed - data URIs now uploaded to Supabase Storage, only URL stored in DB |
| 16 | Friends leaderboard always returns empty array | `app/api/compete/leaderboard/route.ts` | ✅ Fixed - queries recent duel opponents as friends list |
| 17 | `getLeagueFromElo` returns `string` vs DB `league_tier` enum | `lib/elo.ts` | ✅ Fixed - added `LeagueTier` type alias, return type is now `LeagueTier` |

## 🟡 MEDIUM (Quality & UX)

| # | Issue | Location | Status |
|---|-------|----------|--------|
| 18 | Static hardcoded stats on Match page (Win Rate 68%, etc.) | `app/compete/match/page.tsx` | ✅ Fixed - fetches dynamic `userStats` from `/api/compete/duels` |
| 19 | Static hardcoded top rivals list | `app/compete/match/page.tsx` | ✅ Fixed - fetches top rivals from `duel_matches` via API |
| 20 | Squad membership stored in localStorage, not DB | `app/compete/challenges/page.tsx` | ✅ Fixed - API response is source of truth, localStorage only as offline fallback |
| 21 | `@ts-ignore` bypass on channel.unsubscribe | `app/compete/page.tsx` | ✅ Fixed - uses `supabase.removeChannel()` instead |
| 22 | `key={index}` in renderChallengeText causes re-render issues | `app/compete/duel/[id]/page.tsx` | ✅ Fixed - uses `key={\`${index}-${char}\`}` for stable keys |
| 23 | Missing loading/error states in several components | Various | ✅ Fixed - added loading state to roleplay list and roleplay detail pages |
| 24 | Empty `auth/[...nextauth]` catch-all route | `app/api/auth/[...nextauth]/` | ✅ Fixed - removed empty directory (not using NextAuth) |

## 🟢 LOW (Minor)

| # | Issue | Location | Status |
|---|-------|----------|--------|
| 25 | No test files exist | Entire project | ✅ Fixed - added vitest config + 8 passing tests for `lib/elo.ts` |
| 26 | No input validation on practice API | `app/api/practice/route.ts` | ✅ Fixed - added validation for lang code format, topic/section length limits |
| 27 | TypeScript `strict` mode likely not enabled | `tsconfig.json` | ✅ False positive - `"strict": true` already set |
| 28 | `weekly-reset` uses `SUPABASE_URL` instead of `NEXT_PUBLIC_SUPABASE_URL` | `supabase/functions/weekly-reset/index.ts` | ✅ Fixed - falls back to `NEXT_PUBLIC_SUPABASE_URL` if `SUPABASE_URL` not set |
