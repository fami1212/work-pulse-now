-- Create enum for goal status
CREATE TYPE public.goal_status AS ENUM ('active', 'completed', 'paused', 'failed');

-- Create enum for goal units
CREATE TYPE public.goal_unit AS ENUM ('hours', 'days', 'sessions', 'percentage');

-- Create goals table for personalized objectives
CREATE TABLE public.goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  target_value NUMERIC NOT NULL,
  current_value NUMERIC NOT NULL DEFAULT 0,
  unit goal_unit NOT NULL DEFAULT 'hours',
  target_date DATE,
  status goal_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own goals" 
ON public.goals 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own goals" 
ON public.goals 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals" 
ON public.goals 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals" 
ON public.goals 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_goals_updated_at
BEFORE UPDATE ON public.goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default goals for demonstration
INSERT INTO public.goals (user_id, title, description, target_value, current_value, unit, target_date, status) VALUES
('00000000-0000-0000-0000-000000000000', 'Heures mensuelles', 'Objectif de 160 heures de travail ce mois', 160, 120, 'hours', DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day', 'active'),
('00000000-0000-0000-0000-000000000000', 'Ponctualité', 'Arriver à l''heure 95% du temps', 95, 88, 'percentage', DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day', 'active'),
('00000000-0000-0000-0000-000000000000', 'Sessions de travail', 'Compléter 22 sessions de travail ce mois', 22, 18, 'sessions', DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day', 'active');