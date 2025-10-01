-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('admin', 'employee', 'student');

-- Create enum for punch methods
CREATE TYPE public.punch_method AS ENUM ('qr_code', 'card', 'photo', 'manual');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create school_locations table
CREATE TABLE public.school_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  latitude NUMERIC(10, 8) NOT NULL,
  longitude NUMERIC(11, 8) NOT NULL,
  radius NUMERIC NOT NULL DEFAULT 100, -- radius in meters
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on school_locations
ALTER TABLE public.school_locations ENABLE ROW LEVEL SECURITY;

-- RLS policies for school_locations
CREATE POLICY "Everyone can view school locations"
ON public.school_locations
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage school locations"
ON public.school_locations
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Insert OMNIA SCHOOL location (default coordinates - to be updated)
INSERT INTO public.school_locations (name, latitude, longitude, radius)
VALUES ('OMNIA SCHOOL OF BUSINESS AND TECHNOLOGY', 0, 0, 100);

-- Add new columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS student_id TEXT,
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS qr_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS card_number TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add new columns to punch_records table
ALTER TABLE public.punch_records
ADD COLUMN IF NOT EXISTS method punch_method NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 8),
ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8),
ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS verified_by UUID,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create schedules table
CREATE TABLE public.schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(user_id, day_of_week)
);

-- Enable RLS on schedules
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies for schedules
CREATE POLICY "Users can view their own schedules"
ON public.schedules
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all schedules"
ON public.schedules
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage schedules"
ON public.schedules
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Function to generate unique QR code
CREATE OR REPLACE FUNCTION public.generate_qr_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_code TEXT;
BEGIN
  LOOP
    new_code := 'OMNIA-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 12));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE qr_code = new_code);
  END LOOP;
  RETURN new_code;
END;
$$;

-- Function to verify location
CREATE OR REPLACE FUNCTION public.verify_location(
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_location_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  location_record RECORD;
  distance NUMERIC;
BEGIN
  SELECT * INTO location_record
  FROM public.school_locations
  WHERE id = p_location_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Calculate distance using Haversine formula (simplified)
  distance := 6371000 * ACOS(
    COS(RADIANS(location_record.latitude)) * 
    COS(RADIANS(p_latitude)) * 
    COS(RADIANS(p_longitude) - RADIANS(location_record.longitude)) + 
    SIN(RADIANS(location_record.latitude)) * 
    SIN(RADIANS(p_latitude))
  );
  
  RETURN distance <= location_record.radius;
END;
$$;

-- Update triggers
CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_school_locations_updated_at
BEFORE UPDATE ON public.school_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at
BEFORE UPDATE ON public.schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update RLS policies for punch_records to allow admins to view all
CREATE POLICY "Admins can view all punch records"
ON public.punch_records
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update punch records"
ON public.punch_records
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));