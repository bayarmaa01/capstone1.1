// frontend/src/components/ScheduleCalendar.jsx
import React, { useEffect, useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import moment from 'moment';
import axios from 'axios';

const localizer = momentLocalizer(moment);

export default function ScheduleCalendar({ classId }) {
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:4000';
  const [events, setEvents] = useState([]);

  useEffect(() => {
    fetchSchedules();
  }, [classId]);

  const fetchSchedules = async () => {
    try {
      const res = await axios.get(`${apiUrl}/api/schedule/class/${classId}`);
      const today = new Date();

      const formatted = res.data.map((s) => {
        let eventDate;

        // Use scheduled_date or next occurrence of day_of_week
        if (s.scheduled_date) {
          eventDate = new Date(s.scheduled_date);
        } else {
          const diff =
            (s.day_of_week - today.getDay() + 7) % 7; // days until next occurrence
          eventDate = new Date(today);
          eventDate.setDate(today.getDate() + diff);
        }

        const [startHour, startMin] = s.start_time.split(':');
        const [endHour, endMin] = s.end_time.split(':');
        const start = new Date(eventDate);
        start.setHours(parseInt(startHour), parseInt(startMin));
        const end = new Date(eventDate);
        end.setHours(parseInt(endHour), parseInt(endMin));

        return {
          id: s.id,
          title: s.room_number
            ? `Class in ${s.room_number}`
            : `Class Schedule`,
          start,
          end,
          allDay: false,
        };
      });

      setEvents(formatted);
    } catch (err) {
      console.error('Error loading schedule:', err);
    }
  };

  const eventStyleGetter = (event) => {
    const now = new Date();
    let backgroundColor = '#6c757d'; // past (gray)
    if (event.start <= now && event.end >= now) backgroundColor = '#28a745'; // ongoing (green)
    else if (event.start > now) backgroundColor = '#007bff'; // upcoming (blue)

    return {
      style: {
        backgroundColor,
        color: 'white',
        borderRadius: '6px',
        border: 'none',
        padding: '5px',
        fontWeight: '600',
        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
      },
    };
  };

  return (
    <div style={{ marginTop: '20px', background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h3 style={{ marginBottom: '15px', color: '#333' }}>📅 Class Schedule Calendar</h3>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        defaultView="week"
        views={['week', 'day']}
        style={{ height: 500 }}
        eventPropGetter={eventStyleGetter}
        tooltipAccessor={(event) =>
          `${event.title}\n${moment(event.start).format('hh:mm A')} - ${moment(
            event.end
          ).format('hh:mm A')}`
        }
        popup
      />
    </div>
  );
}
