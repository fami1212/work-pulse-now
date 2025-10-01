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
  WifiOff,
  Shield
} from "lucide-react";
import { TimeDisplay } from "@/components/TimeDisplay";
import { ModernPunchCard } from "@/components/ModernPunchCard";
import Dashboard from "@/components/Dashboard";
import HistoryView from "@/components/HistoryView";
import UserProfile from "@/components/UserProfile";
import Notifications from "@/components/Notifications";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [activeTab, setActiveTab] = useState("home");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notificationCount, setNotificationCount] = useState(0);

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

  // Récupérer le nombre de notifications non lues
  useEffect(() => {
    const fetchNotificationCount = async () => {
      if (!user) return;

      try {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false);

        setNotificationCount(count || 0);
      } catch (error) {
        console.error('Error fetching notification count:', error);
      }
    };

    fetchNotificationCount();

    // Écouter les nouvelles notifications
    if (user) {
      const channel = supabase
        .channel('notification-count')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            fetchNotificationCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const tabVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.3 }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-muted/30 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-96 h-96 bg-success/5 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      <div className="container mx-auto px-4 py-6 relative z-10">
        <header className="text-center space-y-6 mb-12">
          <motion.div 
            className="flex items-center justify-center gap-4"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.h1 
              className="text-4xl md:text-6xl font-black bg-gradient-to-r from-primary via-primary/80 to-success bg-clip-text text-transparent text-center"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ 
                duration: 1, 
                type: "spring", 
                stiffness: 100 
              }}
            >
              OMNIA SCHOOL
            </motion.h1>
            <motion.p
              className="text-lg md:text-xl font-semibold text-muted-foreground text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              OF BUSINESS AND TECHNOLOGY
            </motion.p>
            
            <AnimatePresence>
              {isOnline ? (
                <motion.div
                  key="online"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 180 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="relative"
                >
                  <motion.div
                    animate={{ 
                      boxShadow: [
                        "0 0 0 0 hsl(var(--success))",
                        "0 0 0 10px hsla(var(--success), 0)",
                        "0 0 0 0 hsl(var(--success))"
                      ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="rounded-full"
                  >
                    <Wifi className="h-8 w-8 text-success" />
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  key="offline"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 180 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                >
                  <WifiOff className="h-8 w-8 text-destructive" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="space-y-4"
          >
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Système intelligent de pointage et gestion de présence
            </p>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="flex items-center justify-center gap-4 text-sm text-muted-foreground"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span>Temps réel</span>
              </div>
              <div className="w-1 h-1 bg-muted-foreground rounded-full" />
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-success" />
                <span>Personnel</span>
              </div>
              <div className="w-1 h-1 bg-muted-foreground rounded-full" />
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-warning" />
                <span>Analytics</span>
              </div>
            </motion.div>
          </motion.div>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.6 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-6' : 'grid-cols-5'} mb-12 h-14 bg-card/50 backdrop-blur-sm border border-border/50`}>
              <TabsTrigger value="home" className="flex items-center gap-2 text-sm font-medium">
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Accueil</span>
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="flex items-center gap-2 text-sm font-medium">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2 text-sm font-medium">
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">Historique</span>
              </TabsTrigger>
              <TabsTrigger value="profile" className="flex items-center gap-2 text-sm font-medium">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Profil</span>
              </TabsTrigger>
              <TabsTrigger 
                value="notifications" 
                className="flex items-center gap-2 relative text-sm font-medium"
              >
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Notifications</span>
                {notificationCount > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1"
                  >
                    <Badge variant="destructive" className="px-1 py-0 text-xs h-5 w-5 rounded-full flex items-center justify-center">
                      {notificationCount}
                    </Badge>
                  </motion.div>
                )}
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="admin" className="flex items-center gap-2 text-sm font-medium">
                  <Shield className="w-4 h-4" />
                  <span className="hidden sm:inline">Admin</span>
                </TabsTrigger>
              )}
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
                    className="max-w-5xl mx-auto space-y-8"
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <TimeDisplay />
                    <ModernPunchCard />
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

                {isAdmin && (
                  <TabsContent value="admin">
                    <AdminDashboard />
                  </TabsContent>
                )}
              </motion.div>
            </AnimatePresence>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

export default Index;