import React, { useRef, useEffect, useState } from 'react';
import axios from 'axios';

export default function CameraCapture({ classId, sessionDate, onRecognized, onError }) {
  const videoRef = useRef();
  const [isCapturing, setIsCapturing] = useState(false);
  const [recognizedStudents, setRecognizedStudents] = useState(new Set());
  const [lastCapture, setLastCapture] = useState(null);

  useEffect(() => {
    let intervalId;
    let stream;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 }, 
            height: { ideal: 480 },
            facingMode: 'user'
          } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsCapturing(true);
          console.log('✓ Camera started');

          // Capture and recognize every 3 seconds
          intervalId = setInterval(async () => {
            await captureAndRecognize();
          }, 3000);
        }
      } catch (error) {
        console.error('❌ Camera access error:', error);
        if (onError) {
          onError('Could not access camera. Please grant permissions.');
        }
      }
    }

    async function captureAndRecognize() {
      if (!videoRef.current || !classId || !sessionDate) return;

      try {
        // Create canvas and capture frame
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0);

        // Convert to blob
        canvas.toBlob(async (blob) => {
          if (!blob) return;

          const formData = new FormData();
          formData.append('image', blob, 'frame.jpg');

          try {
            // Send to face recognition service
            const faceServiceUrl = process.env.REACT_APP_FACE_SERVICE_URL || 'http://localhost:5001';
            const response = await axios.post(`${faceServiceUrl}/recognize`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
              timeout: 5000
            });

            const matches = response.data;
            setLastCapture(new Date());

            // Process each recognized face
            for (const match of matches) {
              // Avoid duplicate recordings within same session
              const key = `${match.student_id}-${sessionDate}`;
              if (!recognizedStudents.has(key)) {
                console.log(`✓ Recognized: ${match.student_id} (${(match.confidence * 100).toFixed(1)}%)`);
                
                // Record attendance
                await recordAttendance(match);
                
                // Mark as recognized
                setRecognizedStudents(prev => new Set([...prev, key]));
                
                if (onRecognized) {
                  onRecognized(match);
                }
              }
            }
          } catch (error) {
            console.error('Recognition error:', error.message);
          }
        }, 'image/jpeg', 0.8);

      } catch (error) {
        console.error('Capture error:', error);
      }
    }

    async function recordAttendance(match) {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:4000';
        await axios.post(`${apiUrl}/api/attendance/record`, {
          class_id: classId,
          student_id: match.student_id,
          session_date: sessionDate,
          method: 'face',
          confidence: match.confidence
        });
        console.log(`✓ Attendance recorded for ${match.student_id}`);
      } catch (error) {
        console.error('Failed to record attendance:', error.message);
      }
    }

    startCamera();

    // Cleanup
    return () => {
      if (intervalId) clearInterval(intervalId);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setIsCapturing(false);
    };
  }, [classId, sessionDate, onRecognized, onError]);

  return (
    <div style={{ textAlign: 'center' }}>
      <video 
        ref={videoRef} 
        style={{ 
          width: '100%', 
          maxWidth: '640px', 
          border: '2px solid #007bff',
          borderRadius: '8px',
          backgroundColor: '#000'
        }} 
        muted
      />
      <div style={{ marginTop: '10px' }}>
        {isCapturing ? (
          <p style={{ color: 'green' }}>
            🟢 Camera active - Scanning for faces...
          </p>
        ) : (
          <p style={{ color: 'orange' }}>
            🟡 Starting camera...
          </p>
        )}
        {lastCapture && (
          <p style={{ fontSize: '12px', color: '#666' }}>
            Last scan: {lastCapture.toLocaleTimeString()}
          </p>
        )}
        <p style={{ fontSize: '14px', color: '#666' }}>
          Recognized: {recognizedStudents.size} students
        </p>
      </div>
    </div>
  );
}