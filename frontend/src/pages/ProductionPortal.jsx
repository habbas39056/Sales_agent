import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function ProductionPortal() {
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/projects');
      setProjects(res.data);
    } catch (e) { console.error(e); }
  };

  const submitDelivery = async (id) => {
    const file_name = prompt("Enter file name or link:");
    if (!file_name) return;
    try {
      await axios.post(`http://localhost:5000/api/projects/${id}/submit-delivery`, { 
        user_id: 1, // Mocking logged in user
        file_url: 'https://example.com/file',
        file_name 
      });
      alert("Delivery submitted to client for review!");
      fetchProjects();
    } catch (e) { console.error(e); }
  };

  return (
    <div>
      <h1>Production Portal</h1>
      <p className="text-secondary">Upload deliverables and manage assigned projects.</p>
      
      <div className="card" style={{ marginTop: '2rem' }}>
        <h3>Your Assigned Projects</h3>
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {projects.length === 0 ? (
            <p className="text-secondary">No projects assigned yet.</p>
          ) : (
            projects.map(p => (
              <div key={p.id} style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4>{p.title} <span className="badge badge-warning">{p.status}</span></h4>
                    <p className="text-secondary" style={{ fontSize: '0.9rem' }}>Deadline: {p.locked_deadline ? new Date(p.locked_deadline).toLocaleDateString() : 'Pending PM Lock'}</p>
                    <p className="text-secondary" style={{ fontSize: '0.9rem' }}>Terms Accepted by Client: {p.terms_accepted ? 'Yes' : 'No'}</p>
                  </div>
                  
                  {p.terms_accepted && p.locked_deadline && (p.status === 'Deadline Confirmed' || p.status === 'Revision Requested') && (
                    <button className="btn btn-accent" onClick={() => submitDelivery(p.id)}>
                      Submit Deliverable
                    </button>
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
