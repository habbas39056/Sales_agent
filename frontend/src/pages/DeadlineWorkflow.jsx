import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, XCircle, ArrowRight, User, AlertCircle, FolderKanban, RefreshCw, Calendar, ShieldCheck, Edit3, ExternalLink } from 'lucide-react';
import './DeadlineWorkflow.css';

export default function DeadlineWorkflow() {
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [filterTab, setFilterTab] = useState('All');

  const navigate = useNavigate();

  // Extension Appeal Modal state
  const [appealModalStep, setAppealModalStep] = useState(null);
  const [appealForm, setAppealForm] = useState({
    proposed_deadline: '',
    reason: ''
  });
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  // Direct Edit Date State
  const [editingDateStepId, setEditingDateStepId] = useState(null);
  const [editingDateValue, setEditingDateValue] = useState('');

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchAppeals();
  }, []);

  const fetchAppeals = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/deadlines/appeals', {
        params: {
          user_id: currentUser.id,
          role: currentUser.role
        }
      });
      setAppeals(res.data || []);
    } catch (error) {
      console.error('Failed to fetch deadline appeals', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewAppeal = async (stepId, action) => {
    if (!window.confirm(`Are you sure you want to ${action.toLowerCase()} this deadline extension appeal?`)) return;
    setProcessingId(stepId);
    try {
      await axios.post(`/api/deadlines/appeals/${stepId}/review`, {
        action,
        user_id: currentUser.id
      });
      alert(`Deadline appeal ${action === 'Approve' ? 'approved' : 'rejected'} successfully!`);
      fetchAppeals();
    } catch (error) {
      console.error('Failed to review appeal', error);
      alert('Failed to process review.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmDeadline = async (stepId) => {
    setProcessingId(stepId);
    try {
      await axios.post(`/api/deadlines/accept/${stepId}`, {
        user_id: currentUser.id
      });
      alert('Step deadline confirmed successfully!');
      fetchAppeals();
    } catch (error) {
      console.error('Failed to confirm deadline', error);
      alert('Failed to confirm deadline.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenAppealModal = (item) => {
    setAppealModalStep(item);
    setAppealForm({
      proposed_deadline: item.original_deadline ? item.original_deadline.split('T')[0] : '',
      reason: ''
    });
  };

  const handleSubmitAppeal = async (e) => {
    e.preventDefault();
    if (!appealModalStep || !appealForm.proposed_deadline) return;
    setSubmittingAppeal(true);
    try {
      await axios.post(`/api/projects/${appealModalStep.project_id}/steps/${appealModalStep.step_id}/appeal-deadline`, {
        proposed_deadline: appealForm.proposed_deadline,
        reason: appealForm.reason,
        user_id: currentUser.id
      });
      alert('Deadline extension appeal submitted successfully!');
      setAppealModalStep(null);
      fetchAppeals();
    } catch (error) {
      console.error('Failed to submit appeal', error);
      alert('Failed to submit deadline appeal.');
    } finally {
      setSubmittingAppeal(false);
    }
  };

  const handleSaveDirectDate = async (stepId) => {
    if (!editingDateValue) return;
    setProcessingId(stepId);
    try {
      await axios.post(`/api/deadlines/update-date/${stepId}`, {
        deadline: editingDateValue,
        user_id: currentUser.id
      });
      alert('Step deadline updated successfully!');
      setEditingDateStepId(null);
      fetchAppeals();
    } catch (error) {
      console.error('Failed to update date', error);
      alert('Failed to update deadline date.');
    } finally {
      setProcessingId(null);
    }
  };

  // Metrics
  const totalCount = appeals.length;
  const pendingAcceptanceCount = appeals.filter(a => a.deadline_status === 'Pending Acceptance' || !a.deadline_status).length;
  const extensionAppealsCount = appeals.filter(a => a.deadline_status === 'Appealed').length;
  const confirmedCount = appeals.filter(a => a.deadline_status === 'Accepted').length;

  // Filter items
  const filteredItems = appeals.filter(item => {
    if (filterTab === 'Appealed') return item.deadline_status === 'Appealed';
    if (filterTab === 'Pending Acceptance') return item.deadline_status === 'Pending Acceptance' || !item.deadline_status;
    if (filterTab === 'Accepted') return item.deadline_status === 'Accepted';
    return true;
  });

  return (
    <div className="deadline-wf-container">
      
      {/* Header */}
      <div className="deadline-wf-header">
        <div className="deadline-wf-title">
          <h1>Deadline Workflow & Appeals Center ⏳</h1>
          <p>Track, accept, request extensions, or update all project step deadlines across the agency.</p>
        </div>
        <button 
          onClick={fetchAppeals} 
          style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', padding: '0.55rem 1.1rem', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <RefreshCw size={16} /> Refresh Workflow
        </button>
      </div>

      {/* KPI Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>{totalCount}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>Tracked Step Deadlines</div>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>{pendingAcceptanceCount}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>Pending Acceptance</div>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#ffe4e6', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>{extensionAppealsCount}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>Extension Appeals</div>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#d1fae5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>{confirmedCount}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>Confirmed & Aligned</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        <button 
          onClick={() => setFilterTab('All')}
          style={{ 
            background: filterTab === 'All' ? '#0f172a' : '#ffffff', 
            color: filterTab === 'All' ? '#ffffff' : '#64748b', 
            border: '1px solid #cbd5e1', padding: '0.5rem 1.1rem', borderRadius: '10px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' 
          }}
        >
          All Deadlines ({totalCount})
        </button>

        <button 
          onClick={() => setFilterTab('Appealed')}
          style={{ 
            background: filterTab === 'Appealed' ? '#0f172a' : '#ffffff', 
            color: filterTab === 'Appealed' ? '#ffffff' : '#64748b', 
            border: '1px solid #cbd5e1', padding: '0.5rem 1.1rem', borderRadius: '10px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' 
          }}
        >
          ⚠️ Extension Appeals ({extensionAppealsCount})
        </button>

        <button 
          onClick={() => setFilterTab('Pending Acceptance')}
          style={{ 
            background: filterTab === 'Pending Acceptance' ? '#0f172a' : '#ffffff', 
            color: filterTab === 'Pending Acceptance' ? '#ffffff' : '#64748b', 
            border: '1px solid #cbd5e1', padding: '0.5rem 1.1rem', borderRadius: '10px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' 
          }}
        >
          ⏳ Pending Acceptance ({pendingAcceptanceCount})
        </button>

        <button 
          onClick={() => setFilterTab('Accepted')}
          style={{ 
            background: filterTab === 'Accepted' ? '#0f172a' : '#ffffff', 
            color: filterTab === 'Accepted' ? '#ffffff' : '#64748b', 
            border: '1px solid #cbd5e1', padding: '0.5rem 1.1rem', borderRadius: '10px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' 
          }}
        >
          ✅ Confirmed ({confirmedCount})
        </button>
      </div>

      {/* Appeals & Deadlines List Grid */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading step deadlines...</div>
      ) : filteredItems.length === 0 ? (
        <div style={{ background: '#ffffff', padding: '3.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b' }}>
          <CheckCircle2 size={44} color="#10b981" style={{ marginBottom: '0.75rem' }} />
          <h3 style={{ margin: '0 0 0.35rem 0', color: '#0f172a' }}>All Clear! No Items Found</h3>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>No step deadlines match the selected filter category.</p>
        </div>
      ) : (
        <div className="deadline-appeals-grid">
          {filteredItems.map(item => {
            const isAppealed = item.deadline_status === 'Appealed';
            const isPending = item.deadline_status === 'Pending Acceptance' || !item.deadline_status;
            const isAccepted = item.deadline_status === 'Accepted';

            return (
              <div key={item.step_id} className="appeal-card" style={{ borderLeftColor: isAppealed ? '#f59e0b' : isPending ? '#3b82f6' : '#10b981' }}>
                
                {/* Header */}
                <div className="appeal-card-header">
                  <div className="appeal-user-badge" style={{ background: isAppealed ? '#fef3c7' : isPending ? '#e0e7ff' : '#d1fae5', color: isAppealed ? '#b45309' : isPending ? '#3730a3' : '#047857' }}>
                    <User size={14} />
                    <span>{item.employee_name || 'Team Member'} ({item.employee_role || 'Staff'})</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {item.appealed_at ? new Date(item.appealed_at).toLocaleDateString() : 'Active'}
                  </span>
                </div>

                {/* Project & Step Details */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                    <h4 
                      onClick={() => navigate(`/projects/${item.project_id}`)}
                      title="Click to view full project and step details"
                      style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      {item.step_title}
                    </h4>
                    {isAppealed && (
                      <span style={{ background: '#fef3c7', color: '#b45309', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '8px', fontWeight: '700' }}>
                        ⚠️ Extension Appealed
                      </span>
                    )}
                    {isPending && (
                      <span style={{ background: '#e0e7ff', color: '#3730a3', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '8px', fontWeight: '700' }}>
                        ⏳ Pending Acceptance
                      </span>
                    )}
                    {isAccepted && (
                      <span style={{ background: '#d1fae5', color: '#047857', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '8px', fontWeight: '700' }}>
                        ✅ Confirmed
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Project: <strong onClick={() => navigate(`/projects/${item.project_id}`)} style={{ color: '#4338ca', cursor: 'pointer', textDecoration: 'underline' }}>{item.project_title}</strong> {item.client_name ? `(${item.client_name})` : ''}
                  </div>
                </div>

                {/* Deadline Comparison Box */}
                <div className="appeal-date-comparison">
                  <div className="date-box">
                    <span className="date-box-lbl">Target Step Deadline</span>
                    <span className="date-box-val">
                      {item.original_deadline ? new Date(item.original_deadline).toLocaleDateString() : 'No Date Set'}
                    </span>
                  </div>

                  {isAppealed && (
                    <>
                      <ArrowRight size={18} color="#94a3b8" />

                      <div className="date-box">
                        <span className="date-box-lbl">Proposed Extension</span>
                        <span className="date-box-val proposed">
                          {item.proposed_deadline ? new Date(item.proposed_deadline).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Inline Edit Date Control */}
                {editingDateStepId === item.step_id && (
                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input 
                      type="date"
                      value={editingDateValue}
                      onChange={(e) => setEditingDateValue(e.target.value)}
                      style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', flex: 1 }}
                    />
                    <button 
                      onClick={() => handleSaveDirectDate(item.step_id)}
                      style={{ background: '#4338ca', color: '#ffffff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Save
                    </button>
                    <button 
                      onClick={() => setEditingDateStepId(null)}
                      style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Reason Text Box */}
                {isAppealed && item.appeal_reason && (
                  <div className="appeal-reason-box">
                    <strong>💬 Reason for Appeal:</strong>
                    <p style={{ margin: '0.25rem 0 0 0', whiteSpace: 'pre-wrap' }}>{item.appeal_reason}</p>
                  </div>
                )}

                {/* Actions Footer */}
                <div className="appeal-actions" style={{ flexWrap: 'wrap', gap: '0.4rem' }}>
                  {isAppealed && (
                    <>
                      <button 
                        className="btn-approve-appeal"
                        disabled={processingId === item.step_id}
                        onClick={() => handleReviewAppeal(item.step_id, 'Approve')}
                      >
                        <CheckCircle2 size={15} /> Approve Extension
                      </button>

                      <button 
                        className="btn-reject-appeal"
                        disabled={processingId === item.step_id}
                        onClick={() => handleReviewAppeal(item.step_id, 'Reject')}
                      >
                        <XCircle size={15} /> Keep Original Date
                      </button>
                    </>
                  )}

                  {isPending && (
                    <>
                      <button 
                        className="btn-approve-appeal"
                        disabled={processingId === item.step_id}
                        onClick={() => handleConfirmDeadline(item.step_id)}
                        style={{ background: '#10b981', padding: '0.45rem 0.8rem', fontSize: '0.8rem' }}
                      >
                        <CheckCircle2 size={15} /> Accept
                      </button>

                      <button 
                        type="button"
                        onClick={() => handleOpenAppealModal(item)}
                        style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <Clock size={15} /> Appeal Extension
                      </button>
                    </>
                  )}

                  {isAccepted && (
                    <button 
                      type="button"
                      onClick={() => handleOpenAppealModal(item)}
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#64748b', padding: '0.45rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Clock size={15} /> Request Extension
                    </button>
                  )}

                  {(currentUser.role === 'Admin' || currentUser.role === 'Product Manager' || currentUser.role === 'PM' || currentUser.role === 'Project Manager') && (
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingDateStepId(item.step_id);
                        setEditingDateValue(item.original_deadline ? item.original_deadline.split('T')[0] : '');
                      }}
                      style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '0.45rem 0.7rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Edit3 size={14} /> Set Date
                    </button>
                  )}

                  <button 
                    type="button"
                    onClick={() => navigate(`/projects/${item.project_id}`)}
                    style={{ background: '#f8fafc', color: '#4338ca', border: '1px solid #c7d2fe', padding: '0.45rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <ExternalLink size={14} /> Details
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* EXTENSION APPEAL MODAL */}
      {appealModalStep && (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div className="deliverable-modal-content">
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={22} color="#f59e0b" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>Appeal Deadline Extension</h3>
              </div>
              <button 
                onClick={() => setAppealModalStep(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0 0 0.25rem 0' }}>
              Step: <strong style={{ color: '#1e293b' }}>{appealModalStep.step_title}</strong>
            </p>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 1.25rem 0' }}>
              Current Deadline: <strong>{appealModalStep.original_deadline ? new Date(appealModalStep.original_deadline).toLocaleDateString() : 'Unspecified'}</strong>
            </p>

            <form onSubmit={handleSubmitAppeal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#475569', marginBottom: '0.35rem', letterSpacing: '0.03em' }}>
                  PROPOSED NEW DEADLINE DATE *
                </label>
                <input 
                  type="date"
                  required
                  value={appealForm.proposed_deadline ? appealForm.proposed_deadline.split('T')[0] : ''}
                  onChange={(e) => setAppealForm({ ...appealForm, proposed_deadline: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
                
                {/* Quick Date Presets */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.45rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Quick Add:</span>
                  <button 
                    type="button"
                    onClick={() => {
                      const base = appealModalStep?.original_deadline ? new Date(appealModalStep.original_deadline) : new Date();
                      base.setDate(base.getDate() + 2);
                      setAppealForm(prev => ({ ...prev, proposed_deadline: base.toISOString().split('T')[0] }));
                    }}
                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}
                  >
                    + 2 Days
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const base = appealModalStep?.original_deadline ? new Date(appealModalStep.original_deadline) : new Date();
                      base.setDate(base.getDate() + 5);
                      setAppealForm(prev => ({ ...prev, proposed_deadline: base.toISOString().split('T')[0] }));
                    }}
                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}
                  >
                    + 5 Days
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const base = appealModalStep?.original_deadline ? new Date(appealModalStep.original_deadline) : new Date();
                      base.setDate(base.getDate() + 7);
                      setAppealForm(prev => ({ ...prev, proposed_deadline: base.toISOString().split('T')[0] }));
                    }}
                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}
                  >
                    + 1 Week
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#475569', marginBottom: '0.35rem', letterSpacing: '0.03em' }}>
                  REASON FOR EXTENSION APPEAL *
                </label>
                <textarea 
                  required
                  rows="3"
                  value={appealForm.reason}
                  onChange={(e) => setAppealForm({ ...appealForm, reason: e.target.value })}
                  placeholder="Explain why extra time is required (e.g. Awaiting client branding assets, extra revision cycle needed)..."
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', resize: 'vertical' }}
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button 
                  type="button"
                  onClick={() => setAppealModalStep(null)}
                  style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submittingAppeal}
                  style={{ background: '#f59e0b', color: '#ffffff', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer' }}
                >
                  {submittingAppeal ? 'Submitting...' : 'Submit Appeal'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
