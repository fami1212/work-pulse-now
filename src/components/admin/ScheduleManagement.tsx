import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

export const ScheduleManagement = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Gestion des Horaires
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
          <Calendar className="w-16 h-16 text-muted-foreground" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Fonctionnalité en développement</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              La gestion des horaires des employés sera bientôt disponible.
              Vous pourrez définir des plages horaires personnalisées pour chaque employé.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
