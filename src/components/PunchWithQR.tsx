import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { QrCode, X } from 'lucide-react';
import { QRScanner } from './QRScanner';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface PunchWithQRProps {
  onSuccess?: () => void;
  punchType: 'in' | 'out' | 'break_start' | 'break_end';
}

export const PunchWithQR = ({ onSuccess, punchType }: PunchWithQRProps) => {
  const [showScanner, setShowScanner] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleScanSuccess = async (decodedText: string) => {
    if (!user) return;

    try {
      // Verify QR code belongs to the user
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('qr_code, user_id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile) {
        toast({
          title: 'Erreur',
          description: 'Profil introuvable',
          variant: 'destructive',
        });
        return;
      }

      if (profile.qr_code !== decodedText) {
        toast({
          title: 'QR Code invalide',
          description: 'Ce QR code ne correspond pas à votre profil',
          variant: 'destructive',
        });
        return;
      }

      // Add punch record
      const { error: punchError } = await supabase
        .from('punch_records')
        .insert([{
          user_id: user.id,
          type: punchType,
          timestamp: new Date().toISOString(),
          method: 'qr_code'
        }]);

      if (punchError) throw punchError;

      const messages = {
        'in': 'Pointage d\'entrée par QR code enregistré',
        'out': 'Pointage de sortie par QR code enregistré',
        'break_start': 'Début de pause par QR code enregistré',
        'break_end': 'Fin de pause par QR code enregistrée'
      };

      toast({
        title: 'Succès',
        description: messages[punchType],
      });

      setShowScanner(false);
      onSuccess?.();
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
    <>
      <Button
        variant="outline"
        onClick={() => setShowScanner(true)}
        className="flex items-center gap-2"
      >
        <QrCode className="w-4 h-4" />
        Scanner QR Code
      </Button>

      {showScanner && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <QRScanner
              onScanSuccess={handleScanSuccess}
              onClose={() => setShowScanner(false)}
              title="Scanner votre QR Code"
            />
          </Card>
        </div>
      )}
    </>
  );
};
