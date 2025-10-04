import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { 
  QrCode, 
  Download, 
  Clock, 
  TrendingUp, 
  Coffee,
  LogIn,
  LogOut,
  MapPin
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";
import { useToast } from "@/hooks/use-toast";

interface TodayStats {
  hours: number;
  breaks: number;
  lastPunch: {
    type: string;
    time: string;
  } | null;
  isWorking: boolean;
}

export const HomeView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [qrValue, setQrValue] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TodayStats>({
    hours: 0,
    breaks: 0,
    lastPunch: null,
    isWorking: false
  });

  useEffect(() => {
    if (user) {
      fetchProfileAndGenerateQR();
      fetchTodayStats();
      // Refresh stats every minute
      const interval = setInterval(fetchTodayStats, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchProfileAndGenerateQR = async () => {
    if (!user) return;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('qr_code, full_name')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      if (profile?.qr_code) {
        setQrValue(profile.qr_code);
        const qrDataUrl = await QRCode.toDataURL(profile.qr_code, {
          width: 400,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        setQrCodeUrl(qrDataUrl);
      }
    } catch (error) {
      console.error('Error fetching QR code:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger votre QR code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayStats = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];

      // Get today's work time
      const { data: todayData } = await supabase.rpc('calculate_work_time', {
        user_uuid: user.id,
        target_date: today,
      });

      const todayMinutes = todayData?.[0]?.total_work_minutes || 0;

      // Get today's breaks count
      const { count: breaksCount } = await supabase
        .from('punch_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('type', 'break_start')
        .gte('timestamp', `${today}T00:00:00.000Z`)
        .lt('timestamp', `${today}T23:59:59.999Z`);

      // Get last punch
      const { data: lastPunchData } = await supabase
        .from('punch_records')
        .select('type, timestamp')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      const isWorking = lastPunchData?.type === 'in' || lastPunchData?.type === 'break_end';

      setStats({
        hours: Math.round((todayMinutes / 60) * 10) / 10,
        breaks: breaksCount || 0,
        lastPunch: lastPunchData ? {
          type: lastPunchData.type,
          time: new Date(lastPunchData.timestamp).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })
        } : null,
        isWorking
      });
    } catch (error) {
      console.error('Error fetching today stats:', error);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeUrl) return;

    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `qr-code-${qrValue}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "QR Code téléchargé",
      description: "Votre QR code a été téléchargé avec succès",
    });
  };

  const getPunchTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'in': 'Entrée',
      'out': 'Sortie',
      'break_start': 'Début pause',
      'break_end': 'Fin pause'
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Status Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <h2 className="text-3xl font-bold">Bienvenue !</h2>
        <p className="text-muted-foreground">
          Pointez facilement sur la tablette en scannant votre QR code
        </p>
        {stats.lastPunch && (
          <Badge 
            variant={stats.isWorking ? "default" : "secondary"}
            className="text-sm px-4 py-2"
          >
            <Clock className="w-4 h-4 mr-2" />
            {stats.isWorking ? "En activité" : "Hors service"} • Dernier pointage: {getPunchTypeLabel(stats.lastPunch.type)} à {stats.lastPunch.time}
          </Badge>
        )}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR Code Card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" />
                Votre QR Code Personnel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-sm text-muted-foreground">
                Scannez ce code sur la tablette à l'entrée pour pointer votre présence
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              ) : qrCodeUrl ? (
                <div className="space-y-4">
                  <div className="bg-white p-6 rounded-xl border-2 border-border flex items-center justify-center">
                    <img 
                      src={qrCodeUrl} 
                      alt="QR Code" 
                      className="w-full max-w-xs"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground font-mono bg-muted px-3 py-2 rounded-lg inline-block">
                      {qrValue}
                    </p>
                  </div>
                  <Button 
                    onClick={downloadQRCode}
                    variant="outline"
                    className="w-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger le QR Code
                  </Button>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  QR Code non disponible
                </div>
              )}

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-primary">Comment pointer ?</p>
                    <p className="text-muted-foreground mt-1">
                      1. Rendez-vous à la tablette à l'entrée<br/>
                      2. Présentez votre QR code devant la caméra<br/>
                      3. Attendez la confirmation de pointage
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Today's Stats Card */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-success" />
                Statistiques du Jour
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {/* Hours Worked */}
                <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Clock className="w-4 h-4" />
                        <span>Heures travaillées</span>
                      </div>
                      <p className="text-3xl font-bold text-primary">
                        {stats.hours}h
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Breaks */}
                <Card className="bg-gradient-to-br from-warning/5 to-warning/10 border-warning/20">
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Coffee className="w-4 h-4" />
                        <span>Pauses prises</span>
                      </div>
                      <p className="text-3xl font-bold text-warning">
                        {stats.breaks}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Current Status */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Statut actuel</h4>
                <Card className={`border-2 ${
                  stats.isWorking 
                    ? 'border-success/50 bg-success/5' 
                    : 'border-muted bg-muted/50'
                }`}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {stats.isWorking ? (
                          <LogIn className="w-8 h-8 text-success" />
                        ) : (
                          <LogOut className="w-8 h-8 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-semibold">
                            {stats.isWorking ? "En activité" : "Hors service"}
                          </p>
                          {stats.lastPunch && (
                            <p className="text-sm text-muted-foreground">
                              {getPunchTypeLabel(stats.lastPunch.type)} • {stats.lastPunch.time}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${
                        stats.isWorking ? 'bg-success animate-pulse' : 'bg-muted-foreground'
                      }`} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Info */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <p className="font-medium">💡 Le saviez-vous ?</p>
                <p className="text-muted-foreground">
                  Vos pointages sont automatiquement enregistrés et synchronisés en temps réel. 
                  Consultez l'onglet "Historique" pour voir tous vos pointages.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
