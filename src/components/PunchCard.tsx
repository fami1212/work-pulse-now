import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, LogIn, LogOut, Coffee, User, TrendingUp, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

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
        title: "🎉 Bienvenue !",
        description: `Bonjour ${employeeName.trim()}, prêt à commencer votre journée ?`,
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
      'in': 'Votre pointage d\'entrée a été enregistré avec succès',
      'out': 'Votre pointage de sortie a été enregistré avec succès',
      'break_start': 'Pause enregistrée, bon repos !',
      'break_end': 'Retour au travail enregistré'
    };

    toast({
      title: "✅ Pointage enregistré",
      description: messages[type],
    });
  };

  const getStatusConfig = () => {
    const variants = {
      'out': { 
        variant: 'destructive' as const, 
        text: 'Absent', 
        icon: LogOut,
        gradient: 'from-red-500/10 to-red-500/5',
        border: 'border-red-200',
        color: 'text-red-600',
        bgColor: 'bg-red-100'
      },
      'in': { 
        variant: 'default' as const, 
        text: 'Présent', 
        icon: LogIn,
        gradient: 'from-green-500/10 to-green-500/5',
        border: 'border-green-200',
        color: 'text-green-600',
        bgColor: 'bg-green-100'
      },
      'break': { 
        variant: 'secondary' as const, 
        text: 'En pause', 
        icon: Coffee,
        gradient: 'from-amber-500/10 to-amber-500/5',
        border: 'border-amber-200',
        color: 'text-amber-600',
        bgColor: 'bg-amber-100'
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
      <Card className="p-8 max-w-md mx-auto bg-gradient-to-br from-white to-gray-50/80 border-0 shadow-2xl rounded-3xl relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-full blur-xl" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-r from-secondary/5 to-primary/5 rounded-full blur-xl" />
        </div>

        <form onSubmit={handleNameSubmit} className="space-y-6 relative z-10">
          <div className="text-center space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="p-4 bg-gradient-to-r from-primary to-primary/80 rounded-2xl shadow-lg inline-block"
            >
              <User className="w-8 h-8 text-white" />
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent"
            >
              Identification
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-muted-foreground"
            >
              Veuillez entrer votre nom pour commencer
            </motion.p>
          </div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <input
              type="text"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="Votre nom complet"
              className="w-full px-4 py-4 rounded-2xl border-2 border-gray-300 bg-white/80 backdrop-blur-sm text-foreground text-center text-lg focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300"
              required
            />
            <Button 
              type="submit" 
              className="w-full text-lg py-4 rounded-2xl bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-0"
              size="lg"
            >
              Commencer
            </Button>
          </motion.div>
        </form>
      </Card>
    );
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
                    Bonjour, {employeeName}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {new Date().toLocaleDateString('fr-FR', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
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
                    <p className="text-sm font-medium text-gray-600">Temps travaillé aujourd'hui</p>
                    <p className="text-xl font-bold text-gray-900">{getTotalWorkTime()}</p>
                  </div>
                </div>
                <Clock className="w-8 h-8 text-blue-400 opacity-60" />
              </div>
            </motion.div>
          </div>
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
                  className="w-full max-w-sm text-lg py-8 px-8 rounded-2xl font-bold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 border-0"
                >
                  <LogIn className="w-6 h-6 mr-3" />
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
                  className="w-full text-lg py-6 px-6 rounded-2xl font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 border-0 h-auto min-h-[80px]"
                >
                  <Coffee className="w-5 h-5 mr-2" />
                  Pause
                </Button>
                <Button
                  onClick={() => addPunchRecord('out')}
                  className="w-full text-lg py-6 px-6 rounded-2xl font-semibold bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 border-0 h-auto min-h-[80px]"
                >
                  <LogOut className="w-5 h-5 mr-2" />
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
                  className="w-full max-w-sm text-lg py-8 px-8 rounded-2xl font-bold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 border-0"
                >
                  <LogIn className="w-6 h-6 mr-3" />
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
              <Calendar className="w-5 h-5" />
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
                    {record.timestamp.toLocaleTimeString('fr-FR', {
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