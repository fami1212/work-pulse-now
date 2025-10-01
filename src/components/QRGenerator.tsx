import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, QrCode as QrCodeIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface QRGeneratorProps {
  value: string;
  title?: string;
  size?: number;
}

export const QRGenerator = ({ value, title = 'Votre QR Code', size = 256 }: QRGeneratorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(
        canvasRef.current,
        value,
        {
          width: size,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'H',
        },
        (error) => {
          if (error) console.error('Error generating QR code:', error);
        }
      );
    }
  }, [value, size]);

  const handleDownload = () => {
    if (canvasRef.current) {
      const url = canvasRef.current.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `qr-code-${Date.now()}.png`;
      link.href = url;
      link.click();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <QrCodeIcon className="w-5 h-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex justify-center p-4 bg-muted/30 rounded-lg"
        >
          <canvas ref={canvasRef} className="rounded-lg shadow-lg" />
        </motion.div>
        
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-center font-mono break-all">
            {value}
          </p>
          <Button onClick={handleDownload} variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Télécharger le QR Code
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
