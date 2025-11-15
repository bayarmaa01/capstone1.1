// src/components/CameraCapture.jsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import axios from 'axios';

export default function CameraCapture({ classId, sessionDate, onRecognized, onError }) {
  const videoRef = useRef(null);
  const debugCanvasRef = useRef(null);

  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const recognizedRef = useRef(new Set());

  const [cameraStatus, setCameraStatus] = useState('idle'); // 'idle'|'requesting'|'active'|'stopped'|'error'
  const [permissionError, setPermissionError] = useState('');
  const [scanStatus, setScanStatus] = useState('Idle');
  const [scanColor, setScanColor] = useState('#17a2b8');
  const [scanCount, setScanCount] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  const BACKEND_URL = (process.env.REACT_APP_API_URL || 'http://localhost:4000').replace(/\/$/, '');
  const FACE_URL = (process.env.REACT_APP_FACE_SERVICE_URL || 'http://localhost:5001').replace(/\/$/, '');

  const setBanner = useCallback((text, color) => {
    setScanStatus(text);
    setScanColor(color);
  }, []);

  const showSuccessNotification = useCallback((studentId, confidencePercent) => {
    const note = document.createElement('div');
    note.style.cssText = `
      position: fixed; top: 18px; right: 18px; background: linear-gradient(135deg,#28a745 0%,#20c997 100%);
      color: white; padding: 10px 14px; border-radius: 8px; z-index: 99999; font-weight: 700;
    `;
    note.innerHTML = `✅ ${studentId} recognized<br/><small>${Math.round(confidencePercent)}%</small>`;
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
        const delay = baseDelay * Math.pow(2, i); // exponential-ish backoff
        console.warn(`Attempt ${i + 1} failed. Retrying in ${delay}ms...`, err?.message || err);
        await sleep(delay);
      }
    }
    throw lastErr;
  };

  // send attendance to backend (sends both raw and percent)
  const recordAttendance = useCallback(async (match, rawConfidence, confidencePercent) => {
    const payload = {
      class_id: parseInt(classId, 10),
      student_id: match.student_id,
      session_date: sessionDate,
      method: 'face',
      confidence: rawConfidence,
      confidence_percent: confidencePercent
    };

    try {
      // retry posting attendance up to 2 times (2 attempts)
      const fn = async () => {
        // 10s timeout per attempt
        const resp = await axios.post(`${BACKEND_URL}/api/attendance/record`, payload, { timeout: 10000 });
        return resp;
      };
      const resp = await retry(fn, 2, 500);
      console.debug('Backend attendance response:', resp?.data);
      return true;
    } catch (err) {
      console.error('Failed to record attendance after retries', err?.response?.data || err?.message || err);
      return false;
    }
  }, [BACKEND_URL, classId, sessionDate]);

  const captureAndRecognize = useCallback(async () => {
    const video = videoRef.current;
    if (!video || cameraStatus !== 'active' || !isScanning) return;
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

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      if (!blob) return;

      const fd = new FormData();
      fd.append('image', blob, 'frame.jpg');

      // Face recognition request with retries - this is where you saw timeouts
      const callFaceService = async () => {
        // 15s per attempt
        return axios.post(`${FACE_URL}/recognize`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 15000
        });
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

      const matches = Array.isArray(resp.data) ? resp.data : [];
      if (!matches.length) {
        setBanner('❌ No face detected', '#dc3545');
        return;
      }

      const best = matches[0];

      // normalize confidence (support 0..1 or 0..100)
      let rawConfidence = typeof best.confidence === 'number' ? best.confidence : parseFloat(best.confidence);
      if (Number.isNaN(rawConfidence)) rawConfidence = 0;
      const confidencePercent = rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence;
      const roundedPct = Math.round(confidencePercent);

      const key = `${best.student_id}-${sessionDate}`;

      console.debug('Best match:', { student_id: best.student_id, rawConfidence, confidencePercent });

      // THRESHOLD: strictly greater than 60%
      if (!(confidencePercent > 60)) {
        setBanner(`❌ Low confidence (${roundedPct}%)`, '#dc3545');
        return;
      }

      setBanner(`✅ Match: ${best.student_id} (${roundedPct}%)`, '#28a745');

      // only record once per student/session
      if (!recognizedRef.current.has(key)) {
        // show interim banner while posting
        setBanner('🟢 Recording attendance...', '#28a745');

        const ok = await recordAttendance(best, rawConfidence, confidencePercent);
        if (ok) {
          recognizedRef.current.add(key);
          showSuccessNotification(best.student_id, confidencePercent);
          if (onRecognized) onRecognized({ ...best, confidence_percent: confidencePercent });
          setBanner(`✅ Recorded: ${best.student_id} (${roundedPct}%)`, '#28a745');
        } else {
          setBanner('⚠️ Could not record attendance', '#6c757d');
        }
      } else {
        console.debug('Already recorded for this session:', key);
      }

    } catch (err) {
      console.error('Recognition error', err);
      setBanner('⚠️ Recognition unavailable', '#6c757d');
      if (onError) onError(err);
    }
  }, [FACE_URL, cameraStatus, isScanning, recordAttendance, sessionDate, setBanner, showSuccessNotification, onRecognized, onError]);

  const startCamera = useCallback(async () => {
    try {
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
    } catch (err) {
      console.error('Camera start failed', err);
      setCameraStatus('error');
      setPermissionError('Please allow camera access');
      if (onError) onError(err);
    }
  }, [setBanner, onError]);

  useEffect(() => {
    if (cameraStatus === 'active' && isScanning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        captureAndRecognize();
      }, 3000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
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
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          backgroundColor: scanColor, color: 'white',
          padding: '8px 14px', borderRadius: 20, fontWeight: 700
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
      </div>
    </div>
  );
}
