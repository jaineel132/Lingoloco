import { createClient } from '@supabase/supabase-js';

function getEnv(name: string) {
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

type UserRow = {
  user_id: string;
  elo_rating: number;
  xp_this_week: number;
  league: string;
  new_league?: string;
};

export default async function handler(req: Request) {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('user_rankings')
      .select('user_id, elo_rating, xp_this_week, league')
      .order('xp_this_week', { ascending: false });

    if (error) throw error;

    const users = (rows ?? []) as UserRow[];

    const groups: Record<string, UserRow[]> = {};
    for (const u of users) {
      const league = u.league || 'bronze';
      (groups[league] ||= []).push(u);
    }

    const leagueWeeksInserts: any[] = [];
    const leagueChangeUpdates: { user_id: string; new_league: string }[] = [];
    const allUserIds: string[] = [];
    const today = new Date();
    const weekStart = today.toISOString().slice(0, 10);

    for (const tier of TIERS) {
      const group = groups[tier] || [];
      if (group.length === 0) continue;

      group.sort((a, b) => (b.xp_this_week || 0) - (a.xp_this_week || 0));

      const n = group.length;
      const boundary = Math.max(1, Math.round(n * 0.2));

      for (let i = 0; i < n; i++) {
        const user = group[i];
        const tierIndex = TIERS.indexOf(user.league);
        let promoted = false;
        let demoted = false;
        let newLeague = user.league;

        if (i < boundary && tier !== 'diamond') {
          promoted = true;
          newLeague = TIERS[Math.min(TIERS.length - 1, tierIndex + 1)];
        } else if (i >= n - boundary && tier !== 'bronze') {
          demoted = true;
          newLeague = TIERS[Math.max(0, tierIndex - 1)];
        }

        leagueWeeksInserts.push({
          user_id: user.user_id,
          league: user.league,
          xp_earned: user.xp_this_week || 0,
          rank_in_league: i + 1,
          promoted,
          demoted,
          week_start: weekStart,
        });

        if (newLeague !== user.league) {
          leagueChangeUpdates.push({ user_id: user.user_id, new_league: newLeague });
        }

        allUserIds.push(user.user_id);
        user.new_league = newLeague;
      }
    }

    // Batch reset xp_this_week for all users
    if (allUserIds.length > 0) {
      const { error: resetErr } = await supabaseAdmin
        .from('user_rankings')
        .update({ xp_this_week: 0 })
        .in('user_id', allUserIds);
      if (resetErr) throw resetErr;
    }

    // Apply league changes (only for users whose league changed)
    for (const upd of leagueChangeUpdates) {
      const { error: updErr } = await supabaseAdmin
        .from('user_rankings')
        .update({ league: upd.new_league })
        .eq('user_id', upd.user_id);
      if (updErr) throw updErr;
    }

    // Bulk insert league_weeks
    if (leagueWeeksInserts.length > 0) {
      const { error: insErr } = await supabaseAdmin.from('league_weeks').insert(leagueWeeksInserts);
      if (insErr) throw insErr;
    }

    return new Response(JSON.stringify({ processed: allUserIds.length }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500 });
  }
}
