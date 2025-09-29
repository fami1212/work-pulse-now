import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  BarChart3,
  Edit,
  Trash2,
  MoreVertical
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import GoalForm from "./GoalForm";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface DashboardStats {
  todayHours: number;
  weekHours: number;
  monthHours: number;
  totalBreaks: number;
  avgDailyHours: number;
  efficiency: number;
  todayBreakMinutes: number;
  weekDailyHours: number[];
  monthBreakMinutes: number;
}

interface Goal {
  id: string;
  title: string;
  description?: string;
  target_value: number;
  current_value: number;
  unit: string;
  status: 'active' | 'completed' | 'failed' | 'paused';
  target_date?: string;
  created_at: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
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
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    if (user) {
      fetchDashboardStats();
      fetchGoals();
      const interval = setInterval(fetchDashboardStats, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

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

      // Today totals
      const { data: todayData, error: todayError } = await supabase.rpc('calculate_work_time', {
        user_uuid: user.id,
        target_date: todayStr,
      });

      if (todayError) throw todayError;

      const todayMinutes = todayData?.[0]?.total_work_minutes || 0;
      const todayBreakMinutes = todayData?.[0]?.total_break_minutes || 0;

      // Today's breaks count
      const { count: todayBreaksCount, error: breaksError } = await supabase
        .from('punch_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('type', 'break_start')
        .gte('timestamp', `${todayStr}T00:00:00.000Z`)
        .lt('timestamp', `${todayStr}T23:59:59.999Z`);

      if (breaksError) throw breaksError;

      // Week range (Monday -> Sunday)
      const weekStart = new Date(today);
      const day = weekStart.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      weekStart.setDate(weekStart.getDate() + diffToMonday);

      const weekDates: string[] = [];
      const weekDateCursor = new Date(weekStart);
      for (let i = 0; i < 7; i++) {
        weekDates.push(weekDateCursor.toISOString().split('T')[0]);
        weekDateCursor.setDate(weekDateCursor.getDate() + 1);
      }

      const weekResults = await Promise.all(
        weekDates.map((date) => 
          supabase.rpc('calculate_work_time', { 
            user_uuid: user.id, 
            target_date: date 
          })
        )
      );

      const weekDailyMinutes = weekResults.map((result: any) => 
        result.data?.[0]?.total_work_minutes || 0
      );
      const weekMinutes = weekDailyMinutes.reduce((sum: number, minutes: number) => sum + minutes, 0);

      // Month range
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().split('T')[0];

      let monthMinutes = 0;
      let monthBreakMinutes = 0;

      const { data: monthData, error: monthError } = await supabase
        .from('work_sessions')
        .select('total_work_minutes, total_break_minutes')
        .eq('user_id', user.id)
        .gte('date', monthStartStr)
        .lte('date', todayStr);

      if (monthError) throw monthError;

      if (monthData && monthData.length > 0) {
        monthMinutes = monthData.reduce((sum, session) => sum + (session.total_work_minutes || 0), 0);
        monthBreakMinutes = monthData.reduce((sum, session) => sum + (session.total_break_minutes || 0), 0);
      } else {
        // Fallback to RPC per day
        const monthDates: string[] = [];
        const monthCursor = new Date(monthStart);
        while (monthCursor <= today) {
          monthDates.push(monthCursor.toISOString().split('T')[0]);
          monthCursor.setDate(monthCursor.getDate() + 1);
        }

        const monthResults = await Promise.all(
          monthDates.map((date) => 
            supabase.rpc('calculate_work_time', { 
              user_uuid: user.id, 
              target_date: date 
            })
          )
        );

        monthMinutes = monthResults.reduce((sum: number, result: any) => 
          sum + (result.data?.[0]?.total_work_minutes || 0), 0
        );
        monthBreakMinutes = monthResults.reduce((sum: number, result: any) => 
          sum + (result.data?.[0]?.total_break_minutes || 0), 0
        );
      }

      const avgDailyHours = today.getDate() > 0 ? (monthMinutes / 60) / today.getDate() : 0;

      setStats({
        todayHours: Math.round((todayMinutes / 60) * 10) / 10,
        weekHours: Math.round((weekMinutes / 60) * 10) / 10,
        monthHours: Math.round((monthMinutes / 60) * 10) / 10,
        totalBreaks: todayBreaksCount || 0,
        avgDailyHours: Math.round(avgDailyHours * 10) / 10,
        efficiency: calculateEfficiency(todayMinutes, todayBreakMinutes),
        todayBreakMinutes,
        weekDailyHours: weekDailyMinutes.map((minutes: number) => Math.round((minutes / 60) * 10) / 10),
        monthBreakMinutes,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les statistiques",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateEfficiency = (workMinutes: number, breakMinutes: number): number => {
    if (workMinutes === 0) return 85;
    
    const totalTime = workMinutes + breakMinutes;
    const efficiency = (workMinutes / totalTime) * 100;
    return Math.min(Math.max(Math.round(efficiency), 70), 95);
  };

  const fetchGoals = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setGoals(data || []);
    } catch (error) {
      console.error('Error fetching goals:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les objectifs",
        variant: "destructive",
      });
    }
  };

  const updateGoalStatus = async (goalId: string, newStatus: Goal['status'], currentValue?: number) => {
    try {
      const updateData: any = { status: newStatus };
      if (currentValue !== undefined) {
        updateData.current_value = currentValue;
      }

      const { error } = await supabase
        .from('goals')
        .update(updateData)
        .eq('id', goalId);

      if (error) throw error;

      fetchGoals();
    } catch (error) {
      console.error('Error updating goal status:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour l'objectif",
        variant: "destructive",
      });
    }
  };

