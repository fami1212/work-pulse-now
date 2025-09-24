import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, LogIn, LogOut, Coffee, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface PunchRecord {
  id: string;
  type: 'in' | 'out' | 'break_start' | 'break_end';
  timestamp: Date;
  employeeName: string;
}

export const PunchCard = () => {
  const [employeeName, setEmployeeName] = useState("");
  const [currentStatus, setCurrentStatus] = useState<'out' | 'in' | 'break'>('out');
  const [todayRecords, setTodayRecords] = useState<PunchRecord[]>([]);
  const [isNameSet, setIsNameSet] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Load data from localStorage
    const savedName = localStorage.getItem('employeeName');
    const savedRecords = localStorage.getItem('todayRecords');
    const savedStatus = localStorage.getItem('currentStatus');
    
    if (savedName) {
      setEmployeeName(savedName);
      setIsNameSet(true);
    }
    
    if (savedRecords) {
      const records = JSON.parse(savedRecords).map((record: any) => ({
        ...record,
        timestamp: new Date(record.timestamp)
      }));
      setTodayRecords(records);
    }
    
    if (savedStatus) {
      setCurrentStatus(savedStatus as 'out' | 'in' | 'break');
    }
  }, []);

  const saveToLocalStorage = (records: PunchRecord[], status: string) => {
    localStorage.setItem('todayRecords', JSON.stringify(records));
    localStorage.setItem('currentStatus', status);
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (employeeName.trim()) {
      localStorage.setItem('employeeName', employeeName.trim());
      setIsNameSet(true);
      toast({
        title: "Bienvenue !",
        description: `Bonjour ${employeeName.trim()}`,
      });
    }
  };

  const addPunchRecord = (type: PunchRecord['type']) => {
    const newRecord: PunchRecord = {
      id: Date.now().toString(),
      type,
      timestamp: new Date(),
      employeeName
    };

    const updatedRecords = [...todayRecords, newRecord];
    setTodayRecords(updatedRecords);

    let newStatus: typeof currentStatus;
    switch (type) {
      case 'in':
        newStatus = 'in';
        break;
      case 'out':
        newStatus = 'out';
        break;
      case 'break_start':
        newStatus = 'break';
        break;
      case 'break_end':
        newStatus = 'in';
        break;
    }
    
    setCurrentStatus(newStatus);
    saveToLocalStorage(updatedRecords, newStatus);

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

  const getTotalWorkTime = () => {
    let totalMinutes = 0;
    let currentIn: Date | null = null;
    let pauseStart: Date | null = null;

    todayRecords.forEach(record => {
      switch (record.type) {
        case 'in':
          currentIn = record.timestamp;
          break;
        case 'out':
          if (currentIn) {
            const diff = record.timestamp.getTime() - currentIn.getTime();
            totalMinutes += Math.floor(diff / (1000 * 60));
            currentIn = null;
          }
          break;
        case 'break_start':
          pauseStart = record.timestamp;
          break;
        case 'break_end':
          if (pauseStart && currentIn) {
            const pauseDiff = record.timestamp.getTime() - pauseStart.getTime();
            totalMinutes -= Math.floor(pauseDiff / (1000 * 60));
            pauseStart = null;
          }
          break;
      }
    });

    // Add current session if still working
    if (currentIn && currentStatus === 'in') {
      const diff = new Date().getTime() - currentIn.getTime();
      totalMinutes += Math.floor(diff / (1000 * 60));
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}min`;
  };

  if (!isNameSet) {
    return (
      <Card className="p-8 max-w-md mx-auto">
        <form onSubmit={handleNameSubmit} className="space-y-6">
          <div className="text-center space-y-2">
            <User className="w-12 h-12 mx-auto text-primary" />
            <h2 className="text-2xl font-bold">Identification</h2>
            <p className="text-muted-foreground">Veuillez entrer votre nom pour commencer</p>
          </div>
          <div className="space-y-4">
            <input
              type="text"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="Votre nom complet"
              className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground text-center text-lg"
              required
            />
            <Button type="submit" className="w-full" size="lg">
              Continuer
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card className="p-8 max-w-2xl mx-auto">
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <h2 className="text-2xl font-bold">Bonjour, {employeeName}</h2>
            {getStatusBadge()}
          </div>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Clock className="w-5 h-5" />
            <span>Temps travaillé aujourd'hui: {getTotalWorkTime()}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {currentStatus === 'out' && (
            <Button
              variant="punch"
              onClick={() => addPunchRecord('in')}
              className="w-full"
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
              >
                <Coffee className="w-6 h-6 mr-3" />
                Commencer pause
              </Button>
              <Button
                variant="destructive"
                onClick={() => addPunchRecord('out')}
                className="w-full text-lg py-6 px-8 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
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
            >
              <LogIn className="w-6 h-6 mr-3" />
              Terminer la pause
            </Button>
          )}
        </div>

        {todayRecords.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Pointages d'aujourd'hui</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {todayRecords.slice(-5).reverse().map((record) => (
                <div key={record.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="font-medium">
                    {record.type === 'in' && 'Entrée'}
                    {record.type === 'out' && 'Sortie'}
                    {record.type === 'break_start' && 'Début pause'}
                    {record.type === 'break_end' && 'Fin pause'}
                  </span>
                  <span className="text-muted-foreground">
                    {record.timestamp.toLocaleTimeString('fr-FR', {
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