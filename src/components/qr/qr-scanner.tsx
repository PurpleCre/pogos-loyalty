import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, Camera } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";
import { BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (data: string) => void;
}

export function QRScanner({ isOpen, onClose, onScanSuccess }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [qrScanner, setQrScanner] = useState<QrScanner | null>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  const isNative = Capacitor.isNativePlatform();

  // Request camera permissions
  const requestPermission = async () => {
    if (isNative) {
      try {
        const { camera } = await BarcodeScanner.requestPermissions();
        if (camera === "granted" || camera === "limited") {
          setPermissionGranted(true);
          return true;
        } else {
          setPermissionGranted(false);
          toast({
            title: "Permission Denied",
            description: "Camera access is required to scan QR codes.",
            variant: "destructive",
          });
          return false;
        }
      } catch (err) {
        console.error("Native permission error:", err);
        setPermissionGranted(false);
        return false;
      }
    } else {
      // Browser fallback
      const hasCam = await QrScanner.hasCamera();
      setPermissionGranted(hasCam);
      if (!hasCam) {
        toast({
          title: "No Camera Found",
          description: "This device does not have an accessible camera.",
          variant: "destructive",
        });
      }
      return hasCam;
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const initScanner = async () => {
      const granted = await requestPermission();
      if (!granted) return;

      if (isNative) {
        // ✅ Native ML Kit scan
        try {
          const result = await BarcodeScanner.scan();
          if (result.barcodes.length > 0) {
            const code = result.barcodes[0].rawValue ?? "";
            onScanSuccess(code);
            toast({
              title: "QR Code Scanned!",
              description: code,
            });
          }
        } catch (err: any) {
          console.error("Native scan error:", err);
          // Don't show error toast if user cancelled
          if (err?.message !== "scan canceled" && !err?.message?.includes("cancel")) {
            toast({
              title: "Scan Failed",
              description: "Unable to scan QR code.",
              variant: "destructive",
            });
          }
        } finally {
          // Always close dialog after scan attempt
          onClose();
        }
      } else {
        // ✅ Web fallback with qr-scanner
        if (videoRef.current) {
          const video = videoRef.current;
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

          scanner
            .start()
            .then(() => {
              console.log("Web QR Scanner started");
              setQrScanner(scanner);
            })
            .catch((error) => {
              console.error("Failed to start Web QR scanner:", error);
              setHasCamera(false);
              toast({
                title: "Camera Error",
                description: "Unable to access camera. Check permissions.",
                variant: "destructive",
              });
            });

          return () => {
            scanner.stop();
            scanner.destroy();
          };
        }
      }
    };

    initScanner();
  }, [isOpen, onScanSuccess, onClose, isNative]);

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

        {!isNative ? (
          <div className="space-y-4">
            {permissionGranted === false ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Camera className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Camera permission is required to scan QR codes.
                </p>
              </div>
            ) : hasCamera ? (
              <div className="relative">
                <video
                  ref={videoRef}
                  className="w-full rounded-lg bg-muted"
                  style={{ aspectRatio: "1/1" }}
                  playsInline
                  muted
                  autoPlay
                />
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
              Position the QR code within the frame
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Camera className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Scanning with native camera...
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}