import { createClient } from '@supabase/supabase-js';

function getEnv(name: string) {
  // Support both Deno and Node env APIs
  if (typeof Deno !== 'undefined' && 'env' in Deno) {
    return Deno.env.get(name);
  }

  return process.env[name];
}

const SUPABASE_URL = getEnv('SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const;

export default async function handler(req: Request) {
  try {
    // 1) fetch all rankings ordered by xp_this_week desc
    const { data: rows, error } = await supabaseAdmin
      .from('user_rankings')
      .select('user_id, elo_rating, xp_this_week, league')
      .order('xp_this_week', { ascending: false });

    if (error) throw error;

    const users = (rows ?? []) as Array<any>;

    // group by league
    const groups: Record<string, Array<any>> = {};
    for (const u of users) {
      const league = u.league || 'bronze';
      groups[league] = groups[league] || [];
      groups[league].push(u);
    }

    const leagueWeeksInserts: any[] = [];
    let processed = 0;

    const today = new Date();
    const weekStart = today.toISOString().slice(0, 10); // YYYY-MM-DD

    for (const tier of TIERS) {
      const group = groups[tier] || [];
      if (group.length === 0) continue;

      // group already ordered by xp_this_week desc because original fetch was ordered globally
      // but to be safe sort per-group
      group.sort((a, b) => (b.xp_this_week || 0) - (a.xp_this_week || 0));

      const n = group.length;
      const boundary = Math.max(1, Math.round(n * 0.2));

      for (let i = 0; i < n; i++) {
        const user = group[i];
        const rank = i + 1;
        let promoted = false;
        let demoted = false;
        let newLeague = user.league;

        const tierIndex = TIERS.indexOf(user.league);

        if (i < boundary && tier !== 'diamond') {
          // top 20% -> promote
          promoted = true;
          newLeague = TIERS[Math.min(TIERS.length - 1, tierIndex + 1)];
        } else if (i >= n - boundary && tier !== 'bronze') {
          // bottom 20% -> demote
          demoted = true;
          newLeague = TIERS[Math.max(0, tierIndex - 1)];
        }

        leagueWeeksInserts.push({
          user_id: user.user_id,
          league: user.league,
          xp_earned: user.xp_this_week || 0,
          rank_in_league: rank,
          promoted,
          demoted,
          week_start: weekStart,
        });

        // update user_rankings row
        const { error: updErr } = await supabaseAdmin
          .from('user_rankings')
          .update({ league: newLeague, xp_this_week: 0 })
          .eq('user_id', user.user_id);

        if (updErr) throw updErr;

        processed++;
      }
    }

    // bulk insert league_weeks
    if (leagueWeeksInserts.length > 0) {
      const { error: insErr } = await supabaseAdmin.from('league_weeks').insert(leagueWeeksInserts);
      if (insErr) throw insErr;
    }

    return new Response(JSON.stringify({ processed }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500 });
  }
}
