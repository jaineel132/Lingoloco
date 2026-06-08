import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const type = (url.searchParams.get('type') || 'global') as 'global' | 'friends';
    const language = url.searchParams.get('language') || undefined;

    const supabase = await createSupabaseServerClient();

    if (type === 'global') {
      const { data: rankings, error } = await supabase
        .from('user_rankings')
        .select('user_id, elo_rating, xp_this_week, league, wins')
        .order('xp_this_week', { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }

      const userIds = Array.from(new Set((rankings ?? []).map((row) => row.user_id).filter(Boolean)));
      const { data: profiles, error: profilesError } = userIds.length
        ? await supabase.from('profiles').select('id,name,image').in('id', userIds)
        : { data: [], error: null };

      if (profilesError) {
        throw profilesError;
      }

      const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

      return NextResponse.json(
        (rankings ?? []).map((row) => {
          const profile = profileById.get(row.user_id) || null;

          return {
            ...row,
            name: profile?.name ?? null,
            image: profile?.image ?? null,
            profiles: profile
              ? {
                  username: profile.name,
                  avatar_url: profile.image,
                }
              : null,
          };
        })
      );
    }

    // type === 'friends' — TODO: filter by friends list. For now return empty array.
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      // If we can't determine user, return empty
      return NextResponse.json([]);
    }

    const user = userData?.user ?? null;
    if (!user) return NextResponse.json([]);

    // TODO: implement friends filtering by user's friends list
    return NextResponse.json([]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

export const runtime = 'edge';
