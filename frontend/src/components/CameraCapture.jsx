import React, { useRef, useEffect, useState } from "react";
import axios from "axios";

export default function CameraCapture({ classId, sessionDate, onRecognized, onError }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const recognizedSet = useRef(new Set());
  const cameraStarted = useRef(false);

  // UI State
  const [cameraStatus, setCameraStatus] = useState("initializing");
  const [permissionError, setPermissionError] = useState("");
  const [scanStatus, setScanStatus] = useState("Idle");
  const [scanColor, setScanColor] = useState("#17a2b8");
  const [scanCount, setScanCount] = useState(0);
  const [lastRecognition, setLastRecognition] = useState(null);

  // API URLs
  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:4000";
  const FACE_URL = process.env.REACT_APP_FACE_SERVICE_URL || "http://localhost:5001";

  // -------------------------------------------------------------------
  // 🎥 Start Camera (FIXED — No play() interruption)
  // -------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    async function startCamera() {
      try {
        setCameraStatus("requesting");

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });

        if (!isMounted) return;

        streamRef.current = stream;
        setCameraStatus("active");
        setScanStatus("Camera Active");
        setScanColor("#28a745");

        if (videoRef.current && !cameraStarted.current) {
          cameraStarted.current = true;

          videoRef.current.srcObject = stream;

          videoRef.current.onloadedmetadata = () => {
            videoRef.current
              .play()
              .catch((err) => console.warn("⚠ play() blocked:", err));
          };
        }

        // Start scanning every 3 seconds
        intervalRef.current = setInterval(() => {
          captureAndRecognize();
        }, 3000);
      } catch (err) {
        console.error("Camera error:", err);
        setCameraStatus("error");
        setPermissionError(err.message);
        setScanStatus("Camera Error");
        setScanColor("#dc3545");
        onError?.(err.message);
      }
    }

    startCamera();

    return () => {
      isMounted = false;

      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current)
        streamRef.current.getTracks().forEach((t) => t.stop());

      if (videoRef.current) videoRef.current.srcObject = null;

      setCameraStatus("stopped");
    };
  }, []);

  // -------------------------------------------------------------------
  // 📸 Capture Frame + Send to Face Recognition
  // -------------------------------------------------------------------
  async function captureAndRecognize() {
    if (!videoRef.current || cameraStatus !== "active") return;
    if (!classId || !sessionDate) return;

    setScanStatus("Scanning...");
    setScanColor("#ffc107");
    setScanCount((c) => c + 1);

    try {
      const canvas = document.createElement("canvas");
      const w = videoRef.current.videoWidth;
      const h = videoRef.current.videoHeight;

      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(videoRef.current, 0, 0, w, h);

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.85)
      );

      if (!blob) return;

      const formData = new FormData();
      formData.append("image", blob, "frame.jpg");

      const faceUrl = FACE_URL.replace(/\/$/, "");
      const resp = await axios.post(`${faceUrl}/recognize`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 10000,
      });

      const matches = Array.isArray(resp.data) ? resp.data : [];

      if (matches.length === 0) {
        setScanStatus("No Face Detected");
        setScanColor("#dc3545");
        return;
      }

      const match = matches[0];
      const key = `${match.student_id}-${sessionDate}`;

      setScanStatus(`Match: ${match.student_id}`);
      setScanColor("#28a745");
      setLastRecognition(match);

      if (!recognizedSet.current.has(key)) {
        recognizedSet.current.add(key);
        await recordAttendance(match);
        showSuccessNotification(match);
        onRecognized?.(match);
      }
    } catch (err) {
      console.error("Recognition error:", err);
      setScanStatus("Service Down");
      setScanColor("#6c757d");
      onError?.(err.message);
    }
  }

  // -------------------------------------------------------------------
  // 📝 Record Attendance
  // -------------------------------------------------------------------
  async function recordAttendance(match) {
    try {
      const cleanUrl = API_URL.replace(/\/$/, "");
      await axios.post(`${cleanUrl}/api/attendance/record`, {
        class_id: Number(classId),
        student_id: match.student_id,
        session_date: sessionDate,
        method: "face",
        confidence: match.confidence,
      });

      console.log("Attendance saved:", match.student_id);
    } catch (err) {
      console.error("Failed attendance:", err.message);
      onError?.("Failed to record attendance");
    }
  }

  // -------------------------------------------------------------------
  // 🔔 Success Popup
  // -------------------------------------------------------------------
  function showSuccessNotification(match) {
    const div = document.createElement("div");
    div.style.cssText = `
      position: fixed; top: 20px; right: 20px;
      background: #28a745; color: white;
      padding: 12px 20px; border-radius: 8px;
      font-weight: 600; z-index: 99999;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    `;
    div.innerHTML = `✅ ${match.student_id} (${Math.round(
      match.confidence * 100
    )}%)`;

    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3500);
  }

  // -------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ position: "relative", display: "inline-block" }}>
        <video
          ref={videoRef}
          style={{
            width: "100%",
            maxWidth: 640,
            border: "3px solid #28a745",
            borderRadius: 10,
            backgroundColor: "#000",
          }}
          muted
          playsInline
        />

        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: scanColor,
            color: "white",
            padding: "8px 16px",
            borderRadius: 20,
            fontWeight: "bold",
            boxShadow: "0px 3px 8px rgba(0,0,0,0.3)",
          }}
        >
          {scanStatus}
        </div>
      </div>

      {permissionError && (
        <div style={{ color: "#721c24", marginTop: 10 }}>
          <strong>Camera Error:</strong> {permissionError}
        </div>
      )}

      <div style={{ marginTop: 15, fontSize: 13, color: "#004085" }}>
        Scans: {scanCount}
        {lastRecognition && (
          <div>
            Last Match: {lastRecognition.student_id} —{" "}
            {Math.round(lastRecognition.confidence * 100)}%
          </div>
        )}
      </div>
    </div>
  );
}
