-- Corriger les problèmes de sécurité des fonctions en ajoutant SET search_path
CREATE OR REPLACE FUNCTION public.generate_employee_id()
RETURNS TEXT AS $$
DECLARE
  new_id TEXT;
  prefix TEXT := 'EMP';
  counter INTEGER;
BEGIN
  -- Récupérer le plus grand ID existant
  SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id FROM 4) AS INTEGER)), 0) + 1
  INTO counter
  FROM public.profiles 
  WHERE employee_id LIKE 'EMP%' AND employee_id ~ '^EMP[0-9]+$';
  
  -- Générer le nouvel ID avec padding
  new_id := prefix || LPAD(counter::TEXT, 4, '0');
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.create_punch_notification(
  p_user_id UUID,
  p_type TEXT,
  p_timestamp TIMESTAMP WITH TIME ZONE
)
RETURNS VOID AS $$
DECLARE
  notification_title TEXT;
  notification_message TEXT;
  time_str TEXT;
BEGIN
  time_str := TO_CHAR(p_timestamp, 'HH24:MI');
  
  CASE p_type
    WHEN 'in' THEN
      notification_title := 'Pointage d''entrée';
      notification_message := 'Entrée enregistrée à ' || time_str;
    WHEN 'out' THEN
      notification_title := 'Pointage de sortie';
      notification_message := 'Sortie enregistrée à ' || time_str;
    WHEN 'break_start' THEN
      notification_title := 'Début de pause';
      notification_message := 'Pause commencée à ' || time_str;
    WHEN 'break_end' THEN
      notification_title := 'Fin de pause';
      notification_message := 'Pause terminée à ' || time_str;
  END CASE;
  
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (p_user_id, 'info', notification_title, notification_message);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_punch_notification()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.create_punch_notification(NEW.user_id, NEW.type, NEW.timestamp);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;