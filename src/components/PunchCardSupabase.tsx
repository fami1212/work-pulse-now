import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, LogIn, LogOut, Coffee, User, Building, IdCard, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

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
        title: "✅ Pointage enregistré",
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
    const variants = {
      'out': { 
        variant: 'destructive' as const, 
        text: 'Absent', 
        icon: LogOut,
        gradient: 'from-red-500/10 to-red-500/5',
        border: 'border-red-200',
        color: 'text-red-600'
      },
      'in': { 
        variant: 'default' as const, 
        text: 'Présent', 
        icon: LogIn,
        gradient: 'from-green-500/10 to-green-500/5',
        border: 'border-green-200',
        color: 'text-green-600'
      },
      'break': { 
        variant: 'secondary' as const, 
        text: 'En pause', 
        icon: Coffee,
        gradient: 'from-amber-500/10 to-amber-500/5',
        border: 'border-amber-200',
        color: 'text-amber-600'
      }
    };
    
    return variants[currentStatus];
  };

  const getStatusBadge = () => {
    const config = getStatusConfig();
    const Icon = config.icon;
    
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r ${config.gradient} border ${config.border} backdrop-blur-sm`}
      >
        <Icon className={`w-4 h-4 mr-2 ${config.color}`} />
        <span className={`font-semibold ${config.color}`}>{config.text}</span>
      </motion.div>
    );
  };

  if (!user) {
    return null;
  }

  return (
    <Card className="p-8 max-w-4xl mx-auto bg-gradient-to-br from-white to-gray-50/80 border-0 shadow-2xl rounded-3xl relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-full blur-xl" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-r from-secondary/5 to-primary/5 rounded-full blur-xl" />
      </div>

      <div className="relative space-y-8 z-10">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex-1 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-r from-primary to-primary/80 rounded-2xl shadow-lg">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    Bonjour, {profile?.full_name || 'Utilisateur'}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {profile?.company_name && (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Building className="w-4 h-4" />
                        {profile.company_name}
                      </div>
                    )}
                    {profile?.employee_id && (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <IdCard className="w-4 h-4" />
                        ID: {profile.employee_id}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {getStatusBadge()}
            </div>

            {/* Work Time Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 max-w-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Temps travaillé</p>
                    <p className="text-xl font-bold text-gray-900">{totalWorkTime}</p>
                  </div>
                </div>
                <Clock className="w-8 h-8 text-blue-400 opacity-60" />
              </div>
            </motion.div>
          </div>

          <Button 
            variant="outline" 
            onClick={signOut}
            className="border-2 border-gray-300 hover:border-gray-400 bg-white/80 backdrop-blur-sm rounded-xl px-6 py-2 h-auto"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Déconnexion
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {currentStatus === 'out' && (
              <motion.div
                key="out-state"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex justify-center"
              >
                <Button
                  onClick={() => addPunchRecord('in')}
                  disabled={isLoading}
                  className="w-full max-w-sm text-lg py-8 px-8 rounded-2xl font-bold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 border-0"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3" />
                  ) : (
                    <LogIn className="w-6 h-6 mr-3" />
                  )}
                  Commencer la journée
                </Button>
              </motion.div>
            )}

            {currentStatus === 'in' && (
              <motion.div
                key="in-state"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-4"
              >
                <Button
                  onClick={() => addPunchRecord('break_start')}
                  disabled={isLoading}
                  className="w-full text-lg py-6 px-6 rounded-2xl font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 border-0 h-auto min-h-[80px]"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  ) : (
                    <Coffee className="w-5 h-5 mr-2" />
                  )}
                  Pause
                </Button>
                <Button
                  onClick={() => addPunchRecord('out')}
                  disabled={isLoading}
                  className="w-full text-lg py-6 px-6 rounded-2xl font-semibold bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 border-0 h-auto min-h-[80px]"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  ) : (
                    <LogOut className="w-5 h-5 mr-2" />
                  )}
                  Fin de journée
                </Button>
              </motion.div>
            )}

            {currentStatus === 'break' && (
              <motion.div
                key="break-state"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex justify-center"
              >
                <Button
                  onClick={() => addPunchRecord('break_end')}
                  disabled={isLoading}
                  className="w-full max-w-sm text-lg py-8 px-8 rounded-2xl font-bold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 border-0"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3" />
                  ) : (
                    <LogIn className="w-6 h-6 mr-3" />
                  )}
                  Reprendre le travail
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Today's Records */}
        {todayRecords.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Pointages d'aujourd'hui
            </h3>
            <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
              {todayRecords.slice(-6).reverse().map((record, index) => (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex justify-between items-center p-4 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      record.type === 'in' ? 'bg-green-100 text-green-600' :
                      record.type === 'out' ? 'bg-red-100 text-red-600' :
                      record.type === 'break_start' ? 'bg-amber-100 text-amber-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      {record.type === 'in' && <LogIn className="w-4 h-4" />}
                      {record.type === 'out' && <LogOut className="w-4 h-4" />}
                      {record.type === 'break_start' && <Coffee className="w-4 h-4" />}
                      {record.type === 'break_end' && <Coffee className="w-4 h-4" />}
                    </div>
                    <span className="font-medium text-gray-800">
                      {record.type === 'in' && 'Entrée'}
                      {record.type === 'out' && 'Sortie'}
                      {record.type === 'break_start' && 'Début pause'}
                      {record.type === 'break_end' && 'Fin pause'}
                    </span>
                  </div>
                  <span className="text-gray-600 font-mono font-medium">
                    {new Date(record.timestamp).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </Card>
  );
};