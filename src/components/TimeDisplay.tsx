import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Calendar, Sun, Moon, Cloud, Star } from "lucide-react";

export const TimeDisplay = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getTimeOfDay = () => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 21) return "evening";
    return "night";
  };

  const getGradient = () => {
    const timeOfDay = getTimeOfDay();
    switch (timeOfDay) {
      case "morning":
        return "from-amber-100 via-orange-50 to-yellow-100";
      case "afternoon":
        return "from-sky-100 via-blue-50 to-cyan-100";
      case "evening":
        return "from-violet-100 via-purple-50 to-fuchsia-100";
      case "night":
        return "from-indigo-100 via-blue-900/10 to-purple-900/10";
      default:
        return "from-gray-100 via-blue-50 to-cyan-100";
    }
  };

  const getIcon = () => {
    const timeOfDay = getTimeOfDay();
    switch (timeOfDay) {
      case "morning":
        return <Sun className="w-6 h-6 text-amber-500" />;
      case "afternoon":
        return <Cloud className="w-6 h-6 text-sky-500" />;
      case "evening":
        return <Sun className="w-6 h-6 text-orange-400" />;
      case "night":
        return <Moon className="w-6 h-6 text-indigo-400" />;
      default:
        return <Clock className="w-6 h-6 text-gray-500" />;
    }
  };

  const getGreeting = () => {
    const timeOfDay = getTimeOfDay();
    switch (timeOfDay) {
      case "morning":
        return "Bonjour et bonne journée ☀️";
      case "afternoon":
        return "Excellent après-midi 🌤️";
      case "evening":
        return "Belle soirée 🌇";
      case "night":
        return "Bonne nuit 🌙";
      default:
        return "Bienvenue 👋";
    }
  };

  if (!mounted) {
    return (
      <Card className="p-8 text-center bg-gradient-to-br from-gray-100 to-gray-50 border-0 shadow-2xl rounded-3xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded-lg w-32 mx-auto"></div>
          <div className="h-16 bg-gray-200 rounded-lg w-48 mx-auto"></div>
          <div className="h-6 bg-gray-200 rounded-lg w-64 mx-auto"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-8 text-center bg-gradient-to-br ${getGradient()} border-0 shadow-2xl rounded-3xl relative overflow-hidden backdrop-blur-sm`}>
      
      {/* Éléments de fond décoratifs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            rotate: 360,
            scale: [1, 1.1, 1],
          }}
          transition={{
            rotate: { duration: 20, repeat: Infinity, ease: "linear" },
            scale: { duration: 4, repeat: Infinity, ease: "easeInOut" }
          }}
          className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-full"
        />
        <motion.div
          animate={{
            rotate: -360,
            scale: [1.1, 1, 1.1],
          }}
          transition={{
            rotate: { duration: 25, repeat: Infinity, ease: "linear" },
            scale: { duration: 5, repeat: Infinity, ease: "easeInOut" }
          }}
          className="absolute -bottom-16 -left-16 w-32 h-32 bg-gradient-to-r from-secondary/5 to-primary/5 rounded-full"
        />
        
        {/* Étoiles pour la nuit */}
        {getTimeOfDay() === "night" && (
          <>
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute top-6 left-10 w-1 h-1 bg-white rounded-full"
            />
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 3, repeat: Infinity, delay: 1 }}
              className="absolute top-12 right-16 w-1 h-1 bg-white rounded-full"
            />
            <motion.div
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 4, repeat: Infinity, delay: 2 }}
              className="absolute bottom-20 left-20 w-1 h-1 bg-white rounded-full"
            />
          </>
        )}
      </div>

      <div className="relative space-y-6 z-10">
        
        {/* En-tête avec icône et salutation */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-3"
        >
          {getIcon()}
          <span className="text-lg font-semibold text-gray-700">
            {getGreeting()}
          </span>
        </motion.div>

        {/* Heure principale */}
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTime.getSeconds()}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.05, y: -10 }}
              transition={{ duration: 0.3 }}
              className="text-6xl md:text-7xl font-black bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent font-mono tracking-tighter"
            >
              {formatTime(currentTime)}
            </motion.div>
          </AnimatePresence>
          
          {/* Effet de brillance sur l'heure */}
          <motion.div
            animate={{
              x: [-100, 300],
              opacity: [0, 0.3, 0],
            }}
            transition={{
              x: { duration: 3, repeat: Infinity, ease: "easeInOut" },
              opacity: { duration: 3, repeat: Infinity, ease: "easeInOut" }
            }}
            className="absolute top-0 left-0 w-20 h-full bg-gradient-to-r from-transparent via-white to-transparent skew-x-12"
          />
        </div>

        {/* Date */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-3 text-xl text-gray-600 capitalize font-medium"
        >
          <Calendar className="w-5 h-5 text-gray-500" />
          {formatDate(currentTime)}
        </motion.div>

        {/* Indicateur de précision */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center justify-center gap-2 text-sm text-gray-500"
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-2 h-2 bg-green-400 rounded-full"
          />
          Synchronisé avec précision
        </motion.div>

        {/* Progress bar discrète */}
        <div className="pt-4">
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              key={currentTime.getMinutes()}
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 60, ease: "linear" }}
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
            />
          </div>
        </div>
      </div>

      {/* Bordure animée */}
      <motion.div
        animate={{
          opacity: [0.3, 0.7, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute inset-0 rounded-3xl border-2 border-white/30 pointer-events-none"
      />
    </Card>
  );
};