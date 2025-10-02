import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QrCode, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
  title?: string;
}

export const QRScanner = ({ onScanSuccess, onClose, title = 'Scanner le QR Code' }: QRScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannerDivIdRef = useRef('qr-scanner-' + Math.random().toString(36).substr(2, 9));

  useEffect(() => {
    if (isScanning && !scannerRef.current) {
      // Attendre que le DOM soit prêt
      const timeoutId = setTimeout(() => {
        const element = document.getElementById(scannerDivIdRef.current);
        if (!element) {
          console.error('Scanner element not found:', scannerDivIdRef.current);
          return;
        }

        const scanner = new Html5QrcodeScanner(
          scannerDivIdRef.current,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
            showTorchButtonIfSupported: true,
            showZoomSliderIfSupported: true,
          },
          false
        );

        scanner.render(
          (decodedText) => {
            setScannedCode(decodedText);
            scanner.clear().catch(console.error);
            setTimeout(() => {
              onScanSuccess(decodedText);
            }, 1000);
          },
          (errorMessage) => {
            // Ignorer les erreurs de scan en cours
          }
        );

        scannerRef.current = scanner;
      }, 100);

      return () => clearTimeout(timeoutId);
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [isScanning, onScanSuccess]);

  const handleStartScan = () => {
    setIsScanning(true);
  };

  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
    }
    setIsScanning(false);
    setScannedCode(null);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              {title}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <AnimatePresence mode="wait">
            {!isScanning && !scannedCode && (
              <motion.div
                key="start"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-lg">
                  <QrCode className="w-16 h-16 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    Cliquez sur le bouton ci-dessous pour activer la caméra et scanner un code QR
                  </p>
                  <Button onClick={handleStartScan} className="w-full">
                    <QrCode className="w-4 h-4 mr-2" />
                    Activer la caméra
                  </Button>
                </div>
              </motion.div>
            )}

            {isScanning && !scannedCode && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div id={scannerDivIdRef.current} className="w-full" />
                <div className="flex items-center justify-center gap-2">
                  <Badge variant="outline" className="animate-pulse">
                    <div className="w-2 h-2 bg-primary rounded-full mr-2" />
                    Scan en cours...
                  </Badge>
                </div>
              </motion.div>
            )}

            {scannedCode && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="space-y-4"
              >
                <div className="flex flex-col items-center justify-center p-8 bg-success/10 border-2 border-success rounded-lg">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                  >
                    <Check className="w-16 h-16 text-success mb-4" />
                  </motion.div>
                  <p className="text-sm font-medium text-success text-center">
                    Code scanné avec succès !
                  </p>
                  <p className="text-xs text-muted-foreground text-center mt-2 font-mono">
                    {scannedCode}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
};
