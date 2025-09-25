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
  totalBreaks: number;
  avgDailyHours: number;
  efficiency: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    todayHours: 0,
    weekHours: 0,
    monthHours: 0,
    totalBreaks: 0,
    avgDailyHours: 0,
    efficiency: 85
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
      const today = new Date().toISOString().split('T')[0];
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const monthStart = new Date();
      monthStart.setDate(1);

      // Fetch today's work time
      const { data: todayData } = await supabase
        .rpc('calculate_work_time', {
          user_uuid: user.id,
          target_date: today
        });

      // Fetch week stats
      const { data: weekData } = await supabase
        .from('work_sessions')
        .select('total_work_minutes')
        .eq('user_id', user.id)
        .gte('date', weekStart.toISOString().split('T')[0]);

      // Fetch month stats
      const { data: monthData } = await supabase
        .from('work_sessions')
        .select('total_work_minutes')
        .eq('user_id', user.id)
        .gte('date', monthStart.toISOString().split('T')[0]);

      // Calculate stats
      const todayMinutes = todayData?.[0]?.total_work_minutes || 0;
      const weekMinutes = weekData?.reduce((sum, session) => sum + session.total_work_minutes, 0) || 0;
      const monthMinutes = monthData?.reduce((sum, session) => sum + session.total_work_minutes, 0) || 0;

      setStats({
        todayHours: Math.round((todayMinutes / 60) * 10) / 10,
        weekHours: Math.round((weekMinutes / 60) * 10) / 10,
        monthHours: Math.round((monthMinutes / 60) * 10) / 10,
        totalBreaks: 3, // Mock data
        avgDailyHours: Math.round(((monthMinutes / 60) / new Date().getDate()) * 10) / 10,
        efficiency: 85 + Math.floor(Math.random() * 15)
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
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle>Analyse détaillée</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Les graphiques détaillés et analyses avancées seront bientôt disponibles.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="goals" className="space-y-6">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle>Objectifs personnels</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Définissez et suivez vos objectifs de productivité.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default Dashboard;