import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, LogIn, LogOut, Coffee, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface PunchRecord {
  id: string;
  type: 'in' | 'out' | 'break_start' | 'break_end';
  timestamp: string;
  user_id: string;
}

interface Profile {
  full_name: string;
  company_name?: string;
  employee_id?: string;
}

export const PunchCardSupabase = () => {
  const { user, signOut } = useAuth();
  const [currentStatus, setCurrentStatus] = useState<'out' | 'in' | 'break'>('out');
  const [todayRecords, setTodayRecords] = useState<PunchRecord[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [totalWorkTime, setTotalWorkTime] = useState("0h 0min");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchTodayRecords();
    }
  }, [user]);

  // Real-time updates for punch records
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('punch-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'punch_records',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchTodayRecords();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (todayRecords.length > 0) {
      calculateWorkTime();
      updateCurrentStatus();
    }
  }, [todayRecords]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, company_name, employee_id')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchTodayRecords = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('punch_records')
        .select('id, type, timestamp, user_id')
        .eq('user_id', user.id)
        .gte('timestamp', `${today}T00:00:00.000Z`)
        .lt('timestamp', `${today}T23:59:59.999Z`)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('Error fetching records:', error);
        return;
      }

      setTodayRecords((data || []) as PunchRecord[]);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const calculateWorkTime = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .rpc('calculate_work_time', {
          user_uuid: user.id,
          target_date: new Date().toISOString().split('T')[0]
        });

      if (error) {
        console.error('Error calculating work time:', error);
        return;
      }

      if (data && data.length > 0) {
        const { total_work_minutes } = data[0];
        const hours = Math.floor(total_work_minutes / 60);
        const minutes = total_work_minutes % 60;
        setTotalWorkTime(`${hours}h ${minutes}min`);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const updateCurrentStatus = () => {
    if (todayRecords.length === 0) {
      setCurrentStatus('out');
      return;
    }

    const lastRecord = todayRecords[todayRecords.length - 1];
    switch (lastRecord.type) {
      case 'in':
        setCurrentStatus('in');
        break;
      case 'out':
        setCurrentStatus('out');
        break;
      case 'break_start':
        setCurrentStatus('break');
        break;
      case 'break_end':
        setCurrentStatus('in');
        break;
    }
  };

  const addPunchRecord = async (type: PunchRecord['type']) => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('punch_records')
        .insert({
          user_id: user.id,
          type,
          timestamp: new Date().toISOString()
        });

      if (error) {
        console.error('Error adding punch record:', error);
        toast({
          title: "Erreur",
          description: "Impossible d'enregistrer le pointage",
          variant: "destructive",
        });
        return;
      }

      // Refresh records
      await fetchTodayRecords();

      const messages = {
        'in': 'Pointage d\'entrée enregistré',
        'out': 'Pointage de sortie enregistré',
        'break_start': 'Début de pause enregistré',
        'break_end': 'Fin de pause enregistrée'
      };

      toast({
        title: "Pointage enregistré",
        description: messages[type],
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Erreur",
        description: "Une erreur inattendue s'est produite",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = () => {
    const variants = {
      'out': { variant: 'destructive' as const, text: 'Absent', icon: LogOut },
      'in': { variant: 'default' as const, text: 'Présent', icon: LogIn },
      'break': { variant: 'secondary' as const, text: 'En pause', icon: Coffee }
    };
    
    const config = variants[currentStatus];
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="text-sm px-3 py-1">
        <Icon className="w-4 h-4 mr-2" />
        {config.text}
      </Badge>
    );
  };

  if (!user) {
    return null;
  }

  return (
    <Card className="p-8 max-w-2xl mx-auto">
      <div className="space-y-8">
        <div className="flex justify-between items-start">
          <div className="text-center space-y-4 flex-1">
            <div className="flex items-center justify-center gap-3">
              <h2 className="text-2xl font-bold text-foreground">
                Bonjour, {profile?.full_name || 'Utilisateur'}
              </h2>
              {getStatusBadge()}
            </div>
            {profile?.company_name && (
              <p className="text-muted-foreground">
                {profile.company_name}
                {profile.employee_id && ` • ID: ${profile.employee_id}`}
              </p>
            )}
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="w-5 h-5" />
              <span>Temps travaillé aujourd'hui: {totalWorkTime}</span>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            onClick={signOut}
            className="ml-4"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Déconnexion
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {currentStatus === 'out' && (
            <Button
              variant="punch"
              onClick={() => addPunchRecord('in')}
              className="w-full"
              disabled={isLoading}
            >
              <LogIn className="w-6 h-6 mr-3" />
              Pointer l'entrée
            </Button>
          )}

          {currentStatus === 'in' && (
            <>
              <Button
                variant="action"
                onClick={() => addPunchRecord('break_start')}
                className="w-full"
                disabled={isLoading}
              >
                <Coffee className="w-6 h-6 mr-3" />
                Commencer pause
              </Button>
              <Button
                variant="destructive"
                onClick={() => addPunchRecord('out')}
                className="w-full text-lg py-6 px-8 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                disabled={isLoading}
              >
                <LogOut className="w-6 h-6 mr-3" />
                Pointer la sortie
              </Button>
            </>
          )}

          {currentStatus === 'break' && (
            <Button
              variant="success"
              onClick={() => addPunchRecord('break_end')}
              className="w-full col-span-1 sm:col-span-2 text-lg py-6 px-8 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
              disabled={isLoading}
            >
              <LogIn className="w-6 h-6 mr-3" />
              Terminer la pause
            </Button>
          )}
        </div>

        {todayRecords.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Pointages d'aujourd'hui</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {todayRecords.slice(-5).reverse().map((record) => (
                <div key={record.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="font-medium text-foreground">
                    {record.type === 'in' && 'Entrée'}
                    {record.type === 'out' && 'Sortie'}
                    {record.type === 'break_start' && 'Début pause'}
                    {record.type === 'break_end' && 'Fin pause'}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(record.timestamp).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};