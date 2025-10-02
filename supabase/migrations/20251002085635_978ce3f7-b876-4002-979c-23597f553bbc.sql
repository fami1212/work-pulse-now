-- Ajouter l'utilisateur khalilcompanyit@gmail.com comme admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('263c2b41-c157-4570-b9e6-16cceb795242', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;