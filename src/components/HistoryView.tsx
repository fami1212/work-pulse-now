import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { motion } from "framer-motion";
import { format } from "date-fns";
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
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: new Date(), to: new Date() });

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user, selectedDate]);

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

      // Group records by date
      const groupedSessions: { [key: string]: WorkSession } = {};
      
      workSessions?.forEach(session => {
        groupedSessions[session.date] = {
          date: session.date,
          total_work_minutes: session.total_work_minutes,
          total_break_minutes: session.total_break_minutes,
          records: []
        };
      });

      records?.forEach(record => {
        const date = record.timestamp.split('T')[0];
        if (groupedSessions[date] && ['in', 'out', 'break_start', 'break_end'].includes(record.type)) {
          groupedSessions[date].records.push(record as PunchRecord);
        }
      });

      setSessions(Object.values(groupedSessions));
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportData = async () => {
    // Simple CSV export
    const csvData = sessions.map(session => 
      `${session.date},${(session.total_work_minutes / 60).toFixed(2)},${(session.total_break_minutes / 60).toFixed(2)}`
    ).join('\n');
    
    const blob = new Blob([`Date,Heures travaillées,Heures de pause\n${csvData}`], 
      { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'historique-pointage.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse space-y-4 w-full">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-muted rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-3xl font-bold text-foreground">Historique</h2>
        
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP", { locale: fr }) : "Sélectionner une date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          
          <Button variant="outline" onClick={exportData}>
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total ce mois</p>
                <p className="text-2xl font-bold text-foreground">
                  {sessions.reduce((sum, s) => sum + s.total_work_minutes, 0) / 60}h
                </p>
              </div>
              <Clock className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Jours travaillés</p>
                <p className="text-2xl font-bold text-foreground">{sessions.length}</p>
              </div>
              <CalendarIcon className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pauses totales</p>
                <p className="text-2xl font-bold text-foreground">
                  {Math.round(sessions.reduce((sum, s) => sum + s.total_break_minutes, 0) / 60)}h
                </p>
              </div>
              <Coffee className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {sessions.map((session, index) => (
          <motion.div
            key={session.date}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">
                    {format(new Date(session.date), "EEEE d MMMM yyyy", { locale: fr })}
                  </CardTitle>
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary">
                      {Math.round(session.total_work_minutes / 60 * 10) / 10}h travaillées
                    </Badge>
                    {session.total_break_minutes > 0 && (
                      <Badge variant="outline">
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
                        className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
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
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Aucun pointage enregistré</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {sessions.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Aucun historique trouvé
            </h3>
            <p className="text-muted-foreground">
              Commencez à pointer pour voir vos données apparaître ici.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HistoryView;