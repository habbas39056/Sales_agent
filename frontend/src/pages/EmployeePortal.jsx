import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Mail, Calendar, Layout, ArrowLeft } from 'lucide-react';

export default function EmployeePortal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const res = await axios.get(`/api/users/${id}`);
        setEmployee(res.data);
        setLoading(false);
      } catch (err) {
        setError('Failed to load employee details');
        setLoading(false);
      }
    };
    fetchEmployee();
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

        {/* Right Column: Modules and Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
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
