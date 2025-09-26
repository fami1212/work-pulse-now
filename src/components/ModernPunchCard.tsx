import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Clock, 
  LogIn, 
  LogOut, 
  Coffee, 
  User, 
  MapPin,
  Wifi,
  WifiOff,
  Timer,
  Play,
  Pause,
  Square,
  Building
} from "lucide-react";
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
  avatar_url?: string;
}

export const ModernPunchCard = () => {
  const { user, signOut } = useAuth();
  const [currentStatus, setCurrentStatus] = useState<'out' | 'in' | 'break'>('out');
  const [todayRecords, setTodayRecords] = useState<PunchRecord[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [totalWorkTime, setTotalWorkTime] = useState("0h 0min");
  const [currentSessionTime, setCurrentSessionTime] = useState("0h 0min");
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastActivity, setLastActivity] = useState<Date | null>(null);
  const { toast } = useToast();

  // Real-time session timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (currentStatus === 'in' && todayRecords.length > 0) {
      const lastInRecord = todayRecords
        .filter(r => r.type === 'in')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      
      if (lastInRecord) {
        interval = setInterval(() => {
          const now = new Date();
          const start = new Date(lastInRecord.timestamp);
          const diff = now.getTime() - start.getTime();
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          setCurrentSessionTime(`${hours}h ${minutes}min`);
        }, 1000);
      }
    } else {
      setCurrentSessionTime("0h 0min");
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentStatus, todayRecords]);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
      .channel('modern-punch-updates')
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
      setLastActivity(new Date(todayRecords[todayRecords.length - 1].timestamp));
    }
  }, [todayRecords]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, company_name, employee_id, avatar_url')
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

    if (!isOnline) {
      toast({
        title: "Hors ligne",
        description: "Veuillez vous reconnecter pour pointer",
        variant: "destructive",
      });
      return;
    }

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

  const getStatusConfig = () => {
    const configs = {
      'out': { 
        variant: 'destructive' as const, 
        text: 'Absent', 
        icon: LogOut,
        color: 'text-destructive',
        bg: 'bg-destructive/10'
      },
      'in': { 
        variant: 'default' as const, 
        text: 'Présent', 
        icon: Play,
        color: 'text-success',
        bg: 'bg-success/10'
      },
      'break': { 
        variant: 'secondary' as const, 
        text: 'En pause', 
        icon: Pause,
        color: 'text-warning',
        bg: 'bg-warning/10'
      }
    };
    
    return configs[currentStatus];
  };

  const getProgressPercentage = () => {
    const totalMinutes = parseInt(totalWorkTime.split('h')[0]) * 60 + 
                        parseInt(totalWorkTime.split('h')[1]?.split('min')[0] || '0');
    return Math.min((totalMinutes / 480) * 100, 100); // 8 heures = 480 minutes
  };

  if (!user) {
    return null;
  }

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <Card className="p-8 max-w-4xl mx-auto overflow-hidden">
      <div className="space-y-8">
        {/* Header with status */}
        <div className="flex justify-between items-start">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${statusConfig.bg}`}>
                <StatusIcon className={`w-6 h-6 ${statusConfig.color}`} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  Bonjour, {profile?.full_name || 'Utilisateur'}
                </h2>
                <div className="flex items-center gap-3 mt-1">
                  <Badge variant={statusConfig.variant} className="px-3 py-1">
                    {statusConfig.text}
                  </Badge>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    {isOnline ? (
                      <><Wifi className="w-4 h-4 text-success" /> En ligne</>
                    ) : (
                      <><WifiOff className="w-4 h-4 text-destructive" /> Hors ligne</>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {profile?.company_name && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building className="w-4 h-4" />
                <span>{profile.company_name}</span>
                {profile.employee_id && (
                  <>
                    <span>•</span>
                    <span>ID: {profile.employee_id}</span>
                  </>
                )}
              </div>
            )}
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

        {/* Time tracking dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Temps total</p>
                <p className="text-2xl font-bold text-foreground">{totalWorkTime}</p>
              </div>
              <Clock className="w-8 h-8 text-primary" />
            </div>
            <div className="mt-4">
              <Progress value={getProgressPercentage()} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                Objectif: 8h ({Math.round(getProgressPercentage())}%)
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Session actuelle</p>
                <p className="text-2xl font-bold text-foreground">{currentSessionTime}</p>
              </div>
              <Timer className="w-8 h-8 text-warning" />
            </div>
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">
                {currentStatus === 'in' ? 'En cours...' : 
                 currentStatus === 'break' ? 'En pause' : 'Inactif'}
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Dernière activité</p>
                <p className="text-lg font-medium text-foreground">
                  {lastActivity ? 
                    lastActivity.toLocaleTimeString('fr-FR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    }) : 
                    'Aucune'
                  }
                </p>
              </div>
              <MapPin className="w-8 h-8 text-muted-foreground" />
            </div>
          </Card>
        </div>

        {/* Action buttons */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {currentStatus === 'out' && (
              <motion.div
                key="out"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex justify-center"
              >
                <Button
                  size="lg"
                  onClick={() => addPunchRecord('in')}
                  className="w-full max-w-md h-16 text-lg font-semibold bg-gradient-to-r from-success to-success/80 hover:from-success/90 hover:to-success/70 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                  disabled={isLoading || !isOnline}
                >
                  <LogIn className="w-6 h-6 mr-3" />
                  Commencer la journée
                </Button>
              </motion.div>
            )}

            {currentStatus === 'in' && (
              <motion.div
                key="in"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => addPunchRecord('break_start')}
                  className="h-14 text-lg font-medium border-warning text-warning hover:bg-warning/10"
                  disabled={isLoading || !isOnline}
                >
                  <Coffee className="w-5 h-5 mr-3" />
                  Pause
                </Button>
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={() => addPunchRecord('out')}
                  className="h-14 text-lg font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                  disabled={isLoading || !isOnline}
                >
                  <LogOut className="w-5 h-5 mr-3" />
                  Terminer la journée
                </Button>
              </motion.div>
            )}

            {currentStatus === 'break' && (
              <motion.div
                key="break"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex justify-center"
              >
                <Button
                  size="lg"
                  onClick={() => addPunchRecord('break_end')}
                  className="w-full max-w-md h-16 text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                  disabled={isLoading || !isOnline}
                >
                  <Play className="w-6 h-6 mr-3" />
                  Reprendre le travail
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recent activity */}
        {todayRecords.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h3 className="text-lg font-semibold text-foreground">Activité d'aujourd'hui</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {todayRecords.slice(-4).map((record, index) => {
                const icons = {
                  'in': <LogIn className="w-4 h-4 text-success" />,
                  'out': <LogOut className="w-4 h-4 text-destructive" />,
                  'break_start': <Coffee className="w-4 h-4 text-warning" />,
                  'break_end': <Play className="w-4 h-4 text-primary" />
                };
                
                const labels = {
                  'in': 'Entrée',
                  'out': 'Sortie',
                  'break_start': 'Pause',
                  'break_end': 'Reprise'
                };

                return (
                  <motion.div
                    key={record.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    {icons[record.type]}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {labels[record.type]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(record.timestamp).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </Card>
  );
};