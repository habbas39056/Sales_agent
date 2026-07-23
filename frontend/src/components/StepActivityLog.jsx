import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Clock, User, Activity } from 'lucide-react';

export default function StepActivityLog({ stepId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = async () => {
    try {
      const res = await axios.get(`/api/projects/steps/${stepId}/activity`);
      setActivities(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch activity log', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(fetchActivities, 5000);
    return () => clearInterval(interval);
  }, [stepId]);

  if (loading) return <p className="empty-tab-msg">Loading activity timeline...</p>;

  if (activities.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        <Activity size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
        <p style={{ margin: 0, fontSize: '0.9rem' }}>No activity logged for this step yet.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {activities.map((act) => (
          <div key={act.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.6rem 0.8rem', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
              <Clock size={14} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <span style={{ fontWeight: '600', fontSize: '0.85rem', color: '#1e293b' }}>
                  {act.user_name || 'System / User'} {act.user_role && <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem', borderRadius: '4px', backgroundColor: '#e2e8f0', color: '#475569', marginLeft: '0.4rem' }}>{act.user_role}</span>}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {new Date(act.created_at).toLocaleString()}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#334155', lineHeight: '1.4' }}>
                {act.action_text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
