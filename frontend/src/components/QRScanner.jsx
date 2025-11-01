import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';

// 🧠 Helper: auto-enhance image contrast/brightness before scanning
async function enhanceImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const size = 400;
      canvas.width = size;
      canvas.height = size;

      // Increase contrast & brightness for better QR detection
      ctx.filter = 'contrast(180%) brightness(120%)';
      ctx.drawImage(img, 0, 0, size, size);

      // Convert back to blob
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    };
    img.src = URL.createObjectURL(file);
  });
}

export default function QRScanner({ onScan, onError }) {
  const scannerRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastScanTime, setLastScanTime] = useState(0);

  // Initialize the camera QR scanner
  useEffect(() => {
    if (scannerRef.current) return;

    // Hide default html5-qrcode error messages
    const styleId = 'qr-scanner-hide-errors';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        #qr-reader__status_span { display: none !important; }
        #qr-reader { border-radius: 8px; overflow: hidden; }
      `;
      document.head.appendChild(style);
    }

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true,
        verbose: false,
      },
      false
    );

    scanner.render(
      (decodedText) => {
        const now = Date.now();
        if (now - lastScanTime < 2000) return; // avoid duplicate scans
        setLastScanTime(now);

        console.log('✅ QR Code scanned:', decodedText);
        setIsScanning(true);
        setErrorMessage('');

        if (onScan) onScan(decodedText);
      },
      (error) => {
        let errorStr = '';
        try {
          if (typeof error === 'string') errorStr = error.toLowerCase();
          else if (error && typeof error === 'object')
            errorStr = (error.message || error.toString() || '').toLowerCase();
          else errorStr = String(error || '').toLowerCase();
        } catch {
          errorStr = '';
        }

        if (
          !errorStr ||
          errorStr.includes('notfoundexception') ||
          errorStr.includes('no multiformat readers') ||
          errorStr.includes('notfounderror') ||
          errorStr.includes('failed to detect')
        ) {
          // Normal scanning process (no actual error)
          return;
        }

        if (errorStr.includes('permission')) {
          const msg = '🚫 Camera permission denied.';
          setErrorMessage(msg);
          if (onError) onError(msg);
        } else if (errorStr.includes('camera not found')) {
          const msg = '📷 No camera found.';
          setErrorMessage(msg);
          if (onError) onError(msg);
        } else if (errorStr.includes('overconstrained')) {
          const msg = '⚙️ Camera settings not supported.';
          setErrorMessage(msg);
          if (onError) onError(msg);
        }
      }
    );

    scannerRef.current = scanner;
    setIsScanning(true);

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch((err) => console.log('Scanner cleanup:', err));
        scannerRef.current = null;
      }
    };
  }, [onScan, onError, lastScanTime]);

  // Handle file upload and enhance before scanning
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const enhancedBlob = await enhanceImage(file);
      const result = await Html5Qrcode.scanFile(enhancedBlob, false);
      console.log("✅ Scanned from file:", result);
      setErrorMessage('');
      if (onScan) onScan(result);
    } catch (error) {
      console.error("❌ QR scan failed:", error);
      setErrorMessage("Unable to detect QR code from image. Try a clearer PNG (≥300px).");
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div id="qr-reader" style={{ width: '100%' }}></div>

      <input
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        style={{ marginTop: '10px', display: 'block' }}
      />

      {errorMessage && (
        <div style={{
          padding: '15px',
          marginTop: '15px',
          backgroundColor: '#fee',
          border: '2px solid #fcc',
          borderRadius: '8px',
          color: '#c33',
          textAlign: 'center',
          fontWeight: '600'
        }}>
          {errorMessage}
        </div>
      )}

      {isScanning && !errorMessage && (
        <div style={{
          textAlign: 'center',
          marginTop: '15px',
          padding: '15px',
          backgroundColor: '#f0fff4',
          border: '2px solid #9ae6b4',
          borderRadius: '8px'
        }}>
          <p style={{ color: '#22543d', fontSize: '16px', fontWeight: '600', margin: '8px 0' }}>
            🟢 Scanner Ready
          </p>
          <p style={{ color: '#2d3748', fontSize: '14px', margin: '8px 0' }}>
            📷 Position QR code in the box or upload an image
          </p>
          <p style={{ fontSize: '13px', color: '#718096', margin: '8px 0' }}>
            💡 Tip: Use high-quality, clear QR code images
          </p>
        </div>
      )}
    </div>
  );
}
