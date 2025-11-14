import React, { useRef, useEffect, useState, useCallback } from 'react';
import axios from 'axios';

/**
 * CameraCapture
 * Props:
 *  - classId (number|string) required
 *  - sessionDate (YYYY-MM-DD string) required
 *  - onRecognized(match) optional callback when a new student is recorded
 *  - onError(errorMessage) optional callback for errors
 */
export default function CameraCapture({ classId, sessionDate, onRecognized, onError }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Refs for mutable items so closures inside the interval keep working
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const recognizedRef = useRef(new Set()); // stores keys like "STU001-2025-11-10"
  const mountedRef = useRef(true);

  // UI state
  const [cameraStatus, setCameraStatus] = useState('initializing'); // 'initializing' | 'requesting' | 'active' | 'error' | 'stopped'
  const [permissionError, setPermissionError] = useState('');
  const [scanStatus, setScanStatus] = useState('Idle');
  const [scanColor, setScanColor] = useState('#17a2b8'); // default blue
  const [scanCount, setScanCount] = useState(0);
  const [lastRecognition, setLastRecognition] = useState(null);

  // Config from environment with fallbacks
  const BACKEND_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
  const FACE_URL = process.env.REACT_APP_FACE_SERVICE_URL || 'http://localhost:5001';

  // Helper: mark status with color/text
  const setBanner = useCallback((text, color) => {
    if (!mountedRef.current) return;
    setScanStatus(text);
    setScanColor(color);
  }, []);

  // Record attendance with retries (basic)
  const recordAttendance = useCallback(async (match) => {
    const apiUrl = BACKEND_URL.replace(/\/$/, '');
    const payload = {
      class_id: parseInt(classId, 10),
      student_id: match.student_id,
      session_date: sessionDate,
      method: 'face',
      confidence: match.confidence
    };

    const url = `${apiUrl}/api/attendance/record`;

    // try 2 times in case of temporary network error
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await axios.post(url, payload, { timeout: 8000 });
        console.log(`✅ Attendance recorded for ${match.student_id} (attempt ${attempt})`);
        return true;
      } catch (err) {
        console.warn(`⚠️ recordAttendance attempt ${attempt} failed:`, err?.message || err);
        if (attempt === 2) {
          console.error('❌ Failed to record attendance after retries', err);
          return false;
        }
        // small delay before retry
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
    return false;
  }, [BACKEND_URL, classId, sessionDate]);

  // Show small on-screen notification
  const showSuccessNotification = useCallback((match) => {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      background: linear-gradient(135deg,#28a745 0%,#20c997 100%);
      color: white;
      padding: 10px 16px;
      border-radius: 8px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.15);
      z-index: 99999;
      font-weight: 700;
      font-family: sans-serif;
      font-size: 13px;
    `;
    notification.innerHTML = `✅ ${match.student_id} recognized<br/><small style="opacity:0.9">${Math.round(match.confidence * 100)}% confidence</small>`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3500);
  }, []);

  // Core: capture a frame and send to face service
  const captureAndRecognize = useCallback(async () => {
    if (!videoRef.current || cameraStatus !== 'active') return;
    if (!classId || !sessionDate) {
      console.warn('Skipping capture - classId or sessionDate missing');
      return;
    }
    try {
      setBanner('🟡 Scanning...', '#ffc107');
      setScanCount(c => c + 1);

      // create offscreen canvas based on video size
      const w = videoRef.current.videoWidth || 640;
      const h = videoRef.current.videoHeight || 480;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, w, h);

      // store small debug copy in hidden canvasRef (optional)
      if (canvasRef.current) {
        const dbg = canvasRef.current.getContext('2d');
        dbg.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        dbg.drawImage(canvas, 0, 0, canvasRef.current.width, canvasRef.current.height);
      }

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      if (!blob) {
        setBanner('❌ Capture failed', '#dc3545');
        return;
      }

      const form = new FormData();
      form.append('image', blob, 'frame.jpg');

      // Call face recognition microservice
      const faceUrl = FACE_URL.replace(/\/$/, '');
      const resp = await axios.post(`${faceUrl}/recognize`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 10000
      });

      const matches = Array.isArray(resp.data) ? resp.data : [];
      console.log('Face service response:', matches);

      if (matches.length === 0) {
        setBanner('❌ No face detected', '#dc3545');
        return;
      }

      // choose best match (if face-service already returns best-first, we take first)
      const match = matches[0];
      const key = `${match.student_id}-${sessionDate}`;

      setBanner(`✅ Match: ${match.student_id} (${Math.round(match.confidence * 100)}%)`, '#28a745');
      setLastRecognition({ ...match, time: new Date() });

      // If not already recorded in this session, record attendance
      if (!recognizedRef.current.has(key)) {
        recognizedRef.current.add(key);
        const ok = await recordAttendance(match);
        if (ok) {
          showSuccessNotification(match);
          if (onRecognized) onRecognized(match);
        } else {
          // if recording fails, remove from set so we can retry next scans
          recognizedRef.current.delete(key);
          if (onError) onError('Failed to record attendance for ' + match.student_id);
        }
      } else {
        console.log(`Already recorded ${key} in this session`);
      }

    } catch (err) {
      console.error('Recognition error', err?.message || err);
      setBanner('⚠️ Recognition service unavailable', '#6c757d');
      if (onError) onError(err?.message || 'Recognition error');
    }
  }, [FACE_URL, BACKEND_URL, classId, sessionDate, cameraStatus, recordAttendance, setBanner, showSuccessNotification, onRecognized, onError]);

  // Start camera and scanning loop
  useEffect(() => {
    mountedRef.current = true;
    let gotStream = null;

    async function startCamera() {
      try {
        setCameraStatus('requesting');
        setPermissionError('');
        console.log('Requesting camera...');
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera API not supported in this browser');
        }

        gotStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false
        });

        streamRef.current = gotStream;
        if (videoRef.current) {
          videoRef.current.srcObject = gotStream;
          await videoRef.current.play();
        }

        setCameraStatus('active');
        setBanner('🔵 Camera active', '#17a2b8');

        // start interval - use setInterval so that network request doesn't pile up
        intervalRef.current = setInterval(() => {
          // call but don't await - function handles its own awaits
          captureAndRecognize();
        }, 3000);
      } catch (err) {
        console.error('Camera start error:', err);
        setCameraStatus('error');
        const msg = (err && err.name === 'NotAllowedError') ? 'Please allow camera access.' : (err.message || 'Camera error');
        setPermissionError(msg);
        setBanner('❌ Camera Error', '#dc3545');
        if (onError) onError(msg);
      }
    }

    startCamera();

    return () => {
      mountedRef.current = false;
      // cleanup
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setCameraStatus('stopped');
      setBanner('Stopped', '#6c757d');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureAndRecognize]); // only recreate when captureAndRecognize changes

  // render
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <video
          ref={videoRef}
          style={{
            width: '100%',
            maxWidth: 640,
            borderRadius: 10,
            border: `4px solid ${cameraStatus === 'active' ? '#28a745' : (cameraStatus === 'error' ? '#dc3545' : '#e2e8f0')}`,
            backgroundColor: '#000',
            display: 'block'
          }}
          muted
          playsInline
          autoPlay
        />
        {/* small status pill overlay */}
        <div style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: scanColor,
          color: 'white',
          padding: '8px 14px',
          borderRadius: 20,
          fontWeight: 700,
          fontSize: 14,
          boxShadow: '0 6px 18px rgba(0,0,0,0.12)'
        }}>
          {scanStatus}
        </div>
      </div>

      {/* hidden debug canvas (useful during dev) */}
      <canvas ref={canvasRef} width="320" height="240" style={{ display: 'none' }} />

      {permissionError && (
        <div style={{
          maxWidth: 640,
          margin: '12px auto',
          backgroundColor: '#fff3f2',
          color: '#7a1f1f',
          padding: '12px 14px',
          borderRadius: 8,
          border: '1px solid #ffd7d7'
        }}>
          <strong>Camera Error:</strong> {permissionError}
          <div style={{ marginTop: 8, fontSize: 13, color: '#333' }}>
            Tips: Allow camera permission in the browser; close other apps using the camera; reload page.
          </div>
        </div>
      )}

      <div style={{
        marginTop: 14,
        maxWidth: 640,
        marginLeft: 'auto',
        marginRight: 'auto',
        backgroundColor: '#f1f8ff',
        borderRadius: 8,
        padding: 12,
        color: '#0b3d91',
        fontSize: 13
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>How Face Recognition Works</div>
        <ul style={{ textAlign: 'left', margin: 0, paddingLeft: 18 }}>
          <li>Camera captures frames every 3 seconds.</li>
          <li>Matches returned by face service are checked against enrolled faces.</li>
          <li>Attendance is recorded automatically (one record per student per session).</li>
          <li>Confidence & network errors are logged in the console for debugging.</li>
        </ul>
        <div style={{ marginTop: 8, fontSize: 12, color: '#234' }}>
          Scans: {scanCount}
          {lastRecognition && (
            <span style={{ marginLeft: 12 }}>
              Last: {lastRecognition.student_id} ({Math.round(lastRecognition.confidence * 100)}%)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
