import React, { useRef, useEffect, useState } from 'react';
import axios from 'axios';

export default function CameraCapture({ classId, sessionDate, onRecognized, onError }) {
  const videoRef = useRef();
  const canvasRef = useRef();

  const [isCapturing, setIsCapturing] = useState(false);
  const [recognizedStudents, setRecognizedStudents] = useState(new Set());
  const [lastCapture, setLastCapture] = useState(null);
  const [permissionError, setPermissionError] = useState('');
  const [cameraStatus, setCameraStatus] = useState('initializing');
  const [lastRecognition, setLastRecognition] = useState(null);
  const [scanCount, setScanCount] = useState(0);

  // 🟢 Visual feedback overlay
  const [scanStatus, setScanStatus] = useState('Idle');
  const [scanColor, setScanColor] = useState('#17a2b8');

  useEffect(() => {
    let intervalId;
    let stream;

    async function startCamera() {
      try {
        setCameraStatus('requesting');
        console.log('📷 Requesting camera access...');

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera API not supported');
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false
        });

        console.log('✅ Camera access granted');
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = async () => {
            await videoRef.current.play();
            setCameraStatus('active');
            setIsCapturing(true);
            setPermissionError('');

            console.log('✅ Camera started. Beginning scans...');
            intervalId = setInterval(() => {
              captureAndRecognize();
            }, 3000);
          };
        }
      } catch (error) {
        console.error('❌ Camera access error:', error);
        setCameraStatus('error');
        setPermissionError(error.message || 'Camera permission denied');
        if (onError) onError(error.message);
      }
    }

    async function captureAndRecognize() {
      if (!videoRef.current || !classId || !sessionDate || cameraStatus !== 'active') return;

      if (videoRef.current.paused || videoRef.current.ended) return;

      setScanStatus('🟡 Scanning...');
      setScanColor('#ffc107');

      try {
        setScanCount((prev) => prev + 1);

        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0);

        canvas.toBlob(async (blob) => {
          if (!blob) return;

          const formData = new FormData();
          formData.append('image', blob, 'frame.jpg');

          try {
            const faceServiceUrl = process.env.REACT_APP_FACE_SERVICE_URL || 'http://localhost:5001';
            const response = await axios.post(`${faceServiceUrl}/recognize`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
              timeout: 10000
            });

            const matches = response.data;
            setLastCapture(new Date());
            console.log('📊 Recognition result:', matches);

            if (matches && matches.length > 0) {
              const match = matches[0];
              setScanStatus(`✅ Match: ${match.student_id} (${(match.confidence * 100).toFixed(1)}%)`);
              setScanColor('#28a745');

              const key = `${match.student_id}-${sessionDate}`;
              if (!recognizedStudents.has(key)) {
                await recordAttendance(match);
                setRecognizedStudents((prev) => new Set([...prev, key]));
                if (onRecognized) onRecognized(match);
                showSuccessNotification(match);
              }
            } else {
              setScanStatus('❌ No face detected');
              setScanColor('#dc3545');
            }
          } catch (err) {
            console.error('❌ Recognition error:', err.message);
            setScanStatus('⚠️ Recognition service unavailable');
            setScanColor('#6c757d');
          }
        }, 'image/jpeg', 0.85);
      } catch (err) {
        console.error('❌ Capture error:', err);
        setScanStatus('❌ Capture failed');
        setScanColor('#dc3545');
      }
    }

    async function recordAttendance(match) {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:4000';
        await axios.post(`${apiUrl}/api/attendance/record`, {
          class_id: parseInt(classId),
          student_id: match.student_id,
          session_date: sessionDate,
          method: 'face',
          confidence: match.confidence
        });
        console.log(`💾 Attendance recorded for ${match.student_id}`);
      } catch (err) {
        console.error('❌ Failed to record attendance:', err.message);
      }
    }

    function showSuccessNotification(match) {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px; right: 20px;
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        color: white; padding: 15px 25px;
        border-radius: 8px; font-weight: 600;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 9999;
      `;
      notification.innerHTML = `
        ✅ ${match.student_id} Recognized!<br>
        <small>Confidence: ${(match.confidence * 100).toFixed(1)}%</small>
      `;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 4000);
    }

    startCamera();

    // Cleanup
    return () => {
      console.log('🛑 Stopping camera...');
      if (intervalId) clearInterval(intervalId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsCapturing(false);
      setCameraStatus('stopped');
    };
  }, [classId, sessionDate, onRecognized, onError]);

  return (
    <div style={{ textAlign: 'center' }}>
      {/* Video feed */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <video
          ref={videoRef}
          style={{
            width: '100%',
            maxWidth: '640px',
            border: `3px solid ${cameraStatus === 'active' ? '#28a745' : '#ffc107'}`,
            borderRadius: '10px',
            backgroundColor: '#000'
          }}
          muted
          playsInline
          autoPlay
        />

        {/* 🟣 Overlay visual feedback */}
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: scanColor,
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            fontWeight: 'bold',
            fontSize: '14px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
          }}
        >
          {scanStatus}
        </div>
      </div>

      {/* Debug canvas */}
      <canvas ref={canvasRef} width="320" height="240" style={{ display: 'none' }} />

      {permissionError && (
        <div
          style={{
            marginTop: '15px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            padding: '10px',
            borderRadius: '8px'
          }}
        >
          <strong>⚠️ Camera Error:</strong> {permissionError}
        </div>
      )}

      <div
        style={{
          marginTop: '20px',
          padding: '10px',
          backgroundColor: '#e7f3ff',
          borderRadius: '6px',
          fontSize: '13px',
          color: '#004085'
        }}
      >
        <strong>ℹ️ How Face Recognition Works:</strong>
        <ul style={{ textAlign: 'left', margin: '8px 0', paddingLeft: '20px' }}>
          <li>Camera captures frames every 3 seconds</li>
          <li>Each frame is analyzed for faces</li>
          <li>Matched faces show confidence % (80%+ = strong match)</li>
          <li>Attendance recorded automatically</li>
          <li>Each student recorded once per session</li>
        </ul>
      </div>
    </div>
  );
}
