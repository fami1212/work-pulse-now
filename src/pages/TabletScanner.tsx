import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QrCode, Check, AlertCircle, Clock, User } from 'lucide-react';
import { QRScanner } from '@/components/QRScanner';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useGeolocation } from '@/hooks/useGeolocation';

export const TabletScanner = () => {
  const [isScanning, setIsScanning] = useState(true); // Scanner toujours actif
  const [lastScan, setLastScan] = useState<{
    name: string;
    type: string;
    time: string;
  } | null>(null);
  const { toast } = useToast();
  const { getCurrentLocation } = useGeolocation();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleScanSuccess = async (decodedText: string) => {
    try {
      // Récupérer la localisation
      const location = await getCurrentLocation();

      // Appeler la fonction SQL qui gère toute la logique de pointage
      const { data, error } = await supabase.rpc('process_qr_punch', {
        p_qr_code: decodedText,
        p_lat: location.latitude,
        p_lng: location.longitude,
      });

      if (error) {
      toast({
        title: 'QR Code invalide',
        description: error.message || 'Ce QR code n\'est pas reconnu dans le système',
        variant: 'destructive',
      });
      return;
      }

      // data est un tableau avec un seul élément
      const result = data[0];

      setLastScan({
        name: result.full_name,
        type: result.punch_type,
        time: new Date(result.punched_at).toLocaleTimeString('fr-FR'),
      });

      toast({
        title: 'Pointage réussi',
        description: `${result.full_name} - ${result.punch_type}`,
      });

      // Le scanner reste actif, on met juste à jour lastScan
      // Le QRScanner gère lui-même l'affichage du message pendant 2.5s
    } catch (error) {
      console.error('Error processing QR punch:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'enregistrer le pointage',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-success/5 p-4">
      {/* Header */}
      <div className="text-center mb-8">
        <motion.h1 
          className="text-4xl md:text-5xl font-black bg-gradient-to-r from-primary to-success bg-clip-text text-transparent mb-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          OMNIA SCHOOL
        </motion.h1>
        <p className="text-lg text-muted-foreground">
          Système de Pointage
        </p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <Clock className="w-5 h-5 text-primary" />
          <span className="text-2xl font-mono font-bold">
            {currentTime.toLocaleTimeString('fr-FR')}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {currentTime.toLocaleDateString('fr-FR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      </div>

      {/* Scanner Area */}
      <div className="max-w-2xl mx-auto">
        <Card className="border-2">
          <CardContent className="p-8">
            <AnimatePresence mode="wait">
              {isScanning ? (
                <motion.div
                  key="scanning"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                      <QrCode className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Scannez votre QR Code</h2>
                    <p className="text-muted-foreground">
                      Présentez votre code QR devant la caméra
                    </p>
                  </div>
                  
                  <div className="rounded-lg overflow-hidden">
                    <QRScanner
                      onScanSuccess={handleScanSuccess}
                      onClose={() => {}}
                      title=""
                    />
                  </div>
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    Positionnez votre QR code devant la caméra
                  </p>
                </motion.div>
              ) : lastScan && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="text-center py-8"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                    className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success/10 mb-4"
                  >
                    <Check className="w-10 h-10 text-success" />
                  </motion.div>
                  
                  <h2 className="text-3xl font-bold text-success mb-4">
                    Pointage Réussi !
                  </h2>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 text-lg">
                      <User className="w-5 h-5 text-muted-foreground" />
                      <span className="font-semibold">{lastScan.name}</span>
                    </div>
                    <Badge variant="outline" className="text-lg px-4 py-2">
                      {lastScan.type}
                    </Badge>
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{lastScan.time}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Last Scans */}
        {lastScan && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6"
          >
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                  Dernier pointage
                </h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    <span className="font-medium">{lastScan.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{lastScan.type}</p>
                    <p className="text-xs text-muted-foreground">{lastScan.time}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
};
