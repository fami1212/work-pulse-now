import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, Plus, Target } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const goalSchema = z.object({
  title: z.string()
    .trim()
    .min(1, "Le titre est obligatoire")
    .max(100, "Le titre doit faire moins de 100 caractères"),
  description: z.string()
    .trim()
    .max(500, "La description doit faire moins de 500 caractères")
    .optional(),
  target_value: z.number()
    .min(0.1, "La valeur cible doit être positive")
    .max(10000, "La valeur cible est trop élevée"),
  unit: z.enum(['hours', 'days', 'sessions', 'percentage']),
  target_date: z.date().optional(),
});

type GoalFormData = z.infer<typeof goalSchema>;

interface GoalFormProps {
  onGoalCreated: () => void;
  goal?: any; // For editing existing goals
  trigger?: React.ReactNode;
}

const GoalForm = ({ onGoalCreated, goal, trigger }: GoalFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    goal?.target_date ? new Date(goal.target_date) : undefined
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: goal ? {
      title: goal.title,
      description: goal.description || "",
      target_value: goal.target_value,
      unit: goal.unit,
    } : {
      target_value: 1,
      unit: 'hours',
    }
  });

  const selectedUnit = watch('unit');

  const getUnitLabel = (unit: string) => {
    switch (unit) {
      case 'hours': return 'heures';
      case 'days': return 'jours';
      case 'sessions': return 'sessions';
      case 'percentage': return '%';
      default: return '';
    }
  };

  const onSubmit = async (data: GoalFormData) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const goalData = {
        ...data,
        user_id: user.id,
        target_date: selectedDate?.toISOString().split('T')[0] || null,
        status: 'active' as const,
      };

      if (goal) {
        // Update existing goal
        const { error } = await supabase
          .from('goals')
          .update(goalData)
          .eq('id', goal.id);

        if (error) throw error;

        toast({
          title: "Objectif mis à jour",
          description: "Votre objectif a été mis à jour avec succès.",
        });
      } else {
        // Create new goal
        const { error } = await supabase
          .from('goals')
          .insert([goalData]);

        if (error) throw error;

        toast({
          title: "Objectif créé",
          description: "Votre nouvel objectif a été créé avec succès.",
        });
      }

      setOpen(false);
      reset();
      setSelectedDate(undefined);
      onGoalCreated();
    } catch (error) {
      console.error('Error saving goal:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la sauvegarde.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultTrigger = (
    <Button className="gap-2">
      <Plus className="w-4 h-4" />
      Nouvel objectif
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            {goal ? 'Modifier l\'objectif' : 'Créer un objectif'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="title">Titre de l'objectif</Label>
            <Input
              id="title"
              placeholder="Ex: Heures mensuelles, Ponctualité..."
              {...register('title')}
              className={errors.title ? "border-destructive" : ""}
            />
            {errors.title && (
              <p className="text-sm text-destructive mt-1">{errors.title.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Description (optionnelle)</Label>
            <Textarea
              id="description"
              placeholder="Décrivez votre objectif en détail..."
              rows={3}
              {...register('description')}
              className={errors.description ? "border-destructive" : ""}
            />
            {errors.description && (
              <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="target_value">Valeur cible</Label>
              <Input
                id="target_value"
                type="number"
                step="0.1"
                min="0.1"
                max="10000"
                placeholder="160"
                {...register('target_value', { valueAsNumber: true })}
                className={errors.target_value ? "border-destructive" : ""}
              />
              {errors.target_value && (
                <p className="text-sm text-destructive mt-1">{errors.target_value.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="unit">Unité</Label>
              <Select
                value={selectedUnit}
                onValueChange={(value) => setValue('unit', value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir l'unité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Heures</SelectItem>
                  <SelectItem value="days">Jours</SelectItem>
                  <SelectItem value="sessions">Sessions</SelectItem>
                  <SelectItem value="percentage">Pourcentage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Date d'échéance (optionnelle)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? (
                    format(selectedDate, "PPP", { locale: fr })
                  ) : (
                    <span>Choisir une date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Aperçu:</strong> Objectif de {watch('target_value') || 0} {getUnitLabel(selectedUnit)}
              {selectedDate && ` à atteindre avant le ${format(selectedDate, "dd/MM/yyyy")}`}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Enregistrement...
                </div>
              ) : (
                goal ? 'Mettre à jour' : 'Créer l\'objectif'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default GoalForm;