/**
 * Camera Scanner Component
 * Uses ZXing library for barcode detection via device camera
 * Requirements: 1.1, 1.2, 5.1
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { Camera, CameraOff, X, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

export interface CameraScannerProps {
  onScan: (barcode: string) => void;
  onError: (error: string) => void;
  isActive: boolean;
  onClose?: () => void;
  continuous?: boolean; // For stock opname mode
}

export const CameraScanner: React.FC<CameraScannerProps> = ({
  onScan,
  onError,
  isActive,
  onClose,
  continuous = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>(undefined);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize reader
  useEffect(() => {
    readerRef.current = new BrowserMultiFormatReader();
    
    return () => {
      stopScanning();
      readerRef.current = null;
    };
  }, []);


  // Get available cameras
  useEffect(() => {
    const getCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setAvailableCameras(videoDevices);
        
        // Prefer back camera for mobile devices
        const backCamera = videoDevices.find(
          device => device.label.toLowerCase().includes('back') || 
                    device.label.toLowerCase().includes('rear')
        );
        if (backCamera) {
          setSelectedCameraId(backCamera.deviceId);
        } else if (videoDevices.length > 0) {
          setSelectedCameraId(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error('Failed to enumerate cameras:', err);
      }
    };

    if (isActive) {
      getCameras();
    }
  }, [isActive]);

  // Stop scanning function
  const stopScanning = useCallback(() => {
    if (readerRef.current) {
      readerRef.current.reset();
    }
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // Start scanning function
  const startScanning = useCallback(async () => {
    if (!readerRef.current || !videoRef.current || !isActive) return;

    try {
      setIsScanning(true);
      setHasPermission(null);

      await readerRef.current.decodeFromVideoDevice(
        selectedCameraId,
        videoRef.current,
        (result, error) => {
          if (result) {
            const code = result.getText();
            
            // In continuous mode, prevent duplicate scans within 2 seconds
            if (continuous) {
              if (code === lastScannedCode) return;
              setLastScannedCode(code);
              
              // Reset last scanned code after 2 seconds
              if (scanTimeoutRef.current) {
                clearTimeout(scanTimeoutRef.current);
              }
              scanTimeoutRef.current = setTimeout(() => {
                setLastScannedCode(null);
              }, 2000);
            }
            
            onScan(code);
            
            // In non-continuous mode, stop after successful scan
            if (!continuous) {
              stopScanning();
            }
          }
          
          if (error && !(error instanceof NotFoundException)) {
            console.error('Scan error:', error);
          }
        }
      );

      setHasPermission(true);
    } catch (err) {
      setHasPermission(false);
      setIsScanning(false);
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          onError('Akses kamera ditolak. Silakan izinkan akses kamera di pengaturan browser.');
        } else if (err.name === 'NotFoundError') {
          onError('Kamera tidak ditemukan pada perangkat ini.');
        } else {
          onError(`Gagal mengakses kamera: ${err.message}`);
        }
      } else {
        onError('Gagal mengakses kamera');
      }
    }
  }, [isActive, selectedCameraId, continuous, lastScannedCode, onScan, onError, stopScanning]);


  // Start/stop scanning based on isActive
  useEffect(() => {
    if (isActive && selectedCameraId) {
      startScanning();
    } else {
      stopScanning();
    }

    return () => {
      stopScanning();
    };
  }, [isActive, selectedCameraId, startScanning, stopScanning]);

  // Handle camera switch
  const handleCameraSwitch = () => {
    if (availableCameras.length <= 1) return;
    
    const currentIndex = availableCameras.findIndex(c => c.deviceId === selectedCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    setSelectedCameraId(availableCameras[nextIndex].deviceId);
  };

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50">
        <div className="flex items-center gap-2 text-white">
          <Camera className="w-5 h-5" />
          <span className="font-medium">
            {continuous ? 'Mode Scan Berkelanjutan' : 'Scan Barcode'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {availableCameras.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCameraSwitch}
              className="text-white hover:bg-white/20"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                stopScanning();
                onClose();
              }}
              className="text-white hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {hasPermission === false ? (
          <div className="text-center text-white p-8">
            <CameraOff className="w-16 h-16 mx-auto mb-4 text-red-400" />
            <p className="text-lg font-medium mb-2">Akses Kamera Ditolak</p>
            <p className="text-sm text-gray-300 mb-4">
              Silakan izinkan akses kamera di pengaturan browser untuk menggunakan fitur scan.
            </p>
            <Button
              variant="outline"
              onClick={startScanning}
              className="text-white border-white hover:bg-white/20"
            >
              Coba Lagi
            </Button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            
            {/* Scanning Overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Darkened corners */}
              <div className="absolute inset-0 bg-black/40" />
              
              {/* Clear scanning area */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-48">
                {/* Clear center */}
                <div className="absolute inset-0 bg-transparent" style={{
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)'
                }} />
                
                {/* Corner brackets */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary-500 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary-500 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary-500 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary-500 rounded-br-lg" />
                
                {/* Scanning line animation */}
                {isScanning && (
                  <div className="absolute left-2 right-2 h-0.5 bg-primary-500 animate-pulse"
                    style={{
                      top: '50%',
                      boxShadow: '0 0 8px 2px rgba(99, 102, 241, 0.6)'
                    }}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-black/50 text-center">
        <p className="text-white/80 text-sm">
          {continuous 
            ? 'Arahkan kamera ke barcode. Scan akan berlanjut otomatis.'
            : 'Arahkan kamera ke barcode produk'}
        </p>
        {lastScannedCode && continuous && (
          <p className="text-primary-400 text-xs mt-1">
            Terakhir scan: {lastScannedCode}
          </p>
        )}
      </div>
    </div>
  );
};

export default CameraScanner;
