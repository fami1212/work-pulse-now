import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bell, 
  Clock, 
  Coffee, 
  AlertCircle, 
  CheckCircle, 
  Info,
  X,
  Settings,
  Mail,
  Zap,
  Calendar,
  Shield
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  created_at: string;
  read: boolean;
}

const Notifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState({
    pushNotifications: true,
    emailNotifications: false,
    breakReminders: true,
    dailySummary: true,
    overtimeAlerts: true
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': 
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning': 
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      case 'error': 
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default: 
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success': 
        return 'from-green-50 to-green-25 border-green-200';
      case 'warning': 
        return 'from-amber-50 to-amber-25 border-amber-200';
      case 'error': 
        return 'from-red-50 to-red-25 border-red-200';
      default: 
        return 'from-blue-50 to-blue-25 border-blue-200';
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  // Real-time notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      setNotifications((data || []) as Notification[]);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);

      if (!error) {
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === id ? { ...notif, read: true } : notif
          )
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (!error) {
        setNotifications(prev =>
          prev.map(notif => ({ ...notif, read: true }))
        );
        toast({
          title: "✅ Toutes les notifications marquées comme lues",
          description: "Vous n'avez plus de notifications non lues",
        });
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (!error) {
        setNotifications(prev => prev.filter(notif => notif.id !== id));
        toast({
          title: "Notification supprimée",
          description: "La notification a été supprimée avec succès",
        });
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        toast({
          title: "🔔 Notifications activées",
          description: "Vous recevrez maintenant des notifications push",
        });
        setSettings(prev => ({ ...prev, pushNotifications: true }));
      } else {
        toast({
          title: "Permission refusée",
          description: "Activez les notifications dans les paramètres de votre navigateur",
          variant: "destructive",
        });
        setSettings(prev => ({ ...prev, pushNotifications: false }));
      }
    }
  };

  useEffect(() => {
    if ('Notification' in window && settings.pushNotifications) {
      if (Notification.permission === 'default') {
        requestNotificationPermission();
      }
    }
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4"
      >
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Notifications
          </h2>
          <p className="text-muted-foreground mt-1">
            Restez informé de votre activité et de vos rappels
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-2"
            >
              <Badge variant="destructive" className="px-3 py-1 text-sm font-semibold">
                <Bell className="w-3 h-3 mr-1" />
                {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
              </Badge>
              <Button 
                variant="outline" 
                onClick={markAllAsRead}
                className="rounded-xl border-2"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Tout marquer comme lu
              </Button>
            </motion.div>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Notifications List */}
        <div className="lg:col-span-2 space-y-4">
          <motion.h3 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-xl font-semibold text-gray-800 flex items-center gap-2"
          >
            <Bell className="w-5 h-5 text-primary" />
            Notifications récentes
          </motion.h3>
          
          <AnimatePresence mode="popLayout">
            {notifications.length > 0 ? (
              notifications.map((notification, index) => (
                <motion.div
                  key={notification.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="relative"
                >
                  <Card className={`border-2 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg ${
                    !notification.read 
                      ? `bg-gradient-to-r ${getNotificationColor(notification.type)} shadow-md` 
                      : 'bg-white/80 backdrop-blur-sm border-gray-200'
                  }`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`p-3 rounded-xl ${
                            !notification.read 
                              ? 'bg-white shadow-sm' 
                              : 'bg-gray-50'
                          }`}>
                            {getNotificationIcon(notification.type)}
                          </div>
                          
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className={`font-semibold ${
                                !notification.read ? 'text-gray-900' : 'text-gray-600'
                              }`}>
                                {notification.title}
                              </h4>
                              {!notification.read && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="w-3 h-3 bg-primary rounded-full ml-2"
                                />
                              )}
                            </div>
                            
                            <p className={`text-sm ${
                              !notification.read ? 'text-gray-700' : 'text-gray-500'
                            } leading-relaxed`}>
                              {notification.message}
                            </p>
                            
                            <p className="text-xs text-gray-400">
                              {new Date(notification.created_at).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 ml-4">
                          {!notification.read && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => markAsRead(notification.id)}
                              className="rounded-lg p-2 hover:bg-green-100 hover:text-green-600"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteNotification(notification.id)}
                            className="rounded-lg p-2 hover:bg-red-100 hover:text-red-600"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className="border-0 bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-3xl shadow-lg">
                  <CardContent className="text-center py-16">
                    <div className="p-4 bg-primary/10 rounded-full w-16 h-16 mx-auto mb-4">
                      <Bell className="w-8 h-8 text-primary mx-auto" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">
                      Aucune notification
                    </h3>
                    <p className="text-gray-600 max-w-sm mx-auto">
                      Vous êtes à jour ! Aucune nouvelle notification pour le moment.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Settings Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-gradient-to-br from-white to-gray-50/80 border-0 shadow-xl rounded-3xl">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 bg-blue-100 rounded-xl">
                    <Settings className="w-5 h-5 text-blue-600" />
                  </div>
                  Paramètres des notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between p-3 bg-white/60 rounded-2xl border border-gray-200">
                  <Label htmlFor="push" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <Zap className="w-4 h-4 text-amber-600" />
                    Notifications push
                  </Label>
                  <Switch
                    id="push"
                    checked={settings.pushNotifications}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        requestNotificationPermission();
                      } else {
                        setSettings(prev => ({ ...prev, pushNotifications: false }));
                      }
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 bg-white/60 rounded-2xl border border-gray-200">
                  <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <Mail className="w-4 h-4 text-blue-600" />
                    Notifications email
                  </Label>
                  <Switch
                    id="email"
                    checked={settings.emailNotifications}
                    onCheckedChange={(checked) =>
                      setSettings(prev => ({ ...prev, emailNotifications: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 bg-white/60 rounded-2xl border border-gray-200">
                  <Label htmlFor="breaks" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <Coffee className="w-4 h-4 text-amber-600" />
                    Rappels de pause
                  </Label>
                  <Switch
                    id="breaks"
                    checked={settings.breakReminders}
                    onCheckedChange={(checked) =>
                      setSettings(prev => ({ ...prev, breakReminders: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 bg-white/60 rounded-2xl border border-gray-200">
                  <Label htmlFor="summary" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <Calendar className="w-4 h-4 text-green-600" />
                    Résumé quotidien
                  </Label>
                  <Switch
                    id="summary"
                    checked={settings.dailySummary}
                    onCheckedChange={(checked) =>
                      setSettings(prev => ({ ...prev, dailySummary: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 bg-white/60 rounded-2xl border border-gray-200">
                  <Label htmlFor="overtime" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <Shield className="w-4 h-4 text-red-600" />
                    Alertes heures sup.
                  </Label>
                  <Switch
                    id="overtime"
                    checked={settings.overtimeAlerts}
                    onCheckedChange={(checked) =>
                      setSettings(prev => ({ ...prev, overtimeAlerts: checked }))
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Auto Reminders Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200 shadow-xl rounded-3xl">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 bg-amber-100 rounded-xl">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  Rappels automatiques
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 p-3 bg-white/60 rounded-2xl border border-amber-200">
                  <Coffee className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-gray-800">Pause recommandée</p>
                    <p className="text-sm text-gray-600">Après 4h de travail continu</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 p-3 bg-white/60 rounded-2xl border border-blue-200">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-800">Fin de journée</p>
                    <p className="text-sm text-gray-600">Rappel à 17h00</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 p-3 bg-white/60 rounded-2xl border border-red-200">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <div>
                    <p className="font-medium text-gray-800">Heures supplémentaires</p>
                    <p className="text-sm text-gray-600">Alerte après 8h de travail</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Notifications;