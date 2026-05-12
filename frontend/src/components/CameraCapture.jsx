// src/components/CameraCapture.jsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { faceApi, api } from '../services/api';
import axios from 'axios';

function base64ToBlob(base64) {
  const byteString = atob(base64.split(',')[1]);
  const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];

  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);

  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  return new Blob([ab], { type: mimeString });
}

export default function CameraCapture({ classId, sessionId, sessionDate, onRecognized, onError }) {
  const videoRef = useRef(null);
  const debugCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);

  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const recognizedRef = useRef(new Set());
  const cameraStatusRef = useRef('idle');

  const [cameraStatus, setCameraStatus] = useState('idle'); // 'idle'|'requesting'|'active'|'stopped'|'error'
  const [permissionError, setPermissionError] = useState('');
  const [scanStatus, setScanStatus] = useState('Idle');
  const [scanColor, setScanColor] = useState('#17a2b8');
  const [scanCount, setScanCount] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState([]);

  // Update ref when cameraStatus changes
  useEffect(() => {
    cameraStatusRef.current = cameraStatus;
  }, [cameraStatus]);

  // Draw enhanced bounding boxes
  const drawBoundingBoxes = useCallback((faces, videoWidth, videoHeight) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    
    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    faces.forEach((face, index) => {
      // Scale face coordinates to video dimensions
      const x = (face.x / 100) * videoWidth;
      const y = (face.y / 100) * videoHeight;
      const width = (face.width / 100) * videoWidth;
      const height = (face.height / 100) * videoHeight;
      
      // Choose colors based on recognition status
      const strokeColor = face.recognized ? '#28a745' : '#ffc107';
      const fillColor = face.recognized ? 'rgba(40, 167, 69, 0.2)' : 'rgba(255, 193, 7, 0.2)';
      const textColor = face.recognized ? '#ffffff' : '#000000';
      
      // Draw filled rectangle with transparency
      ctx.fillStyle = fillColor;
      ctx.fillRect(x, y, width, height);
      
      // Draw rectangle border
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);
      
      // Draw label background for better visibility
      const labelText = face.recognized ? `${face.student_id}` : `Face ${index + 1}`;
      ctx.font = 'bold 14px Arial';
      const textWidth = ctx.measureText(labelText).width;
      const textHeight = 20;
      const padding = 8;
      
      // Draw label background with rounded corners
      ctx.fillStyle = strokeColor;
      ctx.fillRect(x - padding, y - textHeight - padding, textWidth + padding * 2, textHeight + padding * 2);
      
      // Draw label text
      ctx.fillStyle = textColor;
      ctx.fillText(labelText, x, y - 5);
      
      // Draw confidence below label
      if (face.confidence) {
        ctx.font = '12px Arial';
        ctx.fillStyle = textColor;
        ctx.fillText(`${Math.round(face.confidence)}%`, x, y + textHeight + 5);
      }
      
      // Draw corner indicators for recognized faces
      if (face.recognized) {
        ctx.fillStyle = '#28a745';
        ctx.beginPath();
        ctx.arc(x + width, y + height, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  }, []);

  const setBanner = useCallback((text, color) => {
    setScanStatus(text);
    setScanColor(color);
  }, []);

  const showSuccessNotification = useCallback((studentId, confidencePercent) => {
    const note = document.createElement('div');
    note.style.cssText = 'position: fixed; top: 18px; right: 18px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 10px 14px; border-radius: 8px; z-index: 99999; font-weight: 700;';
    note.innerHTML = `\u2705 ${studentId} recognized<br/><small>${Math.round(confidencePercent)}%</small>`;
    document.body.appendChild(note);
    setTimeout(() => note.remove(), 3000);
  }, []);

  // small helper sleep
  const sleep = (ms) => new Promise(res => setTimeout(res, ms));

  // Generic retry wrapper for async functions
  const retry = async (fn, attempts = 3, baseDelay = 700) => {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        
        // DO NOT retry on 400 errors (bad request - validation failure)
        if (err.response?.status === 400) {
          console.error('Bad request - invalid image payload, not retrying');
          throw err;
        }
        
        const delay = baseDelay * Math.pow(2, i); // exponential-ish backoff
        console.warn(`Attempt ${i + 1} failed. Retrying in ${delay}ms...`, err?.message || err);
        await sleep(delay);
      }
    }
    throw lastErr;
  };

  // This component should ONLY recognize faces and emit matches.
  // Persisting attendance is handled by the parent so session scoping is consistent.

  const captureAndRecognize = useCallback(async () => {
    const video = videoRef.current;
    if (!video || cameraStatusRef.current !== 'active') return;
    if (video.paused || video.ended) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    setBanner('🟡 Scanning...', '#ffc107');
    setScanCount(c => c + 1);

    try {
      // draw frame to canvas
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, w, h);

      // optional debug draw
      if (debugCanvasRef.current) {
        const dbg = debugCanvasRef.current.getContext('2d');
        dbg.clearRect(0, 0, debugCanvasRef.current.width, debugCanvasRef.current.height);
        dbg.drawImage(canvas, 0, 0, debugCanvasRef.current.width, debugCanvasRef.current.height);
      }

      // Capture image as base64 string
      const imageSrc = canvas.toDataURL("image/jpeg");
      
      // Add debug logs
      console.log("Captured image:", imageSrc?.slice(0, 50));
      console.log("Type:", typeof imageSrc);
      console.log("VALUE:", imageSrc?.substring(0, 50));
      
      // Validate image capture
      if (!imageSrc || typeof imageSrc !== "string") {
        throw new Error("Invalid image capture");
      }

      // Face recognition request with retries - this is where you saw timeouts
      const callFaceService = async () => {
        if (!imageSrc || typeof imageSrc !== "string" || imageSrc.length < 1000) {
          throw new Error("Invalid image capture");
        }

        console.log("Sending image length:", imageSrc.length);

        try {
          // Convert base64 to Blob for FormData
          const imageBlob = base64ToBlob(imageSrc);
          const formData = new FormData();
          formData.append('image', imageBlob, 'capture.jpg');
          formData.append('class_id', String(classId));
          formData.append('session_id', String(sessionId));

          const response = await axios.post(
            "/api/face/recognize",
            formData,
            {
              headers: {
                "Content-Type": "multipart/form-data"
              }
            }
          );

          if (!response || !response.data) {
            console.error("Empty response from backend");
            return;
          }

          console.log("SUCCESS:", response.data);
          return response;

        } catch (error) {
          if (error.response) {
            console.error("API ERROR:", error.response.data);
          } else if (error.request) {
            console.error("NO RESPONSE FROM SERVER");
          } else {
            console.error("REQUEST ERROR:", error.message);
          }
          throw error;
        }
      };

      // Try up to 3 attempts with exponential-ish backoff
      let resp;
      try {
        setBanner('🟡 Contacting face service...', '#ffc107');
        resp = await retry(callFaceService, 3, 800);
      } catch (err) {
        console.error('Face service unreachable after retries', err?.message || err);
        setBanner('⚠️ Face service timeout', '#6c757d');
        return;
      }

      console.debug('Face service response:', resp?.data);

      // Handle different response scenarios
      if (!resp || !resp.data || resp.data.error) {
        setBanner('❌ Request failed', '#dc3545');
        setDetectedFaces([]);
        return;
      }

      const matches = Array.isArray(resp.data.matches) ? resp.data.matches : [];
      const facesDetected = resp.data.faces_detected || 0;
      
      if (!resp.data.success) {
        setBanner('❌ Request failed', '#dc3545');
        setDetectedFaces([]);
        return;
      }

      if (facesDetected === 0) {
        setBanner('❌ No face detected', '#dc3545');
        setDetectedFaces([]);
        return;
      }

      // Prepare face data for bounding boxes
      const faceData = [];
      let recognizedCount = 0;

      // Add detected faces (even if not recognized)
      for (let i = 0; i < facesDetected; i++) {
        const match = matches.find(m => m.face_index === i);
        if (match) {
          // Recognized face
          let rawConfidence = typeof match.confidence === 'number' ? match.confidence : parseFloat(match.confidence);
          if (Number.isNaN(rawConfidence)) rawConfidence = 0;
          const confidencePercent = rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence;
          
          faceData.push({
            x: match.x || 20 + (i * 25), // Default positioning if no coords
            y: match.y || 20,
            width: match.width || 20,
            height: match.height || 25,
            recognized: confidencePercent > 50,
            student_id: match.student_id,
            confidence: confidencePercent
          });
          
          if (confidencePercent > 50) {
            recognizedCount++;
            const key = `${match.student_id}-${sessionDate}`;
            
            // only emit once per student/session
            if (!recognizedRef.current.has(key)) {
              recognizedRef.current.add(key);
              showSuccessNotification(match.student_id, confidencePercent);
              if (onRecognized) onRecognized({ ...match, confidence_percent: confidencePercent });
            }
          }
        } else {
          // Unrecognized face
          faceData.push({
            x: 20 + (i * 25),
            y: 20,
            width: 20,
            height: 25,
            recognized: false,
            student_id: null,
            confidence: 0
          });
        }
      }

      // Draw bounding boxes with proper video dimensions
      const video = videoRef.current;
      if (video && video.videoWidth && video.videoHeight) {
        drawBoundingBoxes(faceData, video.videoWidth, video.videoHeight);
      } else {
        // Fallback dimensions if video not ready
        drawBoundingBoxes(faceData, 640, 480);
      }
      setDetectedFaces(faceData);

      // Update status banner
      if (recognizedCount > 0) {
        setBanner(`✅ ${recognizedCount} face(s) recognized`, '#28a745');
      } else {
        setBanner(`❌ ${facesDetected} face(s) detected, none recognized`, '#dc3545');
      }

    } catch (err) {
      console.error('Recognition error', err);
      setBanner('⚠️ Recognition unavailable', '#6c757d');
      if (onError) onError(err);
    }
  }, [cameraStatus, isScanning, sessionDate, setBanner, showSuccessNotification, onRecognized, onError, drawBoundingBoxes]);

  const startCamera = useCallback(async () => {
    try {
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Camera requires HTTPS");
        setPermissionError('Camera API not supported in this browser');
        setCameraStatus('error');
        onError(new Error('Camera API not supported'));
        return;
      }

      setCameraStatus('requesting');
      setPermissionError('');
      recognizedRef.current = new Set();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      streamRef.current = stream;

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      await new Promise((resolve) => {
        const check = () => {
          if (videoRef.current && videoRef.current.videoWidth) resolve();
          else setTimeout(check, 100);
        };
        check();
      });

      setCameraStatus('active');
      setBanner('🔵 Camera active', '#17a2b8');
      intervalRef.current = setInterval(() => {
        captureAndRecognize();
      }, 3000);
    } catch (err) {
      console.error('Camera start failed', err);
      setCameraStatus('error');
      setPermissionError('Please allow camera access');
      if (onError) onError(err);
    }
  }, [cameraStatus, isScanning, captureAndRecognize]);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    
    // Clear overlay canvas
    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }
    
    setDetectedFaces([]);
    setCameraStatus('stopped');
    setBanner('Stopped', '#6c757d');
    setIsScanning(false);
  }, [setBanner]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const handleStartClick = async () => {
    setIsScanning(true);
    await startCamera();
  };

  const handleStopClick = () => {
    stopCamera();
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <video
          ref={videoRef}
          style={{
            width: '100%',
            maxWidth: 640,
            borderRadius: 10,
            border: `4px solid ${cameraStatus === 'active' ? '#28a745' : '#ccc'}`
          }}
          muted
          playsInline
        />
        <canvas
          ref={overlayCanvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            borderRadius: 10,
            zIndex: 10  // Ensure canvas is on top
          }}
        />
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          backgroundColor: scanColor, color: 'white',
          padding: '8px 14px', borderRadius: 20, fontWeight: 700,
          zIndex: 10
        }}>
          {scanStatus}
        </div>
      </div>

      {/* Debug canvas hidden by default */}
      <div style={{ height: 0, overflow: 'hidden' }}>
        <canvas ref={debugCanvasRef} width={320} height={240} />
      </div>

      <div style={{ marginTop: 12 }}>
        {permissionError && (
          <div style={{ color: '#dc3545', fontWeight: 700, marginBottom: 12 }}>
            {permissionError}
          </div>
        )}
        {cameraStatus !== 'active' ? (
          <button onClick={handleStartClick} style={{ padding: '10px 14px', background: '#17a2b8', color: '#fff', borderRadius: 6 }}>
            ▶ Start Scanning
          </button>
        ) : (
          <button onClick={handleStopClick} style={{ padding: '10px 14px', background: '#dc3545', color: '#fff', borderRadius: 6 }}>
            ■ Stop
          </button>
        )}
        <span style={{ marginLeft: 12, fontWeight: 700 }}>Scans: {scanCount}</span>
        {detectedFaces.length > 0 && (
          <span style={{ marginLeft: 12, fontWeight: 700, color: '#28a745' }}>
            Faces: {detectedFaces.filter(f => f.recognized).length}/{detectedFaces.length}
          </span>
        )}
      </div>
    </div>
  );
}
