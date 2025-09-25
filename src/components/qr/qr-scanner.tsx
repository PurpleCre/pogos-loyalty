import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, Camera } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (data: string) => void;
}

export function QRScanner({ isOpen, onClose, onScanSuccess }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [qrScanner, setQrScanner] = useState<QrScanner | null>(null);
  const [hasCamera, setHasCamera] = useState(true);

  useEffect(() => {
    if (isOpen && videoRef.current) {
      const video = videoRef.current;
      
      // Reset hasCamera state when opening
      setHasCamera(true);
      
      const scanner = new QrScanner(
        video,
        (result) => {
          onScanSuccess(result.data);
          onClose();
          toast({
            title: "QR Code Scanned!",
            description: "Points added to your account",
          });
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: "environment",
          maxScansPerSecond: 5,
          returnDetailedScanResult: true,
        }
      );

      // Add event listeners to ensure video starts playing
      const handleLoadedData = () => {
        console.log("Video loaded, starting scanner");
        video.play().catch(console.error);
      };

      const handleCanPlay = () => {
        console.log("Video can play");
        video.play().catch(console.error);
      };

      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('canplay', handleCanPlay);

      scanner
        .start()
        .then(() => {
          console.log("QR Scanner started successfully");
          setQrScanner(scanner);
          // Ensure video is playing
          video.play().catch(console.error);
        })
        .catch((error) => {
          console.error("Failed to start QR scanner:", error);
          setHasCamera(false);
          toast({
            title: "Camera Error",
            description: "Unable to access camera. Please check permissions.",
            variant: "destructive",
          });
        });

      return () => {
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('canplay', handleCanPlay);
        scanner.stop();
        scanner.destroy();
      };
    }
  }, [isOpen, onScanSuccess, onClose]);

  useEffect(() => {
    return () => {
      if (qrScanner) {
        qrScanner.stop();
        qrScanner.destroy();
      }
    };
  }, [qrScanner]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Scan Receipt QR Code
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {hasCamera ? (
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full rounded-lg bg-muted"
                style={{ aspectRatio: "1/1" }}
                playsInline
                muted
                autoPlay
                webkit-playsinline="true"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-primary rounded-lg shadow-lg">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg"></div>
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg"></div>
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg"></div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg"></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Camera className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Camera access required to scan QR codes
              </p>
            </div>
          )}

          <div className="text-center text-sm text-muted-foreground">
            Position the QR code from your receipt within the frame
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}