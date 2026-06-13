import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function PmPortal() {
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await axios.get('/api/projects');
      setProjects(res.data);
    } catch (e) { console.error(e); }
  };

  const lockDeadline = async (id, dateStr) => {
    try {
      await axios.post(`/api/projects/${id}/lock-deadline`, { deadline: dateStr });
      alert("Deadline locked!");
      fetchProjects();
    } catch (e) { console.error(e); }
  };

  return (
    <div>
      <h1>Project Manager Portal</h1>
      <p className="text-secondary">Assign production, lock deadlines, and manage QA.</p>
      
      <div className="card" style={{ marginTop: '2rem' }}>
        <h3>Active Projects</h3>
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {projects.length === 0 ? (
            <p className="text-secondary">No projects assigned yet.</p>
          ) : (
            projects.map(p => (
              <div key={p.id} style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4>{p.title} <span className="badge badge-warning">{p.status}</span></h4>
                    <p className="text-secondary" style={{ fontSize: '0.9rem' }}>Client: {p.client_name || 'Unknown'}</p>
                    <p className="text-secondary" style={{ fontSize: '0.9rem' }}>Deadline: {p.locked_deadline ? new Date(p.locked_deadline).toLocaleDateString() : 'Not Set'}</p>
                  </div>
                  
                  {(!p.locked_deadline || p.status === 'Assigned') && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input type="date" id={`date-${p.id}`} style={{ padding: '0.5rem', borderRadius: '4px', background: 'var(--surface-color)', color: 'white', border: '1px solid var(--border-color)' }} />
                      <button className="btn btn-primary" onClick={() => lockDeadline(p.id, document.getElementById(`date-${p.id}`).value)}>
                        Lock Deadline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
