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
  Building,
  Activity,
  QrCode
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PunchWithQR } from "./PunchWithQR";

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

  const getRecordIcon = (type: string) => {
    switch (type) {
      case 'in': return <LogIn className="w-4 h-4 text-success" />;
      case 'out': return <LogOut className="w-4 h-4 text-destructive" />;
      case 'break_start': return <Coffee className="w-4 h-4 text-warning" />;
      case 'break_end': return <Coffee className="w-4 h-4 text-primary" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getRecordLabel = (type: string) => {
    switch (type) {
      case 'in': return 'Entrée';
      case 'out': return 'Sortie';
      case 'break_start': return 'Début pause';
      case 'break_end': return 'Fin pause';
      default: return type;
    }
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  if (!user) {
    return null;
  }

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className="p-6 bg-gradient-to-br from-card to-card/80 border-2 border-border/50 shadow-xl backdrop-blur-sm">
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-3">
            <motion.div 
              className="flex items-center gap-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div 
                className={`p-4 rounded-full ${statusConfig.bg} shadow-lg`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <StatusIcon className={`w-8 h-8 ${statusConfig.color}`} />
              </motion.div>
              <div>
                <motion.h2 
                  className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  Bonjour, {profile?.full_name || 'Utilisateur'}
                </motion.h2>
                <motion.div 
                  className="flex items-center gap-4 mt-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <Badge variant={statusConfig.variant} className="px-4 py-2 text-sm font-semibold">
                    {statusConfig.text}
                  </Badge>
                  <motion.div 
                    className="flex items-center gap-2 text-sm"
                    animate={{ 
                      color: isOnline ? 'hsl(var(--success))' : 'hsl(var(--destructive))' 
                    }}
                  >
                    {isOnline ? (
                      <><Wifi className="w-4 h-4" /> En ligne</>
                    ) : (
                      <><WifiOff className="w-4 h-4" /> Hors ligne</>
                    )}
                  </motion.div>
                </motion.div>
              </div>
            </motion.div>

            {profile?.company_name && (
              <motion.div 
                className="flex items-center gap-2 text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <Building className="w-4 h-4" />
                <span>{profile.company_name}</span>
                {profile.employee_id && (
                  <>
                    <span>•</span>
                    <span>ID: {profile.employee_id}</span>
                  </>
                )}
              </motion.div>
            )}
          </div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Button 
              variant="outline" 
              onClick={signOut}
              className="hover:scale-105 transition-transform"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </motion.div>
        </div>

        {/* Live Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Temps total</p>
                  <motion.p 
                    className="text-2xl font-bold text-foreground"
                    key={totalWorkTime}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    {totalWorkTime}
                  </motion.p>
                </div>
                <Clock className="w-8 h-8 text-primary" />
              </div>
              <div className="mt-3">
                <Progress value={getProgressPercentage()} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  Objectif: 8h ({Math.round(getProgressPercentage())}%)
                </p>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card className="p-4 bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Session actuelle</p>
                  <motion.p 
                    className="text-2xl font-bold text-foreground"
                    key={currentSessionTime}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    {currentSessionTime}
                  </motion.p>
                </div>
                <motion.div
                  animate={{ 
                    rotate: currentStatus === 'in' ? 360 : 0,
                    scale: currentStatus === 'in' ? [1, 1.1, 1] : 1
                  }}
                  transition={{ 
                    rotate: { duration: 2, repeat: currentStatus === 'in' ? Infinity : 0 },
                    scale: { duration: 1, repeat: currentStatus === 'in' ? Infinity : 0 }
                  }}
                >
                  <Timer className="w-8 h-8 text-warning" />
                </motion.div>
              </div>
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">
                  {currentStatus === 'in' ? (
                    <motion.span
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      🔴 En cours...
                    </motion.span>
                  ) : 
                   currentStatus === 'break' ? '⏸️ En pause' : '⭕ Inactif'}
                </p>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <Card className="p-4 bg-gradient-to-br from-muted/50 to-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Dernière activité</p>
                  <p className="text-lg font-medium text-foreground">
                    {lastActivity ? formatTime(lastActivity) : 'Aucune'}
                  </p>
                </div>
                <MapPin className="w-8 h-8 text-muted-foreground" />
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Modern Action Buttons */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {currentStatus === 'out' && (
              <motion.div
                key="out"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="space-y-4"
              >
                <div className="flex justify-center">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full max-w-md"
                  >
                    <Button
                      size="lg"
                      onClick={() => addPunchRecord('in')}
                      className="w-full h-20 text-xl font-bold bg-gradient-to-r from-success to-success/80 hover:from-success/90 hover:to-success/70 shadow-2xl hover:shadow-3xl border-0 relative overflow-hidden group"
                      disabled={isLoading || !isOnline}
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"
                        initial={{ x: '-100%' }}
                        whileHover={{ x: '100%' }}
                        transition={{ duration: 0.6 }}
                      />
                      <LogIn className="w-8 h-8 mr-4" />
                      <span>Commencer la journée</span>
                      {isLoading && (
                        <motion.div
                          className="ml-3"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                        </motion.div>
                      )}
                    </Button>
                  </motion.div>
                </div>
                <div className="flex justify-center">
                  <PunchWithQR punchType="in" onSuccess={fetchTodayRecords} />
                </div>
              </motion.div>
            )}

            {currentStatus === 'in' && (
              <motion.div
                key="in"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => addPunchRecord('break_start')}
                      className="w-full h-16 text-lg font-medium border-2 border-warning text-warning hover:bg-warning/10 hover:border-warning/80 shadow-lg relative overflow-hidden group"
                      disabled={isLoading || !isOnline}
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-warning/10 to-transparent"
                        initial={{ x: '-100%' }}
                        whileHover={{ x: '100%' }}
                        transition={{ duration: 0.6 }}
                      />
                      <Coffee className="w-6 h-6 mr-3" />
                      Pause
                    </Button>
                  </motion.div>
                  
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      size="lg"
                      variant="destructive"
                      onClick={() => addPunchRecord('out')}
                      className="w-full h-16 text-lg font-semibold shadow-xl hover:shadow-2xl relative overflow-hidden group"
                      disabled={isLoading || !isOnline}
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"
                        initial={{ x: '-100%' }}
                        whileHover={{ x: '100%' }}
                        transition={{ duration: 0.6 }}
                      />
                      <LogOut className="w-6 h-6 mr-3" />
                      Terminer la journée
                    </Button>
                  </motion.div>
                </div>
                <div className="flex justify-center gap-2">
                  <PunchWithQR punchType="break_start" onSuccess={fetchTodayRecords} />
                  <PunchWithQR punchType="out" onSuccess={fetchTodayRecords} />
                </div>
              </motion.div>
            )}

            {currentStatus === 'break' && (
              <motion.div
                key="break"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="space-y-4"
              >
                <div className="flex justify-center">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full max-w-md"
                  >
                    <Button
                      size="lg"
                      onClick={() => addPunchRecord('break_end')}
                      className="w-full h-20 text-xl font-bold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-2xl hover:shadow-3xl relative overflow-hidden group"
                      disabled={isLoading || !isOnline}
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"
                        initial={{ x: '-100%' }}
                        whileHover={{ x: '100%' }}
                        transition={{ duration: 0.6 }}
                      />
                      <Play className="w-8 h-8 mr-4" />
                      <span>Reprendre le travail</span>
                      {isLoading && (
                        <motion.div
                          className="ml-3"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                        </motion.div>
                      )}
                    </Button>
                  </motion.div>
                </div>
                <div className="flex justify-center">
                  <PunchWithQR punchType="break_end" onSuccess={fetchTodayRecords} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Today's Activity Timeline */}
        {todayRecords.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="mt-8"
          >
            <Card className="p-4 bg-muted/30">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Activité d'aujourd'hui
              </h3>
              <div className="space-y-2">
                {todayRecords
                  .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                  .map((record, index) => (
                  <motion.div
                    key={record.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-3 p-2 bg-background/50 rounded-lg"
                  >
                    {getRecordIcon(record.type)}
                    <span className="text-sm font-medium flex-1">
                      {getRecordLabel(record.type)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(new Date(record.timestamp))}
                    </span>
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
      </Card>
    </div>
  );
};