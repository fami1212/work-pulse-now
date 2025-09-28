import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { 
  Clock, 
  Calendar, 
  TrendingUp, 
  Coffee, 
  Target,
  Award,
  Activity,
  BarChart3
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface DashboardStats {
  todayHours: number;
  weekHours: number;
  monthHours: number;
  totalBreaks: number; // count of breaks today
  avgDailyHours: number;
  efficiency: number;
  todayBreakMinutes: number;
  weekDailyHours: number[]; // Monday -> Sunday
  monthBreakMinutes: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    todayHours: 0,
    weekHours: 0,
    monthHours: 0,
    totalBreaks: 0,
    avgDailyHours: 0,
    efficiency: 85,
    todayBreakMinutes: 0,
    weekDailyHours: [0, 0, 0, 0, 0, 0, 0],
    monthBreakMinutes: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardStats();
      // Set up real-time updates
      const interval = setInterval(fetchDashboardStats, 60000); // Update every minute
      return () => clearInterval(interval);
    }
  }, [user]);

  // Real-time updates with Supabase
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'punch_records',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchDashboardStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_sessions',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchDashboardStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchDashboardStats = async () => {
    if (!user) return;

    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // Today totals via RPC
      const { data: todayData } = await supabase.rpc('calculate_work_time', {
        user_uuid: user.id,
        target_date: todayStr,
      });
      const todayMinutes = todayData?.[0]?.total_work_minutes || 0;
      const todayBreakMinutes = todayData?.[0]?.total_break_minutes || 0;

      // Today's breaks count
      const { count: todayBreaksCount } = await supabase
        .from('punch_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('type', 'break_start')
        .gte('timestamp', `${todayStr}T00:00:00.000Z`)
        .lt('timestamp', `${todayStr}T23:59:59.999Z`);

      // Week range (Monday -> Sunday)
      const weekStart = new Date(today);
      const day = weekStart.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day; // Monday=1, Sunday=0
      weekStart.setDate(weekStart.getDate() + diffToMonday);

      const weekDates: string[] = [];
      const weekDateCursor = new Date(weekStart);
      for (let i = 0; i < 7; i++) {
        weekDates.push(weekDateCursor.toISOString().split('T')[0]);
        weekDateCursor.setDate(weekDateCursor.getDate() + 1);
      }

      const weekResults = await Promise.all(
        weekDates.map((d) => supabase.rpc('calculate_work_time', { user_uuid: user.id, target_date: d }))
      );
      const weekDailyMinutes = weekResults.map((r: any) => r.data?.[0]?.total_work_minutes || 0);
      const weekMinutes = weekDailyMinutes.reduce((sum: number, m: number) => sum + m, 0);

      // Month range
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().split('T')[0];

      let monthMinutes = 0;
      let monthBreakMinutes = 0;

      const { data: monthData } = await supabase
        .from('work_sessions')
        .select('total_work_minutes,total_break_minutes')
        .eq('user_id', user.id)
        .gte('date', monthStartStr)
        .lte('date', todayStr);

      if (monthData && monthData.length > 0) {
        monthMinutes = monthData.reduce((sum, s) => sum + (s.total_work_minutes || 0), 0);
        monthBreakMinutes = monthData.reduce((sum, s) => sum + (s.total_break_minutes || 0), 0);
      } else {
        // Fallback to RPC per day
        const monthDates: string[] = [];
        const mCursor = new Date(monthStart);
        while (mCursor <= today) {
          monthDates.push(mCursor.toISOString().split('T')[0]);
          mCursor.setDate(mCursor.getDate() + 1);
        }
        const monthResults = await Promise.all(
          monthDates.map((d) => supabase.rpc('calculate_work_time', { user_uuid: user.id, target_date: d }))
        );
        monthMinutes = monthResults.reduce((sum: number, r: any) => sum + (r.data?.[0]?.total_work_minutes || 0), 0);
        monthBreakMinutes = monthResults.reduce((sum: number, r: any) => sum + (r.data?.[0]?.total_break_minutes || 0), 0);
      }

      setStats({
        todayHours: Math.round((todayMinutes / 60) * 10) / 10,
        weekHours: Math.round((weekMinutes / 60) * 10) / 10,
        monthHours: Math.round((monthMinutes / 60) * 10) / 10,
        totalBreaks: todayBreaksCount || 0,
        avgDailyHours: Math.round(((monthMinutes / 60) / today.getDate()) * 10) / 10,
        efficiency: 85 + Math.floor(Math.random() * 15),
        todayBreakMinutes,
        weekDailyHours: weekDailyMinutes.map((m: number) => Math.round((m / 60) * 10) / 10),
        monthBreakMinutes,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.1,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse flex space-x-4">
          <div className="h-4 w-4 bg-primary rounded-full animate-bounce"></div>
          <div className="h-4 w-4 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="h-4 w-4 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-foreground">Tableau de bord</h2>
        <Badge variant="secondary" className="px-3 py-1">
          <Activity className="w-4 h-4 mr-2" />
          En ligne
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Aperçu</TabsTrigger>
          <TabsTrigger value="analytics">Analytiques</TabsTrigger>
          <TabsTrigger value="goals">Objectifs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div variants={itemVariants}>
              <Card className="relative overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Aujourd'hui
                  </CardTitle>
                  <Clock className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{stats.todayHours}h</div>
                  <p className="text-xs text-muted-foreground">
                    Temps travaillé
                  </p>
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent"></div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="relative overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Cette semaine
                  </CardTitle>
                  <Calendar className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{stats.weekHours}h</div>
                  <p className="text-xs text-muted-foreground">
                    Total hebdomadaire
                  </p>
                  <div className="absolute inset-0 bg-gradient-to-r from-success/5 to-transparent"></div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="relative overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Ce mois
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{stats.monthHours}h</div>
                  <p className="text-xs text-muted-foreground">
                    Total mensuel
                  </p>
                  <div className="absolute inset-0 bg-gradient-to-r from-warning/5 to-transparent"></div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="relative overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Efficacité
                  </CardTitle>
                  <Award className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{stats.efficiency}%</div>
                  <p className="text-xs text-muted-foreground">
                    Performance globale
                  </p>
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent"></div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Progression journalière
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Objectif: 8h</span>
                      <span className="font-medium">{stats.todayHours}h / 8h</span>
                    </div>
                    <Progress value={(stats.todayHours / 8) * 100} className="h-2" />
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Coffee className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{stats.totalBreaks} pauses</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Moy: {stats.avgDailyHours}h/jour</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-success" />
                    Tendances récentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Ponctualité</span>
                      <Badge variant="secondary">Excellente</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Régularité</span>
                      <Badge variant="secondary">Très bonne</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Heures sup.</span>
                      <Badge variant="outline">2h cette semaine</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Temps de travail hebdomadaire
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day, index) => {
                      const hours = stats.weekDailyHours[index] || 0;
                      const maxHours = 8;
                      return (
                        <div key={day} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>{day}</span>
                            <span className="font-medium">{hours}h</span>
                          </div>
                          <Progress value={Math.min((hours / maxHours) * 100, 100)} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-success" />
                    Tendances mensuelles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Productivité</span>
                        <Badge variant="secondary">+12%</Badge>
                      </div>
                      <Progress value={78} className="h-2" />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Ponctualité</span>
                        <Badge variant="secondary">+8%</Badge>
                      </div>
                      <Progress value={92} className="h-2" />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Temps de pause (mois)</span>
                        <Badge variant="outline">{Math.round(stats.monthBreakMinutes)} min</Badge>
                      </div>
                      <Progress value={Math.min((stats.monthBreakMinutes / 600) * 100, 100)} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-warning" />
                    Comparaison équipe
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">Votre moyenne</p>
                        <p className="text-sm text-muted-foreground">{stats.avgDailyHours}h/jour</p>
                      </div>
                      <Badge variant="secondary">Vous</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <p className="font-medium">Moyenne équipe</p>
                        <p className="text-sm text-muted-foreground">7.2h/jour</p>
                      </div>
                      <Badge variant="outline">Équipe</Badge>
                    </div>
                    
                    <div className="text-center pt-2">
                      <p className="text-sm text-muted-foreground">
                        Vous êtes {stats.avgDailyHours > 7.2 ? 'au-dessus' : 'en-dessous'} de la moyenne
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coffee className="w-5 h-5 text-muted-foreground" />
                    Analyse des pauses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="space-y-1">
                        <p className="text-2xl font-bold text-foreground">{stats.totalBreaks}</p>
                        <p className="text-xs text-muted-foreground">Pauses aujourd'hui</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-2xl font-bold text-foreground">{Math.round(stats.todayBreakMinutes)}</p>
                        <p className="text-xs text-muted-foreground">Minutes aujourd'hui</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Optimisation pauses</span>
                        <span className="font-medium">Bonne</span>
                      </div>
                      <Progress value={75} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        <TabsContent value="goals" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Objectifs quotidiens
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Temps de travail</span>
                      <Badge variant="secondary">8h</Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Progression</span>
                        <span>{Math.round((stats.todayHours / 8) * 100)}%</span>
                      </div>
                      <Progress value={(stats.todayHours / 8) * 100} className="h-2" />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Pauses optimales</span>
                      <Badge variant="outline">2-3</Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Prises aujourd'hui</span>
                        <span>{stats.totalBreaks}</span>
                      </div>
                      <Progress value={Math.min((stats.totalBreaks / 3) * 100, 100)} className="h-2" />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Ponctualité</span>
                      <Badge variant="secondary">9h00</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Objectif: Arriver avant 9h00
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-warning" />
                    Objectifs hebdomadaires
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Temps total</span>
                      <Badge variant="secondary">40h</Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Accompli</span>
                        <span>{Math.round((stats.weekHours / 40) * 100)}%</span>
                      </div>
                      <Progress value={(stats.weekHours / 40) * 100} className="h-2" />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Jours travaillés</span>
                      <Badge variant="outline">5 jours</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Objectif: Présence complète
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Efficacité</span>
                      <Badge variant={stats.efficiency >= 80 ? "secondary" : "outline"}>
                        {stats.efficiency}%
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-success" />
                    Objectifs mensuels
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Temps mensuel</span>
                      <Badge variant="secondary">160h</Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Accompli</span>
                        <span>{Math.round((stats.monthHours / 160) * 100)}%</span>
                      </div>
                      <Progress value={(stats.monthHours / 160) * 100} className="h-2" />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Régularité</span>
                      <Badge variant="secondary">Excellente</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Présence constante ce mois
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-muted-foreground" />
                    Récompenses
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {stats.efficiency >= 90 && (
                      <div className="flex items-center gap-3 p-3 bg-success/10 rounded-lg">
                        <Award className="w-6 h-6 text-success" />
                        <div>
                          <p className="font-medium text-success">Excellence</p>
                          <p className="text-xs text-muted-foreground">Efficacité {'>'} 90%</p>
                        </div>
                      </div>
                    )}
                    
                    {stats.todayHours >= 8 && (
                      <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg">
                        <Clock className="w-6 h-6 text-primary" />
                        <div>
                          <p className="font-medium text-primary">Objectif atteint</p>
                          <p className="text-xs text-muted-foreground">8h accomplies</p>
                        </div>
                      </div>
                    )}
                    
                    <div className="text-center pt-2">
                      <p className="text-sm text-muted-foreground">
                        Continuez vos efforts !
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default Dashboard;