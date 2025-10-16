import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function QRScanner({ onScan, onError }) {
  const scannerRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (scannerRef.current) return; // Already initialized

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true
      },
      false
    );

    scanner.render(
      (decodedText) => {
        console.log('✓ QR Code scanned:', decodedText);
        setIsScanning(false);
        if (onScan) {
          onScan(decodedText);
        }
        // Optionally clear scanner after successful scan
        // scanner.clear();
      },
      (error) => {
        // Ignore continuous scanning errors (NotFoundException is normal)
        if (onError && !error.includes('NotFoundException')) {
          onError(error);
        }
      }
    );

    scannerRef.current = scanner;
    setIsScanning(true);

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [onScan, onError]);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div id="qr-reader" style={{ width: '100%' }}></div>
      {isScanning && (
        <p style={{ textAlign: 'center', marginTop: '10px', color: '#666' }}>
          📷 Position QR code in front of camera
        </p>
      )}
    </div>
  );
}