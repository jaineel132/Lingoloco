-- Fix duel notification and room creation logic

DROP FUNCTION IF EXISTS public.send_duel_request(UUID, UUID, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.send_duel_request(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.accept_duel_request(UUID, UUID);
DROP FUNCTION IF EXISTS public.accept_duel_request(TEXT, TEXT);

-- RPC: Send a duel request
-- Creates two notifications (one for recipient, one for sender) in one atomic operation
CREATE OR REPLACE FUNCTION public.send_duel_request(
  p_sender_id UUID,
  p_recipient_id UUID,
  p_sender_email TEXT,
  p_sender_name TEXT,
  p_sender_image TEXT,
  p_sender_language TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_pending INT;
  recipient_notif_id UUID;
  sender_notif_id UUID;
BEGIN
  SELECT COUNT(*) INTO existing_pending
  FROM public.duel_notifications
  WHERE "userId" = p_recipient_id
    AND "senderEmail" = p_sender_email
    AND status = 'pending';

  IF existing_pending > 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Challenge already pending for this learner.',
      'already_sent', true
    );
  END IF;

  INSERT INTO public.duel_notifications ("userId", "senderEmail", "senderName", "senderImage", "senderTargetLanguage", status)
  VALUES (p_recipient_id, p_sender_email, p_sender_name, p_sender_image, p_sender_language, 'pending')
  RETURNING id INTO recipient_notif_id;

  INSERT INTO public.duel_notifications ("userId", "senderEmail", "senderName", "senderImage", "senderTargetLanguage", status)
  VALUES (p_sender_id, p_sender_email, p_sender_name, p_sender_image, p_sender_language, 'pending_waiting_acceptance')
  RETURNING id INTO sender_notif_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Challenge sent. Waiting for acceptance.',
    'recipient_notification_id', recipient_notif_id,
    'sender_notification_id', sender_notif_id
  );
END;
$$;

-- RPC: Accept a duel request
-- Creates the duel room and updates both notifications atomically
CREATE OR REPLACE FUNCTION public.accept_duel_request(
  p_recipient_id UUID,
  p_notification_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notif_record RECORD;
  sender_profile_id UUID;
  existing_room_id UUID;
  new_room_id UUID;
BEGIN
  SELECT * INTO notif_record
  FROM public.duel_notifications
  WHERE id = p_notification_id
    AND "userId" = p_recipient_id
    AND status = 'pending'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Notification not found or already handled.');
  END IF;

  SELECT id INTO sender_profile_id
  FROM public.profiles
  WHERE email = notif_record."senderEmail"
  LIMIT 1;

  IF sender_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sender profile not found.');
  END IF;

  SELECT id INTO existing_room_id
  FROM public.duel_rooms
  WHERE (
    (player1_id = sender_profile_id AND player2_id = p_recipient_id)
    OR (player1_id = p_recipient_id AND player2_id = sender_profile_id)
  )
    AND status != 'finished'
  LIMIT 1;

  IF existing_room_id IS NOT NULL THEN
    UPDATE public.duel_notifications
    SET status = 'accepted', "respondedAt" = NOW()
    WHERE id IN (p_notification_id, (SELECT id FROM public.duel_notifications WHERE "userId" = sender_profile_id AND "senderEmail" = notif_record."senderEmail" AND status = 'pending_waiting_acceptance' LIMIT 1));

    RETURN jsonb_build_object('success', true, 'message', 'Duel request accepted.', 'room_id', existing_room_id);
  END IF;

  INSERT INTO public.duel_rooms (player1_id, player2_id, language, status)
  VALUES (sender_profile_id, p_recipient_id, COALESCE((SELECT "targetLanguage" FROM public.profiles WHERE id = p_recipient_id), 'Spanish'), 'waiting')
  RETURNING id INTO new_room_id;

  UPDATE public.duel_notifications
  SET status = 'accepted', "respondedAt" = NOW()
  WHERE id IN (p_notification_id, (SELECT id FROM public.duel_notifications WHERE "userId" = sender_profile_id AND "senderEmail" = notif_record."senderEmail" AND status = 'pending_waiting_acceptance' LIMIT 1));

  RETURN jsonb_build_object('success', true, 'message', 'Duel request accepted.', 'room_id', new_room_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_duel_request(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_duel_request(UUID, UUID) TO authenticated;
