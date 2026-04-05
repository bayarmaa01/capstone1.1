# AI Analytics Service for Smart Attendance System
from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import redis
import json
import logging
from datetime import datetime, timedelta
import os
from collections import defaultdict

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Database connections
def get_db_connection():
    """Get database connection"""
    try:
        conn = psycopg2.connect(os.getenv('DATABASE_URL'))
        return conn
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        return None

def get_redis_connection():
    """Get Redis connection"""
    try:
        r = redis.Redis.from_url(os.getenv('REDIS_URL'))
        return r
    except Exception as e:
        logger.error(f"Redis connection error: {e}")
        return None

@app.route('/analytics/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "ok", 
        "service": "ai-analytics",
        "timestamp": datetime.now().isoformat()
    })

@app.route('/analytics/dashboard', methods=['GET'])
def dashboard():
    """Get comprehensive analytics dashboard data"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        
        cursor = conn.cursor()
        
        # Get attendance statistics
        cursor.execute("""
            SELECT 
                COUNT(*) as total_sessions,
                COUNT(DISTINCT student_id) as unique_students,
                DATE(created_at) as date
            FROM attendance_sessions 
            WHERE created_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
            LIMIT 30
        """)
        
        daily_stats = cursor.fetchall()
        
        # Get course-wise attendance
        cursor.execute("""
            SELECT 
                c.course_name,
                COUNT(*) as attendance_count,
                COUNT(DISTINCT s.student_id) as unique_students
            FROM attendance_sessions s
            JOIN courses c ON s.course_id = c.id
            WHERE s.created_at >= NOW() - INTERVAL '30 days'
            GROUP BY c.course_name
            ORDER BY attendance_count DESC
        """)
        
        course_stats = cursor.fetchall()
        
        # Get real-time attendance trends
        cursor.execute("""
            SELECT 
                EXTRACT(HOUR FROM created_at) as hour,
                COUNT(*) as count
            FROM attendance_sessions 
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY EXTRACT(HOUR FROM created_at)
            ORDER BY hour
        """)
        
        hourly_trends = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # AI-powered insights
        insights = generate_ai_insights(daily_stats, course_stats, hourly_trends)
        
        return jsonify({
            "status": "ok",
            "dashboard": {
                "daily_statistics": [
                    {
                        "date": str(stat[2]),
                        "total_sessions": stat[0],
                        "unique_students": stat[1]
                    } for stat in daily_stats
                ],
                "course_statistics": [
                    {
                        "course_name": stat[0],
                        "attendance_count": stat[1],
                        "unique_students": stat[2]
                    } for stat in course_stats
                ],
                "hourly_trends": [
                    {
                        "hour": int(stat[0]),
                        "count": stat[1]
                    } for stat in hourly_trends
                ],
                "ai_insights": insights
            }
        })
        
    except Exception as e:
        logger.error(f"Dashboard error: {e}")
        return jsonify({"error": str(e)}), 500

def generate_ai_insights(daily_stats, course_stats, hourly_trends):
    """Generate AI-powered insights from data"""
    insights = []
    
    # Analyze attendance patterns
    if daily_stats:
        avg_daily = sum(stat[0] for stat in daily_stats) / len(daily_stats)
        if avg_daily > 100:
            insights.append({
                "type": "high_engagement",
                "message": f"High engagement detected with average {avg_daily:.0f} daily sessions",
                "severity": "positive"
            })
        
        # Find peak days
        peak_day = max(daily_stats, key=lambda x: x[0])
        insights.append({
            "type": "peak_day",
            "message": f"Peak attendance on {peak_day[2]} with {peak_day[0]} sessions",
            "severity": "info"
        })
    
    # Course performance analysis
    if course_stats:
        top_course = max(course_stats, key=lambda x: x[1])
        insights.append({
            "type": "popular_course",
            "message": f"Most popular course: {top_course[0]} with {top_course[1]} sessions",
            "severity": "info"
        })
    
    # Time-based patterns
    if hourly_trends:
        peak_hour = max(hourly_trends, key=lambda x: x[1])
        insights.append({
            "type": "peak_hour",
            "message": f"Peak attendance at {peak_hour[0]}:00 with {peak_hour[1]} sessions",
            "severity": "info"
        })
    
    return insights

@app.route('/analytics/predictions', methods=['GET'])
def predictions():
    """AI-powered attendance predictions"""
    try:
        # Get historical data
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as attendance_count
            FROM attendance_sessions 
            WHERE created_at >= NOW() - INTERVAL '90 days'
            GROUP BY DATE(created_at)
            ORDER BY date
        """)
        
        historical_data = cursor.fetchall()
        cursor.close()
        conn.close()
        
        # Simple ML prediction (trend analysis)
        if len(historical_data) >= 7:
            recent_avg = sum(stat[1] for stat in historical_data[-7:]) / 7
            older_avg = sum(stat[1] for stat in historical_data[-14:-7]) / 7 if len(historical_data) >= 14 else recent_avg
            
            trend = "increasing" if recent_avg > older_avg else "decreasing" if recent_avg < older_avg else "stable"
            
            # Predict next 7 days
            predictions = []
            for i in range(7):
                future_date = datetime.now() + timedelta(days=i+1)
                predicted_count = int(recent_avg * (1.1 if trend == "increasing" else 0.9 if trend == "decreasing" else 1.0))
                predictions.append({
                    "date": future_date.strftime("%Y-%m-%d"),
                    "predicted_attendance": predicted_count,
                    "confidence": "high" if i < 3 else "medium"
                })
            
            return jsonify({
                "status": "ok",
                "predictions": {
                    "trend": trend,
                    "recent_average": recent_avg,
                    "predictions": predictions
                }
            })
        else:
            return jsonify({
                "status": "ok",
                "predictions": {
                    "trend": "insufficient_data",
                    "message": "Need at least 7 days of data for predictions"
                }
            })
        
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/analytics/alerts', methods=['GET'])
def alerts():
    """AI-powered attendance alerts"""
    try:
        alerts = []
        
        # Check for unusual patterns
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        
        cursor = conn.cursor()
        
        # Low attendance alert
        cursor.execute("""
            SELECT COUNT(*) as count
            FROM attendance_sessions 
            WHERE created_at >= NOW() - INTERVAL '24 hours'
        """)
        
        today_count = cursor.fetchone()[0]
        
        if today_count < 10:
            alerts.append({
                "type": "low_attendance",
                "message": f"Low attendance detected: only {today_count} sessions in last 24 hours",
                "severity": "warning",
                "timestamp": datetime.now().isoformat()
            })
        
        # Check for system health
        redis_conn = get_redis_connection()
        if redis_conn:
            try:
                redis_conn.ping()
            except:
                alerts.append({
                    "type": "redis_down",
                    "message": "Redis cache service is not responding",
                    "severity": "critical",
                    "timestamp": datetime.now().isoformat()
                })
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "status": "ok",
            "alerts": alerts,
            "total_alerts": len(alerts)
        })
        
    except Exception as e:
        logger.error(f"Alerts error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    logger.info("🚀 Starting AI Analytics Service")
    app.run(host='0.0.0.0', port=5002, debug=False)