  const deleteGoal = async (goalId: string) => {
    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', goalId);

      if (error) throw error;

      toast({
        title: "Objectif supprimé",
        description: "L'objectif a été supprimé avec succès.",
      });

      fetchGoals();
    } catch (error) {
      console.error('Error deleting goal:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la suppression.",
        variant: "destructive",
      });
    }
  };

  const getGoalCurrentValue = (goal: Goal): number => {
    if (goal.unit === 'hours') {
      if (goal.title.toLowerCase().includes('mensuel')) {
        return stats.monthHours;
      } else if (goal.title.toLowerCase().includes('hebdomadaire')) {
        return stats.weekHours;
      } else {
        return stats.todayHours;
      }
    } else if (goal.unit === 'sessions') {
      return Math.floor(stats.monthHours / 8);
    } else if (goal.unit === 'percentage') {
      return stats.efficiency;
    }
    return goal.current_value;
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
                  <Calendar className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{stats.weekHours}h</div>
                  <p className="text-xs text-muted-foreground">
                    Total hebdomadaire
                  </p>
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-transparent"></div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="relative overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Ce mois
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{stats.monthHours}h</div>
                  <p className="text-xs text-muted-foreground">
                    Total mensuel
                  </p>
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-transparent"></div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="relative overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Efficacité
                  </CardTitle>
                  <Award className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{stats.efficiency}%</div>
                  <p className="text-xs text-muted-foreground">
                    Performance globale
                  </p>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent"></div>
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
                    <BarChart3 className="w-5 h-5 text-green-500" />
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
                    <TrendingUp className="w-5 h-5 text-green-500" />
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
                    <Activity className="w-5 h-5 text-orange-500" />
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
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Mes objectifs</h3>
              <p className="text-sm text-muted-foreground">
                Définissez et suivez vos objectifs personnels
              </p>
            </div>
            <GoalForm onGoalCreated={fetchGoals} />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {goals.map((goal) => {
              const actualCurrentValue = getGoalCurrentValue(goal);
              const progress = goal.target_value > 0 ? (actualCurrentValue / goal.target_value) * 100 : 0;
              const isCompleted = goal.status === 'completed';
              const isOverdue = goal.target_date && new Date(goal.target_date) < new Date() && !isCompleted;
              
              // Auto-update goal progress
              useEffect(() => {
                if (goal.status === 'active') {
                  if (actualCurrentValue >= goal.target_value) {
                    updateGoalStatus(goal.id, 'completed', actualCurrentValue);
                  } else if (isOverdue) {
                    updateGoalStatus(goal.id, 'failed', actualCurrentValue);
                  } else if (actualCurrentValue !== goal.current_value) {
                    updateGoalStatus(goal.id, 'active', actualCurrentValue);
                  }
                }
              }, [actualCurrentValue, goal]);

              return (
                <motion.div key={goal.id} variants={itemVariants}>
                  <Card className={`relative overflow-hidden ${
                    isCompleted ? 'border-green-500' : 
                    isOverdue ? 'border-red-500' : ''
                  }`}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Target className={`w-5 h-5 ${
                            isCompleted ? 'text-green-500' : 
                            isOverdue ? 'text-red-500' : 'text-primary'
                          }`} />
                          <span className="text-sm">{goal.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            isCompleted ? "secondary" : 
                            isOverdue ? "destructive" : "outline"
                          }>
                            {goal.status === 'active' ? 'En cours' : 
                             goal.status === 'completed' ? 'Terminé' : 
                             goal.status === 'paused' ? 'Pausé' : 'Échoué'}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <GoalForm 
                                goal={goal} 
                                onGoalCreated={fetchGoals}
                                trigger={
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Modifier
                                  </DropdownMenuItem>
                                }
                              />
                              <DropdownMenuItem 
                                onClick={() => deleteGoal(goal.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardTitle>
                      {goal.description && (
                        <p className="text-xs text-muted-foreground">{goal.description}</p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Objectif: {goal.target_value}{goal.unit === 'hours' ? 'h' : goal.unit === 'percentage' ? '%' : ' ' + goal.unit}</span>
                          <span className="font-medium">
                            {Math.round(actualCurrentValue * 10) / 10}
                            {goal.unit === 'hours' ? 'h' : goal.unit === 'percentage' ? '%' : ' ' + goal.unit}
                          </span>
                        </div>
                        <Progress 
                          value={Math.min(progress, 100)} 
                          className={`h-2 ${
                            isCompleted ? '[&>div]:bg-green-500' : 
                            isOverdue ? '[&>div]:bg-red-500' : ''
                          }`}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{Math.round(progress)}% accompli</span>
                          {goal.target_date && (
                            <span>Échéance: {new Date(goal.target_date).toLocaleDateString('fr-FR')}</span>
                          )}
                        </div>
                      </div>
                      
                      {isCompleted && (
                        <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-lg">
                          <Award className="w-4 h-4 text-green-500" />
                          <span className="text-xs font-medium text-green-500">Objectif atteint !</span>
                        </div>
                      )}
                      
                      {isOverdue && (
                        <div className="flex items-center gap-2 p-2 bg-red-500/10 rounded-lg">
                          <Clock className="w-4 h-4 text-red-500" />
                          <span className="text-xs font-medium text-red-500">Échéance dépassée</span>
                        </div>
                      )}
                    </CardContent>
                    
                    {isCompleted && (
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-transparent"></div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
            
            {goals.length === 0 && (
              <motion.div variants={itemVariants} className="col-span-full">
                <Card className="text-center p-8">
                  <CardContent>
                    <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Aucun objectif défini</h3>
                    <p className="text-muted-foreground text-sm">
                      Définissez vos objectifs pour suivre votre progression et améliorer vos performances.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default Dashboard;