import { NextResponse } from 'next/server';
import { createSupabaseServerClient, getSupabaseUser } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

type DuelApiBody = {
  action?: 'send' | 'accept' | 'decline';
  targetEmail?: string;
  notificationId?: string;
};

type NotificationPayload = {
  id: string;
  senderEmail: string;
  senderName: string;
  senderImage: string;
  senderTargetLanguage: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  respondedAt: string | null;
};

function noCacheHeaders() {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  };
}

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
        status: (raw.status === 'accepted' || raw.status === 'declined' ? raw.status : 'pending') as 'pending' | 'accepted' | 'declined',
        createdAt: createdAt.toISOString(),
        respondedAt: respondedAt ? respondedAt.toISOString() : null,
      };
    })
    .filter((item) => item.id && item.senderEmail)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function GET() {
  try {
    const user = await getSupabaseUser();

    if (!user?.id || !user.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401, headers: noCacheHeaders() });
    }

    const supabase = await createSupabaseServerClient();

    const { data: currentUser, error: currentUserError } = await supabase
      .from('profiles')
      .select('id,name,email,image,targetLanguage')
      .eq('id', user.id)
      .maybeSingle();

    if (currentUserError) {
      throw currentUserError;
    }

    if (!currentUser?.email) {
      return NextResponse.json({ success: false, error: 'User profile not found.' }, { status: 404, headers: noCacheHeaders() });
    }

    const { data: rivals, error: rivalsError } = await supabase
      .from('profiles')
      .select('id,name,email,image,targetLanguage,level,xp')
      .neq('email', currentUser.email)
      .order('xp', { ascending: false })
      .order('updatedAt', { ascending: false })
      .limit(20);

    if (rivalsError) {
      throw rivalsError;
    }

    const rivalCards = rivals
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
      throw notificationError;
    }

    const notifications = normalizeNotifications(notificationRows);

    return NextResponse.json(
      {
        success: true,
        data: {
          rivals: rivalCards,
          notifications,
        },
      },
      { status: 200, headers: noCacheHeaders() }
    );
  } catch (error: any) {
    console.error('Compete duels GET error:', error);
    return NextResponse.json(
      { success: false, error: `Failed to load duel data: ${error.message}` },
      { status: 500, headers: noCacheHeaders() }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSupabaseUser();

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

      const { data: existingPendingRows, error: existingPendingError } = await supabase
        .from('duel_notifications')
        .select('id')
        .eq('userId', targetUser.id)
        .eq('senderEmail', currentUser.email)
        .eq('status', 'pending')
        .limit(1);

      if (existingPendingError) {
        throw existingPendingError;
      }

      const existingPending = existingPendingRows && existingPendingRows.length > 0;

      if (!existingPending) {
        const { error: insertError } = await supabase.from('duel_notifications').insert({
          userId: targetUser.id,
          senderEmail: currentUser.email,
          senderName: currentUser.name || 'Language Learner',
          senderImage: currentUser.image || '',
          senderTargetLanguage: currentUser.targetLanguage || '',
          status: 'pending',
        });

        if (insertError) {
          throw insertError;
        }
      }

      return NextResponse.json(
        {
          success: true,
          message: existingPending ? 'Challenge already pending for this learner.' : 'Challenge sent. Waiting for acceptance.',
        },
        { status: 200, headers: noCacheHeaders() }
      );
    }

    if (action === 'accept' || action === 'decline') {
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
          status: action === 'accept' ? 'accepted' : 'declined',
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
          message: action === 'accept' ? 'Duel request accepted.' : 'Duel request declined.',
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
