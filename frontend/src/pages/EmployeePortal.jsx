import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Mail, Calendar, Layout, ArrowLeft, Folder, ExternalLink } from 'lucide-react';

export default function EmployeePortal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const empRes = await axios.get(`/api/users/${id}`);
        setEmployee(empRes.data);

        // Fetch assigned projects for this employee
        const role = empRes.data?.role || 'Employee';
        const projRes = await axios.get(`/api/projects?user_id=${id}&role=${encodeURIComponent(role)}`);
        setProjects(projRes.data || []);

        setLoading(false);
      } catch (err) {
        setError('Failed to load employee details');
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) return <div style={{ padding: '2rem' }}>Loading employee portal...</div>;
  if (error || !employee) return <div style={{ padding: '2rem', color: 'red' }}>{error || 'Employee not found'}</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <button 
        onClick={() => navigate(-1)} 
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: '500' }}
      >
        <ArrowLeft size={16} /> Back to Team
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {employee.name}'s Portal
          </h1>
          <p className="text-secondary" style={{ margin: 0, fontSize: '1rem' }}>Employee Dashboard View</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        {/* Left Column: Profile Card */}
        <div className="card" style={{ padding: '2rem', background: 'var(--surface-color)', borderRadius: '12px', border: '1px solid var(--border-color)', height: 'fit-content' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f1f5f9', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              {employee.name.charAt(0).toUpperCase()}
            </div>
            <h2 style={{ margin: '0 0 0.25rem 0' }}>{employee.name}</h2>
            <span style={{ display: 'inline-block', padding: '0.25rem 0.75rem', background: '#e0e7ff', color: '#4f46e5', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {employee.role}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <Mail size={16} style={{ color: '#94a3b8' }} />
              {employee.email}
            </div>
            {employee.username && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <User size={16} style={{ color: '#94a3b8' }} />
                @{employee.username}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <Calendar size={16} style={{ color: '#94a3b8' }} />
              Joined {new Date(employee.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Right Column: Assigned Projects & Modules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Assigned Projects Card */}
          <div className="card" style={{ padding: '2rem', background: 'var(--surface-color)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Folder size={20} style={{ color: '#4f46e5' }} />
                <h3 style={{ margin: 0 }}>Assigned Projects ({projects.length})</h3>
              </div>
            </div>

            {projects.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', color: '#64748b' }}>
                No projects assigned to this team member yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {projects.map(p => {
                  const total = p.total_steps || 0;
                  const completed = p.completed_steps || 0;
                  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
                  const isCompleted = p.status === 'Completed' || p.status === 'Commission Released';

                  return (
                    <div key={p.id} style={{ padding: '1rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <h4 style={{ margin: 0, color: '#1e293b' }}>{p.title}</h4>
                          <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', backgroundColor: isCompleted ? '#e0e7ff' : '#ecfccb', color: isCompleted ? '#4338ca' : '#4d7c0f' }}>
                            {isCompleted ? 'Completed' : 'Active'}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                          Client: {p.client_name || 'No Client'} · Service: {p.service_type || 'Unspecified'}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', maxWidth: '250px' }}>
                          <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${percent}%`, height: '100%', background: '#4f46e5' }}></div>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>{completed}/{total} ({percent}%)</span>
                        </div>

                        {p.user_assigned_steps && p.user_assigned_steps.length > 0 && (
                          <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.8rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                            <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: '700', display: 'block', marginBottom: '0.25rem' }}>
                              📌 Steps Assigned to You ({p.user_assigned_steps.length}):
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              {p.user_assigned_steps.map(s => (
                                <div key={s.id} style={{ fontSize: '0.8rem', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span>• {s.title}</span>
                                  <span style={{ fontSize: '0.72rem', fontWeight: '700', color: s.status === 'Completed' ? '#16a34a' : s.status === 'In Progress' ? '#d97706' : '#64748b' }}>
                                    {s.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={() => navigate(`/projects/${p.id}`)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', color: '#4338ca', fontWeight: '600', fontSize: '0.85rem', alignSelf: 'flex-start' }}
                      >
                        <ExternalLink size={14} /> Open Project
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Assigned Modules Card */}
          <div className="card" style={{ padding: '2rem', background: 'var(--surface-color)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <Layout size={20} style={{ color: '#4f46e5' }} />
              <h3 style={{ margin: 0 }}>Assigned Modules</h3>
            </div>
            
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
              The following areas are accessible by this employee. When they log in, they will only see these navigation links.
            </p>

            {employee.modules_access && employee.modules_access.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {employee.modules_access.map(mod => (
                  <span key={mod} style={{ background: '#f8fafc', color: '#334155', padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></div>
                    {mod}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ padding: '1rem', background: '#fef2f2', color: '#ef4444', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '500' }}>
                No modules assigned. This employee currently has no access to the system.
              </div>
            )}
          </div>

          {/* Recent Activity Card */}
          <div className="card" style={{ padding: '2rem', background: 'var(--surface-color)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 1.5rem 0' }}>Recent Activity</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: '500', color: 'var(--text-primary)' }}>Account Provisioned</p>
                <span style={{ fontSize: '0.8rem' }}>{new Date(employee.created_at).toLocaleString()}</span>
              </div>
              <p style={{ fontStyle: 'italic', textAlign: 'center', margin: '1rem 0' }}>More activity logs will appear here once the employee starts using their assigned modules.</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
