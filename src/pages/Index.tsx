import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Home, 
  BarChart3, 
  History, 
  User, 
  Bell,
  Clock,
  Wifi,
  WifiOff
} from "lucide-react";
import { TimeDisplay } from "@/components/TimeDisplay";
import { PunchCardSupabase } from "@/components/PunchCardSupabase";
import Dashboard from "@/components/Dashboard";
import HistoryView from "@/components/HistoryView";
import UserProfile from "@/components/UserProfile";
import Notifications from "@/components/Notifications";

const Index = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notifications, setNotifications] = useState(0);

  // Network status monitoring
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

  // Simulate notification updates
  useEffect(() => {
    const interval = setInterval(() => {
      setNotifications(prev => Math.max(0, prev + Math.floor(Math.random() * 3) - 1));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const tabVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.3 }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="container mx-auto px-4 py-6">
        <header className="text-center space-y-4 mb-8">
          <div className="flex items-center justify-center gap-4">
            <motion.h1 
              className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              TimeTracker Pro
            </motion.h1>
            <AnimatePresence>
              {isOnline ? (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 180 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                >
                  <Wifi className="h-6 w-6 text-success" />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 180 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                >
                  <WifiOff className="h-6 w-6 text-destructive" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <motion.p 
            className="text-xl text-muted-foreground max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            Système moderne de gestion des temps de présence
          </motion.p>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8 h-12">
            <TabsTrigger value="home" className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Accueil</span>
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Historique</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Profil</span>
            </TabsTrigger>
            <TabsTrigger 
              value="notifications" 
              className="flex items-center gap-2 relative"
              onClick={() => setNotifications(0)}
            >
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Notifications</span>
              {notifications > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 px-1 py-0 text-xs h-5 w-5 rounded-full flex items-center justify-center">
                  {notifications}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 300, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -300, scale: 0.8 }}
              transition={{ 
                type: "spring",
                stiffness: 300,
                damping: 30
              }}
            >
              <TabsContent value="home" className="space-y-8">
                <motion.div 
                  className="max-w-4xl mx-auto space-y-8"
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <TimeDisplay />
                  <PunchCardSupabase />
                </motion.div>
              </TabsContent>

              <TabsContent value="dashboard">
                <Dashboard />
              </TabsContent>

              <TabsContent value="history">
                <HistoryView />
              </TabsContent>

              <TabsContent value="profile">
                <UserProfile />
              </TabsContent>

              <TabsContent value="notifications">
                <Notifications />
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;