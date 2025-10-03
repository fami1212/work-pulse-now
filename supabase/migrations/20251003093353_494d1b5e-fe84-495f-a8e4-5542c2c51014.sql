-- Trigger pour générer automatiquement un QR code lors de la création d'un utilisateur
CREATE OR REPLACE FUNCTION public.handle_new_user_qr()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Créer un profil avec QR code auto-généré pour le nouvel utilisateur
  INSERT INTO public.profiles (user_id, full_name, qr_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    public.generate_qr_code()
  );
  RETURN NEW;
END;
$$;

-- Créer le trigger sur auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_qr ON auth.users;
CREATE TRIGGER on_auth_user_created_qr
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_qr();