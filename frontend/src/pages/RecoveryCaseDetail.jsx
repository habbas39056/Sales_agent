import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ShieldAlert, ArrowLeft, User, Phone, Mail, MapPin, Calendar, Clock, 
  DollarSign, FileText, CheckCircle2, AlertCircle, MessageSquare, 
  Send, RefreshCw, Paperclip, AlertTriangle, Layers, ChevronRight, UserPlus, 
  FileSpreadsheet, ExternalLink, ShieldCheck, UserCheck, X, Check
} from 'lucide-react';
import './RecoveryCaseDetail.css';
import '../pages/Modal.css';

export default function RecoveryCaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('contact');

  // Modals
  const [isFollowupOpen, setIsFollowupOpen] = useState(false);
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [isEscalateOpen, setIsEscalateOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);

  // Form States
  const [followupForm, setFollowupForm] = useState({
    method: 'Call',
    outcome: 'Payment Promised',
    remark: '',
    promised_amount: '',
    promised_date: '',
    next_followup_date: '',
    attachment_url: ''
  });

  const [salespeople, setSalespeople] = useState([]);
  const [reassignForm, setReassignForm] = useState({ new_salesperson_id: '', reason: '' });
  const [escalateForm, setEscalateForm] = useState({ escalation_level: 'Sales Manager', reason: '' });
  const [contactForm, setContactForm] = useState({ contact_name: '', role_designation: '', phone: '', email: '', notes: '' });

  useEffect(() => {
    fetchCaseDetails();
    fetchSalespeople();
  }, [id]);

  useEffect(() => {
    if (!loading && (!caseData || !caseData.case)) {
      navigate('/recovery', { replace: true });
    }
  }, [loading, caseData, navigate]);

  const fetchCaseDetails = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/recovery/${id}`);
      setCaseData(res.data);
    } catch (err) {
      console.error('Failed to fetch recovery case detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalespeople = async () => {
    try {
      const res = await axios.get('/api/users');
      setSalespeople((res.data || []).filter(u => u.role !== 'Client'));
    } catch (err) {
      console.error('Failed to fetch salespeople:', err);
    }
  };

  const handleFollowupSubmit = async (e) => {
    e.preventDefault();
    try {
      const userStr = localStorage.getItem('user');
      const u = userStr ? JSON.parse(userStr) : null;
      await axios.post(`/api/recovery/${id}/followups`, {
        ...followupForm,
        user_id: u?.id
      });
      alert('Follow-up entry recorded!');
      setIsFollowupOpen(false);
      setFollowupForm({ method: 'Call', outcome: 'Payment Promised', remark: '', promised_amount: '', promised_date: '', next_followup_date: '', attachment_url: '' });
      fetchCaseDetails();
    } catch (err) {
      console.error('Failed to record follow-up:', err);
      alert(err.response?.data?.error || 'Failed to record follow-up');
    }
  };

  const handleReassignSubmit = async (e) => {
    e.preventDefault();
    try {
      const userStr = localStorage.getItem('user');
      const u = userStr ? JSON.parse(userStr) : null;
      await axios.put(`/api/recovery/${id}/reassign`, {
        ...reassignForm,
        user_id: u?.id
      });
      alert('Case reassigned successfully!');
      setIsReassignOpen(false);
      fetchCaseDetails();
    } catch (err) {
      console.error('Failed to reassign case:', err);
      alert(err.response?.data?.error || 'Failed to reassign case');
    }
  };

  const handleEscalateSubmit = async (e) => {
    e.preventDefault();
    try {
      const userStr = localStorage.getItem('user');
      const u = userStr ? JSON.parse(userStr) : null;
      await axios.post(`/api/recovery/${id}/escalate`, {
        ...escalateForm,
        user_id: u?.id
      });
      alert('Case escalated successfully!');
      setIsEscalateOpen(false);
      fetchCaseDetails();
    } catch (err) {
      console.error('Failed to escalate case:', err);
      alert(err.response?.data?.error || 'Failed to escalate case');
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`/api/recovery/${id}/contacts`, contactForm);
      alert('Contact added successfully!');
      setIsContactOpen(false);
      setContactForm({ contact_name: '', role_designation: '', phone: '', email: '', notes: '' });
      fetchCaseDetails();
    } catch (err) {
      console.error('Failed to add contact:', err);
      alert(err.response?.data?.error || 'Failed to add contact');
    }
  };

  if (loading) {
    return (
      <div className="case-detail-loading">
        <RefreshCw className="spin" size={36} />
        <p>Loading Recovery Case Data...</p>
      </div>
    );
  }

  if (!caseData || !caseData.case) {
    return null;
  }

  const c = caseData.case;
  const isHighVal = Number(c.outstanding_amount) >= 100000;

  return (
    <div className="recovery-detail-container">
      {/* 1. Back Navigation & Quick Info */}
      <div className="detail-top-nav">
        <button className="btn-back" onClick={() => navigate('/recovery')}>
          <ArrowLeft size={16} /> Back to Recovery Queue
        </button>
        <span className="case-created-tag">Case Created: {new Date(c.created_at).toLocaleDateString('en-GB')} ({c.trigger_type})</span>
      </div>

      {/* 2. Fixed Case Master Header */}
      <div className="case-master-header">
        <div className="master-header-main">
          <div className="master-title-group">
            <div className="master-id-badge">
              <ShieldAlert size={20} color="#e11d48" />
              <span>{c.case_number}</span>
            </div>
            <h1 className="master-client-name">{c.client_name}</h1>
            {c.client_business_name && <span className="master-biz-name">({c.client_business_name})</span>}
          </div>

          <div className="master-meta-row">
            <span className="meta-item"><FileText size={14} /> Invoice: <strong>{c.invoice_number}</strong></span>
            <span className="meta-item"><Layers size={14} /> Project: <strong>{c.project_title || 'Direct Billing'}</strong></span>
            <span className="meta-item"><User size={14} /> Owner: <strong>{c.salesperson_name}</strong></span>
          </div>
        </div>

        {/* Master Right Metric Panel */}
        <div className="master-financial-panel">
          <div className="fin-metric-block">
            <span className="fin-lbl">Outstanding Balance</span>
            <span className="fin-val danger">PKR {Number(c.outstanding_amount).toLocaleString()}</span>
            {isHighVal && <span className="high-val-badge">HIGH VALUE</span>}
          </div>

          <div className="fin-metric-block">
            <span className="fin-lbl">Days Overdue</span>
            <span className="fin-val warning">{c.days_overdue || 0} Days</span>
            <span className="fin-sub">Due: {c.invoice_due_date ? new Date(c.invoice_due_date).toLocaleDateString('en-GB') : 'N/A'}</span>
          </div>

          <div className="fin-metric-block">
            <span className="fin-lbl">Current Category</span>
            <span className="cat-pill-badge">{c.category}</span>
            <span className="tone-hint">Tone: {c.tone_guidance || 'Professional'}</span>
          </div>

          <div className="master-action-buttons">
            <button className="btn-master-action primary" onClick={() => setIsFollowupOpen(true)}>
              <MessageSquare size={15} /> + Record Follow-up
            </button>
            <button className="btn-master-action secondary" onClick={() => setIsReassignOpen(true)}>
              <UserPlus size={15} /> Reassign
            </button>
            <button className="btn-master-action danger" onClick={() => setIsEscalateOpen(true)}>
              <AlertCircle size={15} /> Escalate
            </button>
          </div>
        </div>
      </div>

      {/* 3. Communication Tone Guidance Box */}
      <div className="tone-guidance-card">
        <div className="tone-header">
          <ShieldCheck size={18} color="#2563eb" />
          <span>Recommended Communication Tone: <strong>{c.tone_guidance || 'Professional'}</strong></span>
        </div>
        <p className="tone-desc">
          Category <strong>{c.category}</strong>: Follow professional behavioral guidance. Keep communications objective, clear, and focused on payment confirmation.
        </p>
      </div>

      {/* 4. The 8 Navigation Tabs */}
      <div className="detail-tabs-bar">
        <button className={`detail-tab ${activeTab === 'contact' ? 'active' : ''}`} onClick={() => setActiveTab('contact')}>
          1. Contact Information
        </button>
        <button className={`detail-tab ${activeTab === 'financial' ? 'active' : ''}`} onClick={() => setActiveTab('financial')}>
          2. Financial Summary
        </button>
        <button className={`detail-tab ${activeTab === 'project' ? 'active' : ''}`} onClick={() => setActiveTab('project')}>
          3. Project & Deliverables
        </button>
        <button className={`detail-tab ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>
          4. Timeline ({caseData.timeline?.length || 0})
        </button>
        <button className={`detail-tab ${activeTab === 'followups' ? 'active' : ''}`} onClick={() => setActiveTab('followups')}>
          5. Recovery & Follow-ups ({caseData.followups?.length || 0})
        </button>
        <button className={`detail-tab ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')}>
          6. Documents & Invoices
        </button>
        <button className={`detail-tab ${activeTab === 'communication' ? 'active' : ''}`} onClick={() => setActiveTab('communication')}>
          7. Communication
        </button>
        <button className={`detail-tab ${activeTab === 'internal' ? 'active' : ''}`} onClick={() => setActiveTab('internal')}>
          8. Internal Notes & Escalation
        </button>
      </div>

      {/* 5. TAB CONTENT PANELS */}
      <div className="tab-content-container">

        {/* TAB 1: CONTACT INFORMATION */}
        {activeTab === 'contact' && (
          <div className="tab-panel">
            <div className="panel-section-header">
              <h3>Client Contact Information & Account Overview</h3>
              <button className="btn-secondary-sm" onClick={() => setIsContactOpen(true)}>
                <UserPlus size={14} /> + Add Contact Detail
              </button>
            </div>

            <div className="contact-grid">
              <div className="contact-card primary">
                <h4>Primary Client Account</h4>
                <div className="info-row"><User size={15} /> <span>{c.client_name}</span></div>
                {c.client_business_name && <div className="info-row"><Layers size={15} /> <span>{c.client_business_name}</span></div>}
                <div className="info-row"><Mail size={15} /> <a href={`mailto:${c.client_email}`}>{c.client_email}</a></div>
                <div className="info-row"><Phone size={15} /> <span>{c.client_whatsapp || 'N/A'}</span></div>
                {c.client_address && <div className="info-row"><MapPin size={15} /> <span>{c.client_address}</span></div>}
              </div>

              <div className="contact-card secondary">
                <h4>Assigned Recovery Team</h4>
                <div className="info-row"><UserCheck size={15} /> <span>Assigned Salesperson: <strong>{c.salesperson_name}</strong></span></div>
                {c.original_salesperson_name && <div className="info-row"><User size={15} /> <span>Original Owner: {c.original_salesperson_name}</span></div>}
                {c.creator_name && <div className="info-row"><Clock size={15} /> <span>Created By: {c.creator_name}</span></div>}
              </div>
            </div>

            {/* Overall Client Financial & Project Summary */}
            {caseData.client_stats && (
              <div className="client-overall-stats-section" style={{ marginTop: '1.5rem', background: '#0f172a', padding: '1.25rem', borderRadius: '10px', border: '1px solid #1e293b' }}>
                <h4 style={{ color: '#38bdf8', marginBottom: '1rem', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Client Lifetime Portfolio Summary
                </h4>
                <div className="fin-summary-cards" style={{ marginBottom: 0 }}>
                  <div className="fin-summary-box">
                    <span className="lbl">Total Invoiced (All Time)</span>
                    <span className="val">PKR {Number(caseData.client_stats.total_invoiced || 0).toLocaleString()}</span>
                  </div>
                  <div className="fin-summary-box">
                    <span className="lbl">Total Paid Amount</span>
                    <span className="val success">PKR {Number(caseData.client_stats.total_paid || 0).toLocaleString()}</span>
                  </div>
                  <div className="fin-summary-box">
                    <span className="lbl">Net Outstanding Debt</span>
                    <span className="val danger">PKR {Number(caseData.client_stats.total_outstanding || 0).toLocaleString()}</span>
                  </div>
                  <div className="fin-summary-box">
                    <span className="lbl">Total Client Projects</span>
                    <span className="val">{caseData.client_stats.total_projects || 0}</span>
                    <span className="fin-sub" style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                      {caseData.client_stats.active_projects || 0} Active / {caseData.client_stats.completed_projects || 0} Completed
                    </span>
                  </div>
                </div>
              </div>
            )}

            {caseData.contacts && caseData.contacts.length > 0 && (
              <div className="additional-contacts-area" style={{ marginTop: '1.5rem' }}>
                <h4>Additional Client Key Contacts</h4>
                <table className="contacts-table">
                  <thead>
                    <tr>
                      <th>Contact Name</th>
                      <th>Designation / Role</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caseData.contacts.map(ct => (
                      <tr key={ct.id}>
                        <td><strong>{ct.contact_name}</strong></td>
                        <td>{ct.role_designation || '-'}</td>
                        <td>{ct.phone || '-'}</td>
                        <td>{ct.email || '-'}</td>
                        <td>{ct.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FINANCIAL SUMMARY & PAYMENT HISTORY */}
        {activeTab === 'financial' && (
          <div className="tab-panel">
            <h3>Financial Summary & Payment History</h3>
            <div className="fin-summary-cards">
              <div className="fin-summary-box">
                <span className="lbl">Case Invoice Amount</span>
                <span className="val">PKR {Number(c.invoice_amount || 0).toLocaleString()}</span>
              </div>
              <div className="fin-summary-box">
                <span className="lbl">Total Recovered</span>
                <span className="val success">PKR {Number(c.recovered_amount || 0).toLocaleString()}</span>
              </div>
              <div className="fin-summary-box">
                <span className="lbl">Outstanding Balance</span>
                <span className="val danger">PKR {Number(c.outstanding_amount || 0).toLocaleString()}</span>
              </div>
            </div>

            {/* 1. Payment Received Log (Kab kitni amount ayi thi) */}
            <div style={{ marginTop: '1.5rem' }}>
              <h4 style={{ color: '#38bdf8', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign size={18} color="#10b981" /> Payment Received History (Kab & Kitni Amount Ayi Thi)
              </h4>
              {caseData.financial?.payment_history && caseData.financial.payment_history.length > 0 ? (
                <table className="items-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Payment Date</th>
                      <th>Invoice #</th>
                      <th>Payment Method</th>
                      <th>Bank / Ref</th>
                      <th>Notes / Remarks</th>
                      <th style={{ textAlign: 'right' }}>Amount Paid (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caseData.financial.payment_history.map((p, idx) => (
                      <tr key={idx}>
                        <td><strong>{p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-GB') : 'N/A'}</strong></td>
                        <td>{p.invoice_number || c.invoice_number}</td>
                        <td><span style={{ padding: '2px 8px', borderRadius: '6px', background: '#0284c7', color: '#fff', fontSize: '0.75rem' }}>{p.payment_method || 'Received'}</span></td>
                        <td>{p.bank || p.transaction_id || '-'}</td>
                        <td>{p.notes || p.description || '-'}</td>
                        <td style={{ textAlign: 'right', color: '#10b981' }}>
                          <strong>+ PKR {Number(p.amount || 0).toLocaleString()}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic', background: '#0f172a', padding: '1rem', borderRadius: '8px' }}>
                  No payment transactions recorded for this invoice yet.
                </p>
              )}
            </div>

            {/* 2. All Client Invoices History */}
            <div style={{ marginTop: '2rem' }}>
              <h4 style={{ color: '#38bdf8', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="#38bdf8" /> Complete Client Invoices History
              </h4>
              {caseData.financial?.all_invoices && caseData.financial.all_invoices.length > 0 ? (
                <table className="items-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Issue Date</th>
                      <th>Due Date</th>
                      <th style={{ textAlign: 'right' }}>Total Amount</th>
                      <th style={{ textAlign: 'right' }}>Paid Amount</th>
                      <th style={{ textAlign: 'right' }}>Balance Due</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caseData.financial.all_invoices.map((inv) => {
                      const isCurrentCaseInv = inv.id === c.invoice_id;
                      return (
                        <tr key={inv.id} style={{ background: isCurrentCaseInv ? 'rgba(56, 189, 248, 0.08)' : 'transparent' }}>
                          <td>
                            <strong>{inv.invoice_number}</strong>
                            {isCurrentCaseInv && <span style={{ marginLeft: '6px', fontSize: '0.7rem', background: '#e11d48', color: '#fff', padding: '1px 5px', borderRadius: '4px' }}>CURRENT CASE</span>}
                          </td>
                          <td>{inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('en-GB') : '-'}</td>
                          <td>{inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB') : '-'}</td>
                          <td style={{ textAlign: 'right' }}>PKR {Number(inv.amount || 0).toLocaleString()}</td>
                          <td style={{ textAlign: 'right', color: '#10b981' }}>PKR {Number(inv.paid_amount || (inv.amount - inv.balance) || 0).toLocaleString()}</td>
                          <td style={{ textAlign: 'right', color: inv.balance > 0 ? '#ef4444' : '#94a3b8' }}>
                            <strong>PKR {Number(inv.balance || 0).toLocaleString()}</strong>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`status-badge ${inv.status === 'Paid' ? 'status-recovered' : inv.status === 'Overdue' ? 'status-disputed' : 'status-promised'}`}>
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No other invoices found for this client.</p>
              )}
            </div>

            {/* 3. Invoice Line Items Breakdown */}
            {caseData.financial?.invoice_items && caseData.financial.invoice_items.length > 0 && (
              <div style={{ marginTop: '2rem' }}>
                <h4 style={{ color: '#38bdf8', marginBottom: '0.75rem' }}>Current Case Invoice Line Items</h4>
                <table className="items-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th style={{ textAlign: 'center' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Unit Price (PKR)</th>
                      <th style={{ textAlign: 'right' }}>Total (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caseData.financial.invoice_items.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.description}</td>
                        <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right' }}>PKR {Number(item.unit_price || 0).toLocaleString()}</td>
                        <td style={{ textAlign: 'right' }}><strong>PKR {Number(item.total || 0).toLocaleString()}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PROJECT & DELIVERABLES */}
        {activeTab === 'project' && (
          <div className="tab-panel">
            <h3>Project & Deliverables History</h3>

            {/* 1. All Projects of this Client */}
            <div style={{ marginBottom: '2rem' }}>
              <h4 style={{ color: '#38bdf8', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} color="#38bdf8" /> All Client Projects (Pending, Active & Completed)
              </h4>
              {caseData.project?.all_projects && caseData.project.all_projects.length > 0 ? (
                <table className="items-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Project Title</th>
                      <th>Status</th>
                      <th>Steps Progress</th>
                      <th>Created Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caseData.project.all_projects.map((proj) => {
                      const isCurrentProj = proj.id === c.project_id;
                      return (
                        <tr key={proj.id} style={{ background: isCurrentProj ? 'rgba(56, 189, 248, 0.08)' : 'transparent' }}>
                          <td>
                            <strong>{proj.title}</strong>
                            {isCurrentProj && <span style={{ marginLeft: '6px', fontSize: '0.7rem', background: '#38bdf8', color: '#0f172a', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>ACTIVE CASE PROJECT</span>}
                            {proj.description && <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{proj.description}</div>}
                          </td>
                          <td>
                            <span className={`status-badge ${proj.status === 'Completed' || proj.status === 'Paid' ? 'status-recovered' : proj.status === 'In Progress' ? 'status-active' : 'status-promised'}`}>
                              {proj.status}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.85rem' }}>
                              {proj.completed_steps_calc || proj.completed_steps || 0} / {proj.total_steps_calc || proj.total_steps || 0} Steps
                            </span>
                          </td>
                          <td>{proj.created_at ? new Date(proj.created_at).toLocaleDateString('en-GB') : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No projects registered for this client.</p>
              )}
            </div>

            {/* 2. Case Specific Project Overview & Steps */}
            {c.project_title && (
              <div style={{ marginTop: '1.5rem', background: '#0f172a', padding: '1.25rem', borderRadius: '10px', border: '1px solid #1e293b' }}>
                <h4 style={{ color: '#38bdf8', marginBottom: '0.5rem' }}>Current Recovery Case Project: {c.project_title}</h4>
                <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: '0 0 1rem 0' }}>{c.project_description || 'No description provided.'}</p>
                <span className="proj-status-tag" style={{ background: '#0284c7', color: '#fff', padding: '3px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '600' }}>
                  Status: {c.project_status}
                </span>

                <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>Project Milestone Steps & Deliverables</h4>
                {caseData.project?.steps && caseData.project.steps.length > 0 ? (
                  <div className="steps-list">
                    {caseData.project.steps.map((step, idx) => (
                      <div key={idx} className="step-item-card" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#1e293b', borderRadius: '8px', marginBottom: '8px' }}>
                        <div>
                          <span className="step-num" style={{ fontWeight: 'bold', color: '#38bdf8', marginRight: '8px' }}>Step {idx + 1}:</span>
                          <span className="step-title" style={{ color: '#f8fafc' }}>{step.title}</span>
                        </div>
                        <span className={`step-status ${step.status === 'Completed' ? 'completed' : ''}`} style={{ color: step.status === 'Completed' ? '#10b981' : '#f59e0b', fontWeight: 'bold', fontSize: '0.85rem' }}>
                          {step.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>No individual milestone steps logged for this project.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: TIMELINE */}
        {activeTab === 'timeline' && (
          <div className="tab-panel">
            <h3>Interactive Recovery Timeline</h3>
            <div className="timeline-feed">
              {caseData.timeline?.map(t => (
                <div key={t.id} className="timeline-event-card">
                  <div className="event-bullet" />
                  <div className="event-body">
                    <div className="event-header-line">
                      <span className="event-title">{t.title}</span>
                      <span className="event-time">{new Date(t.created_at).toLocaleString()}</span>
                    </div>
                    <p className="event-desc">{t.description}</p>
                    {t.user_name && <span className="event-user">Logged by: {t.user_name}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: RECOVERY & FOLLOW-UPS */}
        {activeTab === 'followups' && (
          <div className="tab-panel">
            <div className="panel-section-header">
              <h3>Follow-up History & Actions</h3>
              <button className="btn-primary-sm" onClick={() => setIsFollowupOpen(true)}>
                <MessageSquare size={14} /> + Record New Follow-up
              </button>
            </div>

            <div className="followup-list">
              {caseData.followups?.map(f => (
                <div key={f.id} className="followup-item-card">
                  <div className="f-header">
                    <span className="f-method">{f.method} Interaction</span>
                    <span className="f-outcome">{f.outcome}</span>
                    <span className="f-date">{new Date(f.created_at).toLocaleString()}</span>
                  </div>
                  <p className="f-remark">"{f.remark}"</p>
                  {f.promised_date && (
                    <div className="f-promised-box">
                      <span>Promised Amount: PKR {Number(f.promised_amount || 0).toLocaleString()}</span>
                      <span>Promised Date: {new Date(f.promised_date).toLocaleDateString('en-GB')}</span>
                    </div>
                  )}
                  <span className="f-user">Logged by: {f.user_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: DOCUMENTS & INVOICES */}
        {activeTab === 'documents' && (
          <div className="tab-panel">
            <h3>Documents & Linked Invoices / Quotations</h3>
            <div className="docs-list">
              <div className="doc-item">
                <FileText size={20} color="#2563eb" />
                <div className="doc-info">
                  <span className="doc-name">Case Invoice #{c.invoice_number}</span>
                  <span className="doc-sub">Amount: PKR {Number(c.invoice_amount).toLocaleString()}</span>
                </div>
                <Link to="/invoices" className="btn-secondary-sm"><ExternalLink size={14} /> View Invoice</Link>
              </div>
              {caseData.quotations?.map(q => (
                <div key={q.id} className="doc-item" style={{ marginTop: '10px' }}>
                  <FileText size={20} color="#10b981" />
                  <div className="doc-info">
                    <span className="doc-name">Quotation #{q.quotation_number}</span>
                    <span className="doc-sub">Amount: PKR {Number(q.amount || 0).toLocaleString()} | Status: {q.status}</span>
                  </div>
                  <Link to="/quotations" className="btn-secondary-sm"><ExternalLink size={14} /> View Quotation</Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 7: COMMUNICATION */}
        {activeTab === 'communication' && (
          <div className="tab-panel">
            <h3>Communication Log (Calls, WhatsApp & Emails)</h3>
            <p className="sub-txt">Integrated log of all client interactions regarding recovery.</p>
            <div className="comm-feed">
              {caseData.followups?.map(f => (
                <div key={f.id} className="comm-bubble">
                  <span className="comm-type">{f.method}</span>
                  <p className="comm-txt">{f.remark}</p>
                  <span className="comm-meta">{new Date(f.created_at).toLocaleString()} - {f.user_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 8: INTERNAL NOTES & ESCALATION */}
        {activeTab === 'internal' && (
          <div className="tab-panel">
            <h3>Internal Notes & Management Escalation</h3>
            <div className="internal-info-box">
              <p><strong>Manager Recovery Reason:</strong> {c.manager_reason || 'N/A'}</p>
              <p><strong>Internal Remark:</strong> {c.manager_remark || 'None provided.'}</p>
              {c.escalation_level !== 'None' && (
                <div className="escalation-alert-box">
                  <AlertCircle size={20} color="#e11d48" />
                  <div>
                    <strong>Escalation Level: {c.escalation_level}</strong>
                    <p>{c.escalation_reason || 'No specific escalation reason logged.'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* MODAL: FOLLOW-UP FORM */}
      {isFollowupOpen && (
        <div className="modal-overlay">
          <div className="modal-content custom-modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header-custom">
              <h3><MessageSquare size={18} /> Record Follow-up for {c.case_number}</h3>
              <button className="modal-close-btn" onClick={() => setIsFollowupOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleFollowupSubmit} className="modal-body-custom">
              <div className="form-row-2">
                <div className="form-group-custom">
                  <label className="required">Contact Method</label>
                  <select value={followupForm.method} onChange={(e) => setFollowupForm({ ...followupForm, method: e.target.value })}>
                    <option value="Call">Call</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Email">Email</option>
                    <option value="Meeting">Meeting</option>
                  </select>
                </div>
                <div className="form-group-custom">
                  <label className="required">Outcome</label>
                  <select value={followupForm.outcome} onChange={(e) => setFollowupForm({ ...followupForm, outcome: e.target.value })}>
                    <option value="Payment Promised">Payment Promised</option>
                    <option value="Payment Received">Payment Received</option>
                    <option value="Partial Payment">Partial Payment</option>
                    <option value="No Response">No Response</option>
                    <option value="Extension">Extension Requested</option>
                    <option value="Dispute">Dispute</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="form-group-custom">
                <label className="required">Remark / Discussion</label>
                <textarea rows={3} value={followupForm.remark} onChange={(e) => setFollowupForm({ ...followupForm, remark: e.target.value })} required />
              </div>
              {followupForm.outcome === 'Payment Promised' && (
                <div className="form-row-2">
                  <div className="form-group-custom">
                    <label className="required">Promised Amount (PKR)</label>
                    <input type="number" value={followupForm.promised_amount} onChange={(e) => setFollowupForm({ ...followupForm, promised_amount: e.target.value })} required />
                  </div>
                  <div className="form-group-custom">
                    <label className="required">Promised Date</label>
                    <input type="date" value={followupForm.promised_date} onChange={(e) => setFollowupForm({ ...followupForm, promised_date: e.target.value })} required />
                  </div>
                </div>
              )}
              <div className="modal-footer-custom">
                <button type="button" className="btn-cancel" onClick={() => setIsFollowupOpen(false)}>Cancel</button>
                <button type="submit" className="btn-submit">Save Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD CONTACT */}
      {isContactOpen && (
        <div className="modal-overlay">
          <div className="modal-content custom-modal" style={{ maxWidth: '520px' }}>
            <div className="modal-header-custom">
              <h3><UserPlus size={18} /> Add Key Contact Person</h3>
              <button className="modal-close-btn" onClick={() => setIsContactOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleContactSubmit} className="modal-body-custom">
              <div className="form-group-custom">
                <label className="required">Contact Name</label>
                <input type="text" value={contactForm.contact_name} onChange={(e) => setContactForm({ ...contactForm, contact_name: e.target.value })} required />
              </div>
              <div className="form-group-custom">
                <label>Role / Designation</label>
                <input type="text" placeholder="e.g. Accounts Manager, CFO" value={contactForm.role_designation} onChange={(e) => setContactForm({ ...contactForm, role_designation: e.target.value })} />
              </div>
              <div className="form-row-2">
                <div className="form-group-custom">
                  <label>Phone / WhatsApp</label>
                  <input type="text" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
                </div>
                <div className="form-group-custom">
                  <label>Email</label>
                  <input type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer-custom">
                <button type="button" className="btn-cancel" onClick={() => setIsContactOpen(false)}>Cancel</button>
                <button type="submit" className="btn-submit">Add Contact</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
