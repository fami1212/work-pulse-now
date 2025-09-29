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
  totalBreaks: number; // count of breaks today
  avgDailyHours: number;
  efficiency: number;
  todayBreakMinutes: number;
  weekDailyHours: number[]; // Monday -> Sunday
  monthBreakMinutes: number;
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
  const [goals, setGoals] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchDashboardStats();
      fetchGoals();
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
    }
  };

  const updateGoalStatus = async (goalId: string, newStatus: 'active' | 'completed' | 'failed' | 'paused', currentValue?: number) => {
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
            {goals.map((goal, index) => {
              const progress = goal.target_value > 0 ? (goal.current_value / goal.target_value) * 100 : 0;
              const isCompleted = goal.status === 'completed';
              const isOverdue = goal.target_date && new Date(goal.target_date) < new Date() && !isCompleted;
              
              // Update current value based on goal type
              let actualCurrentValue = goal.current_value;
              if (goal.unit === 'hours') {
                if (goal.title.toLowerCase().includes('mensuel')) {
                  actualCurrentValue = stats.monthHours;
                } else if (goal.title.toLowerCase().includes('hebdomadaire')) {
                  actualCurrentValue = stats.weekHours;
                } else {
                  actualCurrentValue = stats.todayHours;
                }
              } else if (goal.unit === 'sessions') {
                // Could track work sessions per month
                actualCurrentValue = Math.floor(stats.monthHours / 8); // Estimate sessions
              } else if (goal.unit === 'percentage') {
                actualCurrentValue = stats.efficiency;
              }
              
              const actualProgress = goal.target_value > 0 ? (actualCurrentValue / goal.target_value) * 100 : 0;
              
              // Auto-update goal status based on progress
              useEffect(() => {
                if (actualCurrentValue !== goal.current_value && actualCurrentValue >= goal.target_value && goal.status === 'active') {
                  updateGoalStatus(goal.id, 'completed', actualCurrentValue);
                } else if (actualCurrentValue !== goal.current_value && goal.status === 'active') {
                  updateGoalStatus(goal.id, 'active', actualCurrentValue);
                } else if (isOverdue && goal.status === 'active' && actualCurrentValue < goal.target_value) {
                  updateGoalStatus(goal.id, 'failed', actualCurrentValue);
                }
              }, [actualCurrentValue, goal.current_value, goal.target_value, goal.status, isOverdue]);
              
              return (
                <motion.div key={goal.id} variants={itemVariants}>
                  <Card className={`relative overflow-hidden ${isCompleted ? 'border-success' : isOverdue ? 'border-destructive' : ''}`}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Target className={`w-5 h-5 ${isCompleted ? 'text-success' : isOverdue ? 'text-destructive' : 'text-primary'}`} />
                          <span className="text-sm">{goal.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={isCompleted ? "secondary" : isOverdue ? "destructive" : "outline"}>
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
                                className="text-destructive"
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
                          value={Math.min(actualProgress, 100)} 
                          className={`h-2 ${isCompleted ? '[&>div]:bg-success' : isOverdue ? '[&>div]:bg-destructive' : ''}`}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{Math.round(actualProgress)}% accompli</span>
                          {goal.target_date && (
                            <span>Échéance: {new Date(goal.target_date).toLocaleDateString('fr-FR')}</span>
                          )}
                        </div>
                      </div>
                      
                      {isCompleted && (
                        <div className="flex items-center gap-2 p-2 bg-success/10 rounded-lg">
                          <Award className="w-4 h-4 text-success" />
                          <span className="text-xs font-medium text-success">Objectif atteint !</span>
                        </div>
                      )}
                      
                      {isOverdue && (
                        <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-lg">
                          <Clock className="w-4 h-4 text-destructive" />
                          <span className="text-xs font-medium text-destructive">Échéance dépassée</span>
                        </div>
                      )}
                    </CardContent>
                    
                    {isCompleted && (
                      <div className="absolute inset-0 bg-gradient-to-r from-success/5 to-transparent"></div>
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