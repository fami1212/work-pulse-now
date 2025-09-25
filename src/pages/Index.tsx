import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { 
  Home, 
  BarChart3, 
  History, 
  User, 
  Bell,
  Clock
} from "lucide-react";
import { TimeDisplay } from "@/components/TimeDisplay";
import { PunchCardSupabase } from "@/components/PunchCardSupabase";
import Dashboard from "@/components/Dashboard";
import HistoryView from "@/components/HistoryView";
import UserProfile from "@/components/UserProfile";
import Notifications from "@/components/Notifications";

const Index = () => {
  const [activeTab, setActiveTab] = useState("home");

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
          <motion.h1 
            className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            TimeTracker Pro
          </motion.h1>
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
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
          </TabsList>

          <motion.div
            key={activeTab}
            variants={tabVariants}
            initial="hidden"
            animate="visible"
          >
            <TabsContent value="home" className="space-y-8">
              <div className="max-w-4xl mx-auto space-y-8">
                <TimeDisplay />
                <PunchCardSupabase />
              </div>
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
        </Tabs>
      </div>
    </div>
  );
};

export default Index;