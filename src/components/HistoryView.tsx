import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, eachDayOfInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  CalendarIcon, 
  Download, 
  Filter, 
  Clock, 
  Coffee, 
  LogIn, 
  LogOut,
  Search,
  FileText,
  Calendar as CalendarRangeIcon,
  BarChart3,
  TrendingUp,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PunchRecord {
  id: string;
  type: 'in' | 'out' | 'break_start' | 'break_end';
  timestamp: string;
  user_id: string;
}

interface WorkSession {
  date: string;
  total_work_minutes: number;
  total_break_minutes: number;
  records: PunchRecord[];
}

const HistoryView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ 
    from: startOfMonth(new Date()), 
    to: endOfMonth(new Date()) 
  });
  const [showDateRange, setShowDateRange] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user, selectedDate]);

  // Real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('history-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'punch_records',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchHistory = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days

      // Fetch punch records
      const { data: records } = await supabase
        .from('punch_records')
        .select('*')
        .eq('user_id', user.id)
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: false });

      // Fetch work sessions
      const { data: workSessions } = await supabase
        .from('work_sessions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      // Group sessions by date using both work_sessions (if any) and raw records
      const groupedSessions: { [key: string]: WorkSession } = {};
      
      // Seed from work_sessions
      (workSessions || []).forEach(session => {
        groupedSessions[session.date] = {
          date: session.date,
          total_work_minutes: session.total_work_minutes,
          total_break_minutes: session.total_break_minutes,
          records: []
        };
      });

      // Ensure dates from records exist and push records
      (records || []).forEach(record => {
        const date = record.timestamp.split('T')[0];
        if (!groupedSessions[date]) {
          groupedSessions[date] = {
            date,
            total_work_minutes: 0,
            total_break_minutes: 0,
            records: []
          };
        }
        if (['in', 'out', 'break_start', 'break_end'].includes(record.type)) {
          groupedSessions[date].records.push(record as PunchRecord);
        }
      });

      // Sort records inside each session
      Object.values(groupedSessions).forEach(s => {
        s.records.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      });

      // Calculate totals per day via RPC to ensure accurate work/break minutes
      const sessionsArray = Object.values(groupedSessions);
      await Promise.all(
        sessionsArray.map(async (s) => {
          const { data } = await supabase.rpc('calculate_work_time', {
            user_uuid: user.id,
            target_date: s.date,
          });
          if (data && data[0]) {
            s.total_work_minutes = data[0].total_work_minutes || 0;
            s.total_break_minutes = data[0].total_break_minutes || 0;
          }
        })
      );

      // Sort sessions by date desc for display
      const sorted = sessionsArray.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSessions(sorted);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportData = async () => {
    if (!user) return;

    setExportLoading(true);
    try {
      // Récupérer les données dans la plage sélectionnée
      const { data: records } = await supabase
        .from('punch_records')
        .select('*')
        .eq('user_id', user.id)
        .gte('timestamp', dateRange.from.toISOString())
        .lte('timestamp', dateRange.to.toISOString())
        .order('timestamp', { ascending: true });

      const { data: workSessions } = await supabase
        .from('work_sessions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', dateRange.from.toISOString().split('T')[0])
        .lte('date', dateRange.to.toISOString().split('T')[0])
        .order('date', { ascending: true });

      // Créer un CSV structuré avec séparateurs corrects
      const headers = [
        'Date',
        'Jour de la semaine',
        'Type de pointage',
        'Heure',
        'Heures travaillées',
        'Minutes travaillées',
        'Heures de pause',
        'Minutes de pause',
        'Statut'
      ];

      let csvContent = headers.join(';') + '\n';
      
      // Créer un map des sessions de travail pour un accès rapide
      const workSessionsMap = new Map();
      workSessions?.forEach(session => {
        workSessionsMap.set(session.date, session);
      });

      // Générer toutes les dates dans l'intervalle
      const allDates = eachDayOfInterval({
        start: dateRange.from,
        end: dateRange.to
      });

      // Traiter chaque date dans l'intervalle
      allDates.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = format(date, 'EEEE', { locale: fr });
        const session = workSessionsMap.get(dateStr);
        
        // Ajouter le résumé de la journée si disponible
        if (session) {
          const workHours = (session.total_work_minutes / 60).toFixed(2);
          const breakHours = (session.total_break_minutes / 60).toFixed(2);
          const status = session.total_work_minutes > 0 ? 'COMPLET' : 'INCOMPLET';
          
          csvContent += [
            dateStr,
            dayOfWeek,
            'RÉSUMÉ JOURNALIER',
            '',
            workHours.replace('.', ','),
            session.total_work_minutes.toString(),
            breakHours.replace('.', ','),
            session.total_break_minutes.toString(),
            status
          ].join(';') + '\n';
        } else {
          // Ajouter une ligne pour les jours sans données
          csvContent += [
            dateStr,
            dayOfWeek,
            'AUCUN POINTAGE',
            '',
            '0,00',
            '0',
            '0,00',
            '0',
            'ABSENT'
          ].join(';') + '\n';
        }

        // Ajouter les pointages détaillés pour cette date
        const dayRecords = records?.filter(record => 
          record.timestamp.startsWith(dateStr)
        ) || [];

        dayRecords.forEach(record => {
          const time = format(new Date(record.timestamp), 'HH:mm');
          const typeLabel = getRecordLabel(record.type);
          
          csvContent += [
            dateStr,
            dayOfWeek,
            typeLabel,
            time,
            '',
            '',
            '',
            '',
            'POINTAGE'
          ].join(';') + '\n';
        });

        // Ajouter une ligne vide entre les jours pour une meilleure lisibilité
        csvContent += ';;;;;;;;\n';
      });

      // Ajouter un en-tête avec les informations de la période
      const headerInfo = [
        `Historique des pointages du ${format(dateRange.from, 'dd/MM/yyyy')} au ${format(dateRange.to, 'dd/MM/yyyy')}`,
        `Généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm')}`,
        `Utilisateur: ${user.email}`,
        '',
        '',
        '',
        '',
        '',
        ''
      ];

      const finalCSV = headerInfo.join(';') + '\n' + csvContent;

      const blob = new Blob(['\uFEFF' + finalCSV], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `historique-pointage-${format(dateRange.from, 'yyyy-MM-dd')}-${format(dateRange.to, 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export réussi",
        description: "L'historique a été téléchargé avec succès",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Erreur d'export",
        description: "Impossible de télécharger l'historique",
        variant: "destructive",
      });
    } finally {
      setExportLoading(false);
    }
  };

  const getRecordIcon = (type: string) => {
    switch (type) {
      case 'in': return <LogIn className="w-4 h-4 text-green-600" />;
      case 'out': return <LogOut className="w-4 h-4 text-red-600" />;
      case 'break_start': return <Coffee className="w-4 h-4 text-amber-600" />;
      case 'break_end': return <Coffee className="w-4 h-4 text-blue-600" />;
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

  const getDayStatus = (session: WorkSession) => {
    if (session.records.length === 0) return "absent";
    if (session.records.some(r => r.type === 'in') && !session.records.some(r => r.type === 'out')) return "incomplet";
    return "complet";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "complet": return "bg-green-100 text-green-800 border-green-200";
      case "incomplet": return "bg-amber-100 text-amber-800 border-amber-200";
      case "absent": return "bg-gray-100 text-gray-800 border-gray-200";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "complet": return "Journée complète";
      case "incomplet": return "Journée incomplète";
      case "absent": return "Absent";
      default: return "Inconnu";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Chargement de l'historique...</p>
        </div>
      </div>
    );
  }

  // Derived metrics for current month
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthSessions = sessions.filter(s => {
    const d = new Date(s.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const monthWorkHours = Math.round(((monthSessions.reduce((sum, s) => sum + s.total_work_minutes, 0) / 60) * 10)) / 10;
  const monthBreakHours = Math.round(((monthSessions.reduce((sum, s) => sum + s.total_break_minutes, 0) / 60) * 10)) / 10;
  const monthDaysWorked = monthSessions.filter(s => s.total_work_minutes > 0).length;
  const completionRate = monthSessions.length > 0 
    ? Math.round((monthSessions.filter(s => getDayStatus(s) === 'complet').length / monthSessions.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header avec titre et actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Historique des Pointages
          </h2>
          <p className="text-muted-foreground mt-1">
            Consultez et exportez votre historique de travail
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowDateRange(!showDateRange)}
            className="w-[200px] justify-start text-left font-normal border-2"
          >
            <CalendarRangeIcon className="mr-2 h-4 w-4" />
            {format(dateRange.from, "dd MMM", { locale: fr })} - {format(dateRange.to, "dd MMM", { locale: fr })}
          </Button>
          
          <Button 
            variant="default" 
            onClick={exportData} 
            disabled={exportLoading}
            className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
          >
            {exportLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Exporter CSV
          </Button>
        </div>
      </div>

      {/* Sélecteur de période */}
      {showDateRange && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-gradient-to-br from-muted/50 to-muted/30 p-6 rounded-xl border-2"
        >
          <h3 className="font-semibold mb-4 text-lg flex items-center gap-2">
            <CalendarRangeIcon className="w-5 h-5" />
            Sélectionner la période d'export
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label htmlFor="dateFrom" className="text-sm font-medium">Date de début</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal h-12 border-2"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.from, "PPP", { locale: fr })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => date && setDateRange(prev => ({ ...prev, from: date }))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-3">
              <Label htmlFor="dateTo" className="text-sm font-medium">Date de fin</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal h-12 border-2"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.to, "PPP", { locale: fr })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => date && setDateRange(prev => ({ ...prev, to: date }))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </motion.div>
      )}

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Total ce mois</p>
                <p className="text-2xl font-bold text-blue-900">{monthWorkHours}h</p>
                <p className="text-xs text-blue-600 mt-1">{Math.round(monthWorkHours * 60)} minutes</p>
              </div>
              <div className="p-3 bg-blue-200 rounded-full">
                <Clock className="w-6 h-6 text-blue-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Jours travaillés</p>
                <p className="text-2xl font-bold text-green-900">{monthDaysWorked}</p>
                <p className="text-xs text-green-600 mt-1">sur {monthSessions.length} jours</p>
              </div>
              <div className="p-3 bg-green-200 rounded-full">
                <Users className="w-6 h-6 text-green-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 font-medium">Pauses totales</p>
                <p className="text-2xl font-bold text-amber-900">{monthBreakHours}h</p>
                <p className="text-xs text-amber-600 mt-1">{Math.round(monthBreakHours * 60)} minutes</p>
              </div>
              <div className="p-3 bg-amber-200 rounded-full">
                <Coffee className="w-6 h-6 text-amber-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Taux de complétion</p>
                <p className="text-2xl font-bold text-purple-900">{completionRate}%</p>
                <p className="text-xs text-purple-600 mt-1">journées complètes</p>
              </div>
              <div className="p-3 bg-purple-200 rounded-full">
                <TrendingUp className="w-6 h-6 text-purple-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liste des sessions */}
      <div className="space-y-4">
        {sessions.map((session, index) => {
          const status = getDayStatus(session);
          return (
            <motion.div
              key={session.date}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/20">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${getStatusColor(status)}`}>
                        <CalendarIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {format(new Date(session.date), "EEEE d MMMM yyyy", { locale: fr })}
                        </CardTitle>
                        <Badge variant="secondary" className={`mt-1 ${getStatusColor(status)}`}>
                          {getStatusLabel(status)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                        <Clock className="w-3 h-3 mr-1" />
                        {Math.round(session.total_work_minutes / 60 * 10) / 10}h travaillées
                      </Badge>
                      {session.total_break_minutes > 0 && (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
                          <Coffee className="w-3 h-3 mr-1" />
                          {Math.round(session.total_break_minutes / 60 * 10) / 10}h pause
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  {session.records.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {session.records
                        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                        .map((record) => (
                        <div
                          key={record.id}
                          className="flex items-center gap-3 p-3 bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg border hover:shadow-sm transition-all"
                        >
                          {getRecordIcon(record.type)}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {getRecordLabel(record.type)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(record.timestamp), "HH:mm")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">Aucun pointage enregistré</p>
                      <p className="text-sm mt-1">Cette journée ne contient aucun pointage</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {sessions.length === 0 && (
        <Card className="border-2 border-dashed">
          <CardContent className="text-center py-16">
            <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Aucun historique trouvé
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Commencez à pointer pour voir vos données apparaître ici. Votre historique des 30 derniers jours s'affichera dans cette section.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HistoryView;