-- Function to process a kiosk QR punch without requiring user login on the device
-- Bypasses table RLS using SECURITY DEFINER while keeping minimal surface area
CREATE OR REPLACE FUNCTION public.process_qr_punch(
  p_qr_code text,
  p_lat numeric,
  p_lng numeric
)
RETURNS TABLE(
  full_name text,
  punch_type text,
  punched_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_full_name text;
  v_prev_type text;
  v_next_type text;
  v_now timestamptz := now();
BEGIN
  -- Find user by QR code
  SELECT user_id, full_name
    INTO v_user_id, v_full_name
  FROM profiles
  WHERE qr_code = p_qr_code;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'QR code inconnu';
  END IF;

  -- Determine next punch type based on last record
  SELECT type
    INTO v_prev_type
  FROM punch_records
  WHERE user_id = v_user_id
  ORDER BY timestamp DESC
  LIMIT 1;

  IF v_prev_type IN ('in', 'break_end') THEN
    v_next_type := 'out';
  ELSE
    v_next_type := 'in';
  END IF;

  -- Insert new punch record
  INSERT INTO punch_records(user_id, type, timestamp, method, latitude, longitude)
  VALUES (v_user_id, v_next_type, v_now, 'qr_code', p_lat, p_lng);

  -- Return display-friendly info
  RETURN QUERY
  SELECT v_full_name,
         CASE WHEN v_next_type = 'in' THEN 'Entrée enregistrée' ELSE 'Sortie enregistrée' END,
         v_now;
END;
$$;

-- Restrict who can call the function, then grant explicitly for kiosk usage
REVOKE ALL ON FUNCTION public.process_qr_punch(text, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_qr_punch(text, numeric, numeric) TO anon, authenticated;