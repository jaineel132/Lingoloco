import { NextResponse } from 'next/server';
import { COMPETE_SQUADS, getSquadById } from '../../../../lib/competeSquads';
import { createSupabaseServerClient, getSupabaseUser } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

type JoinChallengeRequest = {
  squadId?: number;
};

async function buildSquadPayload(userEmail?: string) {
  const supabase = await createSupabaseServerClient();
  const squadIds = COMPETE_SQUADS.map((squad) => squad.id);
  const { data: squadRows, error } = await supabase.from('profiles').select('squadId').in('squadId', squadIds);

  if (error) {
    throw error;
  }

  const extraMembersBySquadId = new Map<number, number>();
  (squadRows || []).forEach((row) => {
    if (typeof row.squadId === 'number') {
      extraMembersBySquadId.set(row.squadId, (extraMembersBySquadId.get(row.squadId) || 0) + 1);
    }
  });

  let joinedSquadId: number | null = null;

  if (userEmail) {
    const { data: user, error: userError } = await supabase.from('profiles').select('squadId').eq('email', userEmail).maybeSingle();
    if (userError) {
      throw userError;
    }

    joinedSquadId = typeof user?.squadId === 'number' ? user.squadId : null;
  }

  const squads = COMPETE_SQUADS.map((squad) => {
    const extraMembers = extraMembersBySquadId.get(squad.id) || 0;
    const members = Math.min(squad.maxMembers, squad.baseMembers + extraMembers);
    const joined = joinedSquadId === squad.id;

    return {
      id: squad.id,
      name: squad.name,
      lang: squad.lang,
      members,
      maxMembers: squad.maxMembers,
      score: squad.score,
      icon: squad.icon,
      joined,
      canJoin: joined || members < squad.maxMembers,
    };
  });

  return {
    squads,
    joinedSquadId,
  };
}

export async function GET() {
  try {
    const user = await getSupabaseUser();
    const payload = await buildSquadPayload(user?.email || undefined);

    return NextResponse.json(
      { success: true, data: payload },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error: any) {
    console.error('Compete Challenges GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load squads: ' + error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSupabaseUser();

    if (!user?.id || !user.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const body = (await request.json()) as JoinChallengeRequest;
    const squadId = Number(body.squadId);

    if (!Number.isFinite(squadId)) {
      return NextResponse.json({ success: false, error: 'A valid squadId is required.' }, { status: 400 });
    }

    const squad = getSquadById(squadId);
    if (!squad) {
      return NextResponse.json({ success: false, error: 'Selected squad does not exist.' }, { status: 404 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      return NextResponse.json({ success: false, error: 'User profile not found.' }, { status: 404 });
    }

    if (profile.squadId === squadId) {
      const payload = await buildSquadPayload(user.email);
      return NextResponse.json({ success: true, data: payload, message: 'Already joined this squad.' }, { status: 200 });
    }

    const { data: squadMembers, error: countError } = await supabase.from('profiles').select('id').eq('squadId', squadId);

    if (countError) {
      throw countError;
    }

    const effectiveMembers = squad.baseMembers + (squadMembers?.length || 0);

    if (effectiveMembers >= squad.maxMembers) {
      return NextResponse.json({ success: false, error: 'This squad is full. Please pick another one.' }, { status: 409 });
    }

    const { error: updateError } = await supabase.from('profiles').update({
      squadId,
      squadJoinedAt: new Date().toISOString(),
    }).eq('id', user.id);

    if (updateError) {
      throw updateError;
    }

    const payload = await buildSquadPayload(user.email);
    return NextResponse.json({ success: true, data: payload, message: `Joined ${squad.name}` }, { status: 200 });
  } catch (error: any) {
    console.error('Compete Challenges POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to join squad: ' + error.message }, { status: 500 });
  }
}
