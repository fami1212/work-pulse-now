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
  Settings
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

const Notifications = () => {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'info',
      title: 'Nouveau pointage',
      message: 'Votre entrée a été enregistrée à 09:00',
      timestamp: new Date(),
      read: false
    },
    {
      id: '2',
      type: 'warning',
      title: 'Pause prolongée',
      message: 'Votre pause dure depuis plus de 30 minutes',
      timestamp: new Date(Date.now() - 1000 * 60 * 15),
      read: false
    },
    {
      id: '3',
      type: 'success',
      title: 'Objectif atteint',
      message: 'Félicitations ! Vous avez atteint vos 8h de travail',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      read: true
    }
  ]);

  const [settings, setSettings] = useState({
    pushNotifications: true,
    emailNotifications: false,
    breakReminders: true,
    dailySummary: true,
    overtimeAlerts: true
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-success" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-warning" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-destructive" />;
      default: return <Info className="w-5 h-5 text-primary" />;
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    );
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        toast({
          title: "Notifications activées",
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
    // Check if notifications are supported
    if ('Notification' in window && settings.pushNotifications) {
      if (Notification.permission === 'default') {
        requestNotificationPermission();
      }
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-bold text-foreground">Notifications</h2>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="px-2 py-1">
              {unreadCount}
            </Badge>
          )}
        </div>
        
        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAllAsRead}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Tout marquer comme lu
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold text-foreground">
            Notifications récentes
          </h3>
          
          <AnimatePresence>
            {notifications.length > 0 ? (
              notifications.map((notification, index) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className={`cursor-pointer transition-all hover:shadow-md ${
                    !notification.read ? 'border-primary/50 bg-primary/5' : ''
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          {getNotificationIcon(notification.type)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className={`font-medium ${
                                !notification.read ? 'text-foreground' : 'text-muted-foreground'
                              }`}>
                                {notification.title}
                              </h4>
                              {!notification.read && (
                                <div className="w-2 h-2 bg-primary rounded-full ml-2"></div>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {notification.timestamp.toLocaleDateString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 ml-4">
                          {!notification.read && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => markAsRead(notification.id)}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteNotification(notification.id)}
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
              <Card>
                <CardContent className="text-center py-12">
                  <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Aucune notification
                  </h3>
                  <p className="text-muted-foreground">
                    Vous êtes à jour ! Aucune nouvelle notification.
                  </p>
                </CardContent>
              </Card>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Paramètres
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="push" className="text-sm">
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
              
              <div className="flex items-center justify-between">
                <Label htmlFor="email" className="text-sm">
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
              
              <div className="flex items-center justify-between">
                <Label htmlFor="breaks" className="text-sm">
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
              
              <div className="flex items-center justify-between">
                <Label htmlFor="summary" className="text-sm">
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
              
              <div className="flex items-center justify-between">
                <Label htmlFor="overtime" className="text-sm">
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Rappels automatiques
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Coffee className="w-4 h-4 text-warning" />
                <span className="text-muted-foreground">Pause après 4h de travail</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Sortie à 17h00</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <span className="text-muted-foreground">Heures sup. après 8h</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Notifications;