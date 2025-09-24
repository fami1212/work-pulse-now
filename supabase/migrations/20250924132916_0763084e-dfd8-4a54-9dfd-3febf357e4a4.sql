-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  company_name TEXT,
  employee_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create punch_records table for time tracking
CREATE TABLE public.punch_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'break_start', 'break_end')),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create work_sessions table for calculating work time
CREATE TABLE public.work_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_work_minutes INTEGER NOT NULL DEFAULT 0,
  total_break_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punch_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Punch records policies
CREATE POLICY "Users can view their own punch records" 
ON public.punch_records 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own punch records" 
ON public.punch_records 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Work sessions policies
CREATE POLICY "Users can view their own work sessions" 
ON public.work_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own work sessions" 
ON public.work_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own work sessions" 
ON public.work_sessions 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create function to automatically update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_work_sessions_updated_at
  BEFORE UPDATE ON public.work_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to calculate work time
CREATE OR REPLACE FUNCTION public.calculate_work_time(user_uuid UUID, target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(total_work_minutes INTEGER, total_break_minutes INTEGER) AS $$
DECLARE
  work_minutes INTEGER := 0;
  break_minutes INTEGER := 0;
  current_in TIMESTAMP;
  current_break_start TIMESTAMP;
  rec RECORD;
BEGIN
  -- Process punch records for the given date
  FOR rec IN 
    SELECT type, timestamp 
    FROM public.punch_records 
    WHERE user_id = user_uuid 
      AND DATE(timestamp) = target_date 
    ORDER BY timestamp
  LOOP
    CASE rec.type
      WHEN 'in' THEN
        current_in := rec.timestamp;
      WHEN 'out' THEN
        IF current_in IS NOT NULL THEN
          work_minutes := work_minutes + EXTRACT(EPOCH FROM (rec.timestamp - current_in))/60;
          current_in := NULL;
        END IF;
      WHEN 'break_start' THEN
        current_break_start := rec.timestamp;
      WHEN 'break_end' THEN
        IF current_break_start IS NOT NULL THEN
          break_minutes := break_minutes + EXTRACT(EPOCH FROM (rec.timestamp - current_break_start))/60;
          current_break_start := NULL;
        END IF;
    END CASE;
  END LOOP;

  -- If still working, add current session
  IF current_in IS NOT NULL THEN
    work_minutes := work_minutes + EXTRACT(EPOCH FROM (NOW() - current_in))/60;
  END IF;

  RETURN QUERY SELECT work_minutes::INTEGER, break_minutes::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;