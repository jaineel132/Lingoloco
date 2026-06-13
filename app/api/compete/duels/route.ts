import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient, getSupabaseUserFromRequest } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

type DuelApiBody = {
  action?: 'send' | 'accept' | 'decline';
  targetEmail?: string;
  targetUserId?: string;
  notificationId?: string;
};

function noCacheHeaders() {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  };
}

type NotificationPayload = {
  id: string;
  senderEmail: string;
  senderName: string;
  senderImage: string;
  senderTargetLanguage: string;
  status: 'pending' | 'accepted' | 'declined' | 'pending_waiting_acceptance';
  createdAt: string;
  respondedAt: string | null;
};

function normalizeNotifications(notifications: unknown): NotificationPayload[] {
  if (!Array.isArray(notifications)) {
    return [];
  }

  return notifications
    .map((item) => {
      const raw = (item ?? {}) as Record<string, unknown>;
      const createdAt = raw.createdAt ? new Date(String(raw.createdAt)) : new Date();
      const respondedAt = raw.respondedAt ? new Date(String(raw.respondedAt)) : null;

      return {
        id: String(raw.id ?? ''),
        senderEmail: String(raw.senderEmail ?? ''),
        senderName: String(raw.senderName ?? 'Unknown learner'),
        senderImage: String(raw.senderImage ?? ''),
        senderTargetLanguage: String(raw.senderTargetLanguage ?? ''),
        status: ['pending', 'accepted', 'declined', 'pending_waiting_acceptance'].includes(String(raw.status))
          ? (raw.status as NotificationPayload['status'])
          : 'pending',
        createdAt: createdAt.toISOString(),
        respondedAt: respondedAt ? respondedAt.toISOString() : null,
      };
    })
    .filter((item) => item.id && item.senderEmail)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.max(5, Math.min(50, parseInt(url.searchParams.get('pageSize') || '20', 10)));

    const user = await getSupabaseUserFromRequest(request);

    if (!user?.id || !user.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401, headers: noCacheHeaders() });
    }

    const supabase = await createSupabaseServerClient();
    const admin = createSupabaseAdminClient();

    const { data: currentUser, error: currentUserError } = await supabase
      .from('profiles')
      .select('id,name,email,image,targetLanguage')
      .eq('id', user.id)
      .maybeSingle();

    if (currentUserError) {
      console.error('Failed to fetch current user profile:', currentUserError);
      return NextResponse.json({ success: false, error: 'Failed to load user profile.' }, { status: 500, headers: noCacheHeaders() });
    }

    if (!currentUser?.email) {
      return NextResponse.json({ success: false, error: 'User profile not found.' }, { status: 404, headers: noCacheHeaders() });
    }

    const currentTargetLanguage = String(currentUser.targetLanguage || 'es').trim().toLowerCase();

    // Use admin client for cross-user reads (RLS restricts profiles to own row)
    const fromRow = (page - 1) * pageSize;
    const toRow = fromRow + pageSize - 1;

    const { data: rivals, error: rivalsError, count: rivalCount } = await admin
      .from('profiles')
      .select('id,name,email,image,targetLanguage,level,xp', { count: 'exact', head: false })
      .neq('email', currentUser.email)
      .eq('targetLanguage', currentTargetLanguage)
      .order('xp', { ascending: false })
      .order('updatedAt', { ascending: false })
      .range(fromRow, toRow);

    if (rivalsError) {
      console.error('Failed to fetch rivals:', rivalsError);
      return NextResponse.json({ success: false, error: 'Failed to load rivals.' }, { status: 500, headers: noCacheHeaders() });
    }

    const rivalCards = (rivals || [])
      .filter((rival) => Boolean(rival.email))
      .map((rival) => ({
        id: rival.id,
        name: rival.name || 'Learner',
        email: rival.email as string,
        bio: `Practicing ${String(rival.targetLanguage || 'languages').toUpperCase()} at ${rival.level || 'Beginner'} level.`,
        rank: rival.level || 'Beginner',
        xp: Number(rival.xp || 0),
        lang: String(rival.targetLanguage || 'N/A').toUpperCase(),
        avatar: (rival.name || 'L').trim().charAt(0).toUpperCase() || 'L',
        image: rival.image || '',
      }));

    const { data: notificationRows, error: notificationError } = await supabase
      .from('duel_notifications')
      .select('*')
      .eq('userId', currentUser.id)
      .order('createdAt', { ascending: false });

    if (notificationError) {
      console.error('Failed to fetch notifications:', notificationError);
      return NextResponse.json({ success: false, error: 'Failed to load notifications.' }, { status: 500, headers: noCacheHeaders() });
    }

    const notifications = normalizeNotifications(notificationRows);

    const { data: recentMatches, error: matchesError } = await supabase
      .from('duel_matches')
      .select('player1_id,player2_id,winner_id,player1_score,player2_score')
      .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
      .order('played_at', { ascending: false })
      .limit(50);

    if (matchesError) {
      console.error('Failed to fetch recent matches:', matchesError);
    }

    const opponentStats = new Map<string, { name: string; wins: number; losses: number }>();
    if (recentMatches) {
      for (const match of recentMatches) {
        const opponentId = match.player1_id === user.id ? match.player2_id : match.player1_id;
        const entry = opponentStats.get(opponentId) || { name: '', wins: 0, losses: 0 };
        if (match.winner_id === user.id) {
          entry.wins++;
        } else {
          entry.losses++;
        }
        opponentStats.set(opponentId, entry);
      }
    }

    const opponentIds = Array.from(opponentStats.keys());
    if (opponentIds.length > 0) {
      const { data: opponentProfiles, error: profilesError } = await admin
        .from('profiles')
        .select('id,name')
        .in('id', opponentIds);
      if (profilesError) {
        console.error('Failed to fetch opponent profiles:', profilesError);
      }
      if (opponentProfiles) {
        for (const profile of opponentProfiles) {
          const stats = opponentStats.get(profile.id);
          if (stats) stats.name = profile.name || 'Unknown';
        }
      }
    }

    const topRivals = Array.from(opponentStats.entries())
      .map(([id, stats]) => ({ id, name: stats.name || 'Unknown', wins: stats.wins, losses: stats.losses }))
      .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))
      .slice(0, 5);

    const { data: userRanking, error: rankingError } = await supabase
      .from('user_rankings')
      .select('wins,losses,win_streak,xp_total,elo_rating,league')
      .eq('user_id', user.id)
      .maybeSingle();

    if (rankingError) {
      console.error('Failed to fetch user ranking:', rankingError);
    }

    const userStats = userRanking
      ? {
          wins: userRanking.wins || 0,
          losses: userRanking.losses || 0,
          winStreak: userRanking.win_streak || 0,
          xpTotal: userRanking.xp_total || 0,
          eloRating: userRanking.elo_rating || 1000,
          league: userRanking.league || 'bronze',
          winRate: (userRanking.wins || 0) + (userRanking.losses || 0) > 0
            ? Math.round(((userRanking.wins || 0) / ((userRanking.wins || 0) + (userRanking.losses || 0))) * 100)
            : 0,
          totalMatches: (userRanking.wins || 0) + (userRanking.losses || 0),
        }
      : null;

    const totalRivals = rivalCount ?? rivalCards.length;

    return NextResponse.json(
      {
        success: true,
        data: {
          rivals: rivalCards,
          language: currentTargetLanguage,
          notifications,
          userStats,
          topRivals,
          pagination: {
            page,
            pageSize,
            total: totalRivals,
            totalPages: Math.ceil(totalRivals / pageSize),
          },
        },
      },
      { status: 200, headers: noCacheHeaders() }
    );
  } catch (error: any) {
    console.error('Duels GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load duel data: ' + (error.message || String(error)) },
      { status: 500, headers: noCacheHeaders() }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSupabaseUserFromRequest(request);

    if (!user?.id || !user.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401, headers: noCacheHeaders() });
    }

    const body = (await request.json()) as DuelApiBody;
    const action = body.action;

    if (!action) {
      return NextResponse.json({ success: false, error: 'Action is required.' }, { status: 400, headers: noCacheHeaders() });
    }

    const supabase = await createSupabaseServerClient();
    const { data: currentUser, error: currentUserError } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

    if (currentUserError) {
      throw currentUserError;
    }

    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User profile not found.' }, { status: 404, headers: noCacheHeaders() });
    }

    if (action === 'send') {
      const targetEmail = String(body.targetEmail || '').trim().toLowerCase();
      if (!targetEmail) {
        return NextResponse.json({ success: false, error: 'targetEmail is required.' }, { status: 400, headers: noCacheHeaders() });
      }

      if (targetEmail === currentUser.email.toLowerCase()) {
        return NextResponse.json({ success: false, error: 'You cannot challenge yourself.' }, { status: 400, headers: noCacheHeaders() });
      }

      const { data: targetUser, error: targetUserError } = await supabase.from('profiles').select('*').eq('email', targetEmail).maybeSingle();

      if (targetUserError) {
        throw targetUserError;
      }

      if (!targetUser) {
        return NextResponse.json(
          { success: false, error: 'Target learner was not found. Ask them to sign in once first.' },
          { status: 404, headers: noCacheHeaders() }
        );
      }

      const { data, error: rpcError } = await supabase.rpc('send_duel_request', {
        p_sender_id: currentUser.id,
        p_recipient_id: targetUser.id,
        p_sender_email: currentUser.email,
        p_sender_name: currentUser.name || 'Language Learner',
        p_sender_image: currentUser.image || '',
        p_sender_language: currentUser.targetLanguage || '',
      });

      if (rpcError) {
        console.error('send_duel_request RPC error:', rpcError);
        throw rpcError;
      }

      const result = (data ?? {}) as Record<string, unknown>;

      return NextResponse.json(
        {
          success: true,
          message: String(result.message || 'Challenge processed.'),
          alreadySent: Boolean(result.already_sent),
        },
        { status: 200, headers: noCacheHeaders() }
      );
    }

    if (action === 'accept') {
      const notificationId = String(body.notificationId || '').trim();

      if (!notificationId) {
        return NextResponse.json({ success: false, error: 'notificationId is required.' }, { status: 400, headers: noCacheHeaders() });
      }

      const { data, error: rpcError } = await supabase.rpc('accept_duel_request', {
        p_recipient_id: currentUser.id,
        p_notification_id: notificationId,
      });

      if (rpcError) {
        console.error('accept_duel_request RPC error:', rpcError);
        throw rpcError;
      }

      const result = (data ?? {}) as Record<string, unknown>;

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: String(result.error || 'Failed to accept duel request.') },
          { status: 400, headers: noCacheHeaders() }
        );
      }

      return NextResponse.json(
        {
          success: true,
          message: String(result.message || 'Duel request accepted.'),
          roomId: result.room_id ? String(result.room_id) : undefined,
        },
        { status: 200, headers: noCacheHeaders() }
      );
    }

    if (action === 'decline') {
      const notificationId = String(body.notificationId || '').trim();

      if (!notificationId) {
        return NextResponse.json({ success: false, error: 'notificationId is required.' }, { status: 400, headers: noCacheHeaders() });
      }

      const { data: notification, error: notificationError } = await supabase
        .from('duel_notifications')
        .select('*')
        .eq('id', notificationId)
        .eq('userId', currentUser.id)
        .maybeSingle();

      if (notificationError) {
        throw notificationError;
      }

      if (!notification) {
        return NextResponse.json({ success: false, error: 'Notification not found.' }, { status: 404, headers: noCacheHeaders() });
      }

      if (notification.status !== 'pending') {
        return NextResponse.json(
          { success: true, message: `This request was already ${notification.status}.` },
          { status: 200, headers: noCacheHeaders() }
        );
      }

      const { error: updateError } = await supabase
        .from('duel_notifications')
        .update({
          status: 'declined',
          respondedAt: new Date().toISOString(),
        })
        .eq('id', notificationId)
        .eq('userId', currentUser.id);

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json(
        {
          success: true,
          message: 'Duel request declined.',
        },
        { status: 200, headers: noCacheHeaders() }
      );
    }

    return NextResponse.json({ success: false, error: 'Unsupported action.' }, { status: 400, headers: noCacheHeaders() });
  } catch (error: any) {
    console.error('Compete duels POST error:', error);
    return NextResponse.json(
      { success: false, error: `Failed to update duel request: ${error.message}` },
      { status: 500, headers: noCacheHeaders() }
    );
  }
}
