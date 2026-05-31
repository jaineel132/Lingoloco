import { NextResponse } from 'next/server';
import { createSupabaseServerClient, getSupabaseUser, getSupabaseUserFromRequest } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getSupabaseUser();

    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: latestProfile, error } = await supabase
      .from('onboarding_profiles')
      .select('*')
      .eq('userId', user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!latestProfile) {
      return NextResponse.json({ success: false, error: "No user profile found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: latestProfile }, { status: 200 });
  } catch (error: any) {
    console.error("API Error fetching user profile:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch profile: " + error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getSupabaseUserFromRequest(request);

    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const body = await request.json() as { image?: string };
    const image = typeof body.image === 'string' ? body.image.trim() : '';
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
    const avatarPrefix = supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/profileimages/` : '';
    const isDataUri = image.startsWith('data:image/');
    const isAvatarUrl = avatarPrefix ? image.startsWith(avatarPrefix) : false;

    if (!image || (!isDataUri && !isAvatarUrl)) {
      return NextResponse.json({ success: false, error: 'Please upload a valid avatar image.' }, { status: 400 });
    }

    if (isDataUri && image.length > 4_000_000) {
      return NextResponse.json({ success: false, error: 'Image is too large. Please choose a smaller file.' }, { status: 413 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update({ image })
      .eq('id', user.id)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, data: updatedProfile }, { status: 200 });
  } catch (error: any) {
    console.error('API Error updating profile image:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update profile image: ' + error.message },
      { status: 500 }
    );
  }
}
