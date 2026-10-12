import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ShieldAlert, ArrowLeft, User, Phone, Mail, MapPin, Calendar, Clock, 
  DollarSign, FileText, CheckCircle2, AlertCircle, MessageSquare, 
  Send, RefreshCw, Paperclip, AlertTriangle, Layers, ChevronRight, UserPlus, 
  ExternalLink, ShieldCheck, UserCheck, X, Check, Printer, LayoutDashboard,
  TrendingUp, History, Sparkles, MessageCircle, ArrowUpRight, CheckCircle,
  FileCheck, Wallet, Briefcase
} from 'lucide-react';
import InvoiceTemplate from '../components/InvoiceTemplate';
import './RecoveryCaseDetail.css';
import '../pages/Modal.css';

export default function RecoveryCaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' is default!

  // Modals
  const [isFollowupOpen, setIsFollowupOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState(null);
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

  const [scheduleForm, setScheduleForm] = useState({
    next_followup_date: '',
    notes: ''
  });

  const [salespeople, setSalespeople] = useState([]);
  const [reassignForm, setReassignForm] = useState({ new_salesperson_id: '', reason: '' });
  const [escalateForm, setEscalateForm] = useState({ escalation_level: 'Sales Manager', reason: '' });
  const [contactForm, setContactForm] = useState({ contact_name: '', role_designation: '', phone: '', email: '', notes: '' });

  useEffect(() => {
    fetchCaseDetails();
    fetchSalespeople();
  }, [id]);

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

  const handleOpenInvoiceModal = async (invoiceId) => {
    const targetId = invoiceId || caseData?.case?.invoice_id;
    if (!targetId) return;
    try {
      const res = await axios.get(`/api/invoices/${targetId}`);
      setPreviewInvoice(res.data);
      setIsInvoiceModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch complete invoice data, using case fallback:', err);
      const c = caseData?.case || {};
      const fallback = {
        id: c.invoice_id,
        invoice_number: c.invoice_number,
        amount: c.invoice_amount,
        balance: c.invoice_balance,
        issue_date: c.invoice_issue_date,
        due_date: c.invoice_due_date,
        status: c.invoice_status,
        client_name: c.client_name,
        business_name: c.client_business_name,
        client_email: c.client_email,
        whatsapp_number: c.client_whatsapp,
        physical_address: c.client_address,
        project_title: c.project_title,
        items: caseData?.financial?.invoice_items || [],
        payments: caseData?.financial?.payment_history || []
      };
      setPreviewInvoice(fallback);
      setIsInvoiceModalOpen(true);
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
      alert('Follow-up entry recorded successfully!');
      setIsFollowupOpen(false);
      setFollowupForm({ 
        method: 'Call', 
        outcome: 'Payment Promised', 
        remark: '', 
        promised_amount: '', 
        promised_date: '', 
        next_followup_date: '', 
        attachment_url: '' 
      });
      fetchCaseDetails();
    } catch (err) {
      console.error('Failed to record follow-up:', err);
      alert(err.response?.data?.error || 'Failed to record follow-up');
    }
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    try {
      const userStr = localStorage.getItem('user');
      const u = userStr ? JSON.parse(userStr) : null;
      await axios.put(`/api/recovery/${id}/schedule`, {
        next_followup_date: scheduleForm.next_followup_date,
        notes: scheduleForm.notes,
        user_id: u?.id
      });
      alert('Next follow-up date updated!');
      setIsScheduleModalOpen(false);
      setScheduleForm({ next_followup_date: '', notes: '' });
      fetchCaseDetails();
    } catch (err) {
      console.error('Failed to update next follow-up schedule:', err);
      alert(err.response?.data?.error || 'Failed to update schedule');
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
        <RefreshCw className="spin" size={32} />
        <p>Loading Recovery Dashboard...</p>
      </div>
    );
  }

  if (!caseData || !caseData.case) {
    return (
      <div className="recovery-detail-container" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <ShieldAlert size={42} color="#64748b" style={{ marginBottom: '14px' }} />
        <h3 style={{ color: '#0f172a', marginBottom: '8px' }}>Recovery Case Not Found</h3>
        <p style={{ color: '#64748b', marginBottom: '20px', fontSize: '0.9rem' }}>
          Could not load details for case "{id}".
        </p>
        <button className="btn-master-action secondary" onClick={() => navigate('/recovery')} style={{ margin: '0 auto' }}>
          <ArrowLeft size={15} /> Return to Queue
        </button>
      </div>
    );
  }

  const c = caseData.case;
  const isHighVal = Number(c.outstanding_amount) >= 100000;
  const daysOverdue = Number(c.days_overdue || 0);

  // Clean phone for WhatsApp direct link
  const rawPhone = c.client_whatsapp || c.client_phone || '';
  const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
  const formattedWhatsappNumber = cleanPhone.startsWith('0') ? '92' + cleanPhone.slice(1) : cleanPhone;
  const whatsappUrl = formattedWhatsappNumber 
    ? `https://wa.me/${formattedWhatsappNumber}?text=${encodeURIComponent(`Dear ${c.client_name}, regarding Invoice ${c.invoice_number} (Outstanding: PKR ${Number(c.outstanding_amount).toLocaleString()}) from Adwise Labs.`)}`
    : null;

  // Next Followup Date helper
  const effectiveNextFollowup = c.next_followup_date || 
    (caseData.followups && caseData.followups.find(f => f.next_followup_date)?.next_followup_date);

  const getNextFollowupBadge = (dateStr) => {
    if (!dateStr) return { text: 'Pending', type: 'pending' };
    const target = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const diffDays = Math.round((targetDay - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Overdue (${Math.abs(diffDays)}d)`, type: 'overdue' };
    } else if (diffDays === 0) {
      return { text: 'Today', type: 'today' };
    } else if (diffDays === 1) {
      return { text: 'Tomorrow', type: 'tomorrow' };
    } else {
      return { text: `In ${diffDays}d`, type: 'future' };
    }
  };

  const nextFollowupInfo = getNextFollowupBadge(effectiveNextFollowup);

  // Project progress
  const totalProjectSteps = Number(c.total_steps || caseData.project?.steps?.length || 0);
  const completedProjectSteps = Number(c.completed_steps || caseData.project?.steps?.filter(s => s.status === 'Completed').length || 0);
  const projectPct = totalProjectSteps > 0 
    ? Math.round((completedProjectSteps / totalProjectSteps) * 100) 
    : (c.project_status === 'Completed' || c.project_status === 'Paid' ? 100 : 0);

  return (
    <div className="recovery-detail-container">
      {/* 1. TOP NAV & ACTIONS */}
      <div className="detail-top-nav">
        <div className="top-nav-left">
          <button className="btn-back" onClick={() => navigate('/recovery')}>
            <ArrowLeft size={15} /> Recovery Queue
          </button>
          <div className="nav-case-chip">
            <span className="dot-indicator" />
            <span>Case: <strong>{c.case_number}</strong></span>
          </div>
          <span className="case-trigger-pill">{c.trigger_type}</span>
          <span className="case-status-badge">{c.status}</span>
        </div>

        <div className="top-nav-actions">
          <button className="btn-master-action secondary" onClick={() => handleOpenInvoiceModal(c.invoice_id)}>
            <FileText size={14} /> View Invoice
          </button>
          <button className="btn-master-action primary" onClick={() => setIsFollowupOpen(true)}>
            <MessageSquare size={14} /> + Record Follow-up
          </button>
          <button className="btn-master-action secondary" onClick={() => setIsReassignOpen(true)}>
            <UserPlus size={14} /> Reassign
          </button>
          <button className="btn-master-action secondary" onClick={() => setIsEscalateOpen(true)}>
            <AlertCircle size={14} /> Escalate
          </button>
        </div>
      </div>

      {/* 2. DECENT & ATTRACTIVE CLIENT HERO CARD */}
      <div className="master-client-hero-card">
        <div className="client-hero-identity">
          <div className="client-avatar-badge">
            {(c.client_name || 'C').charAt(0).toUpperCase()}
          </div>
          <div className="client-hero-details">
            <div className="client-name-row">
              <h2 className="client-hero-name">{c.client_name}</h2>
              {c.client_business_name && (
                <span className="client-biz-badge">{c.client_business_name}</span>
              )}
            </div>
            
            <div className="client-quick-contact-row">
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="contact-action-chip" title="Chat on WhatsApp">
                  <MessageCircle size={13} color="#16a34a" /> WhatsApp: {c.client_whatsapp}
                </a>
              )}
              {c.client_whatsapp && !whatsappUrl && (
                <span className="contact-action-chip">
                  <Phone size={13} /> {c.client_whatsapp}
                </span>
              )}
              {c.client_email && (
                <a href={`mailto:${c.client_email}`} className="contact-action-chip" title="Send Email">
                  <Mail size={13} color="#2563eb" /> {c.client_email}
                </a>
              )}
              {c.client_address && (
                <span className="contact-action-chip" title={c.client_address}>
                  <MapPin size={13} /> {c.client_address}
                </span>
              )}
              <span className="contact-action-chip">
                <UserCheck size={13} /> Assigned: <strong>{c.salesperson_name}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Quick Follow-up schedule banner */}
        <div className="hero-next-followup-box">
          <div className="hnf-header">
            <span className="hnf-title"><Calendar size={13} /> Next Follow-up</span>
            <span className={`hnf-badge ${nextFollowupInfo.type}`}>{nextFollowupInfo.text}</span>
          </div>
          <div className="hnf-date-txt">
            {effectiveNextFollowup ? new Date(effectiveNextFollowup).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'No date set'}
          </div>
          <button 
            className="hnf-quick-btn" 
            onClick={() => {
              setScheduleForm({ 
                next_followup_date: effectiveNextFollowup ? new Date(effectiveNextFollowup).toISOString().slice(0, 16) : '', 
                notes: '' 
              });
              setIsScheduleModalOpen(true);
            }}
          >
            <Clock size={12} /> Set Date
          </button>
        </div>
      </div>

      {/* 3. COMPACT, SMALL & ATTRACTIVE 5-KPI STATS BAR */}
      <div className="recovery-executive-kpi-bar">
        {/* KPI 1: Outstanding Balance */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Outstanding Balance</span>
            <Wallet size={14} className="kpi-icon" />
          </div>
          <div className="kpi-main-row">
            <span className="kpi-value">PKR {Number(c.outstanding_amount).toLocaleString()}</span>
            {isHighVal && <span className="kpi-pill-badge danger">High Value</span>}
          </div>
          <div className="kpi-subtext">
            <span>Invoice: PKR {Number(c.invoice_amount || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* KPI 2: Days Above Due Date */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Days Above Due Date</span>
            <AlertTriangle size={14} className="kpi-icon" />
          </div>
          <div className="kpi-main-row">
            <span className="kpi-value">{daysOverdue > 0 ? `${daysOverdue} Days` : '0 Days'}</span>
            <span className={`kpi-pill-badge ${daysOverdue > 15 ? 'warning' : 'neutral'}`}>
              {daysOverdue > 15 ? 'Overdue' : 'On Schedule'}
            </span>
          </div>
          <div className="kpi-subtext">
            <span>Due: {c.invoice_due_date ? new Date(c.invoice_due_date).toLocaleDateString('en-GB') : 'N/A'}</span>
          </div>
        </div>

        {/* KPI 3: Next Follow-up On */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Next Follow-up On</span>
            <Calendar size={14} className="kpi-icon" />
          </div>
          <div className="kpi-main-row">
            <span className="kpi-value">
              {effectiveNextFollowup 
                ? new Date(effectiveNextFollowup).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                : 'Pending'}
            </span>
            <span className={`kpi-pill-badge ${nextFollowupInfo.type}`}>{nextFollowupInfo.text}</span>
          </div>
          <div className="kpi-subtext">
            <span>{effectiveNextFollowup ? new Date(effectiveNextFollowup).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not Scheduled'}</span>
          </div>
        </div>

        {/* KPI 4: Category & Tone */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Category & Tone</span>
            <ShieldCheck size={14} className="kpi-icon" />
          </div>
          <div className="kpi-main-row">
            <span className="kpi-value" style={{ fontSize: '0.96rem' }}>{c.category}</span>
          </div>
          <div className="kpi-subtext">
            <span>Tone: {c.tone_guidance || 'Professional'}</span>
          </div>
        </div>

        {/* KPI 5: Project Details */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Project Details</span>
            <Briefcase size={14} className="kpi-icon" />
          </div>
          <div className="kpi-main-row">
            <span className="kpi-value project-title-clamp">{c.project_title || 'Direct Billing'}</span>
          </div>
          <div className="kpi-subtext">
            <span>{totalProjectSteps > 0 ? `${completedProjectSteps}/${totalProjectSteps} Milestones` : (c.project_status || 'Active')}</span>
          </div>
        </div>
      </div>

      {/* 4. DASHBOARD TAB NAVIGATION BAR (FLEX WRAP - NO HORIZONTAL SCROLLBAR!) */}
      <div className="detail-tabs-bar">
        <button 
          className={`detail-tab ${activeTab === 'dashboard' ? 'active' : ''}`} 
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={14} /> Complete Dashboard
        </button>
        <button 
          className={`detail-tab ${activeTab === 'followups' ? 'active' : ''}`} 
          onClick={() => setActiveTab('followups')}
        >
          <MessageSquare size={14} /> Follow-ups Timeline ({caseData.followups?.length || 0})
        </button>
        <button 
          className={`detail-tab ${activeTab === 'financial' ? 'active' : ''}`} 
          onClick={() => setActiveTab('financial')}
        >
          <DollarSign size={14} /> Invoices & Payment History ({caseData.financial?.all_invoices?.length || 1})
        </button>
        <button 
          className={`detail-tab ${activeTab === 'project' ? 'active' : ''}`} 
          onClick={() => setActiveTab('project')}
        >
          <Layers size={14} /> Project & Deliverables ({caseData.project?.steps?.length || 0})
        </button>
        <button 
          className={`detail-tab ${activeTab === 'client' ? 'active' : ''}`} 
          onClick={() => setActiveTab('client')}
        >
          <User size={14} /> Client Profile & Contacts ({caseData.contacts?.length || 0})
        </button>
        <button 
          className={`detail-tab ${activeTab === 'escalation' ? 'active' : ''}`} 
          onClick={() => setActiveTab('escalation')}
        >
          <AlertCircle size={14} /> Internal Escalations & Notes
        </button>
      </div>

      {/* 5. TAB CONTENT PANELS */}
      <div className="tab-content-container">

        {/* TAB 1: COMPLETE DASHBOARD (DEFAULT VIEW) */}
        {activeTab === 'dashboard' && (
          <div className="complete-dashboard-grid">
            
            {/* LEFT COLUMN: INVOICE DETAILS, PAYMENT HISTORY & PROJECT */}
            <div className="dash-col-left">
              
              {/* SECTION 1: CASE INVOICE & LINE ITEMS */}
              <div className="dash-card">
                <div className="dash-card-header">
                  <div className="dch-title-wrap">
                    <FileText size={16} color="#0f172a" />
                    <div>
                      <h3 className="dch-title">Invoice Details & Line Items</h3>
                      <span className="dch-subtitle">Invoice #{c.invoice_number} linked to this case</span>
                    </div>
                  </div>
                  <button 
                    className="btn-dash-action secondary" 
                    onClick={() => handleOpenInvoiceModal(c.invoice_id)}
                  >
                    <FileText size={13} /> View Full Invoice
                  </button>
                </div>

                <div className="invoice-summary-strip">
                  <div className="iss-box">
                    <span className="iss-lbl">Invoice #</span>
                    <span className="iss-val font-bold">{c.invoice_number}</span>
                  </div>
                  <div className="iss-box">
                    <span className="iss-lbl">Issue Date</span>
                    <span className="iss-val">{c.invoice_issue_date ? new Date(c.invoice_issue_date).toLocaleDateString('en-GB') : '-'}</span>
                  </div>
                  <div className="iss-box">
                    <span className="iss-lbl">Due Date</span>
                    <span className="iss-val font-bold">{c.invoice_due_date ? new Date(c.invoice_due_date).toLocaleDateString('en-GB') : '-'}</span>
                  </div>
                  <div className="iss-box">
                    <span className="iss-lbl">Total Amount</span>
                    <span className="iss-val">PKR {Number(c.invoice_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="iss-box">
                    <span className="iss-lbl">Outstanding Balance</span>
                    <span className="iss-val font-bold danger">PKR {Number(c.outstanding_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="iss-box">
                    <span className="iss-lbl">Status</span>
                    <span className="status-badge status-promised">{c.invoice_status || 'Overdue'}</span>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="card-inner-section">
                  <h4 className="inner-section-heading">
                    <span>Line Items Breakdown</span>
                    <span className="badge-count">({caseData.financial?.invoice_items?.length || 0} items)</span>
                  </h4>
                  {caseData.financial?.invoice_items && caseData.financial.invoice_items.length > 0 ? (
                    <div className="table-responsive">
                      <table className="items-table">
                        <thead>
                          <tr>
                            <th>Item Description</th>
                            <th style={{ textAlign: 'center' }}>Qty</th>
                            <th style={{ textAlign: 'center' }}>Unit</th>
                            <th style={{ textAlign: 'right' }}>Unit Price (PKR)</th>
                            <th style={{ textAlign: 'right' }}>Total Amount (PKR)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {caseData.financial.invoice_items.map((item, idx) => (
                            <tr key={idx}>
                              <td>
                                <div><strong>{item.description}</strong></div>
                                {item.details && <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{item.details}</div>}
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: '600' }}>{item.quantity}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#334155', fontSize: '0.78rem', fontWeight: '600', textTransform: 'capitalize' }}>
                                  {item.unit || '—'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>PKR {Number(item.unit_price || 0).toLocaleString()}</td>
                              <td style={{ textAlign: 'right', fontWeight: '700' }}>PKR {Number(item.total || (item.quantity * item.unit_price) || 0).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="empty-subtext">No itemized line items recorded for this invoice.</p>
                  )}
                </div>
              </div>

              {/* SECTION 2: PAYMENT HISTORY (KAB & KITNI AMOUNT AYI THI) */}
              <div className="dash-card">
                <div className="dash-card-header">
                  <div className="dch-title-wrap">
                    <DollarSign size={16} color="#0f172a" />
                    <div>
                      <h3 className="dch-title">Payment History</h3>
                      <span className="dch-subtitle">
                        Total Recovered: <strong>PKR {Number(c.recovered_amount || 0).toLocaleString()}</strong>
                      </span>
                    </div>
                  </div>
                  <Link to="/invoices" className="btn-dash-action secondary">
                    <ExternalLink size={13} /> Open Invoices Hub
                  </Link>
                </div>

                {caseData.financial?.payment_history && caseData.financial.payment_history.length > 0 ? (
                  <div className="table-responsive">
                    <table className="items-table">
                      <thead>
                        <tr>
                          <th>Payment Date</th>
                          <th>Invoice #</th>
                          <th>Method</th>
                          <th>Ref / Bank</th>
                          <th>Notes</th>
                          <th style={{ textAlign: 'right' }}>Amount Paid (PKR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {caseData.financial.payment_history.map((p, idx) => (
                          <tr key={idx}>
                            <td><strong>{p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-GB') : '-'}</strong></td>
                            <td><span className="inv-tag">{p.invoice_number || c.invoice_number}</span></td>
                            <td><span className="method-pill">{p.payment_method || 'Received'}</span></td>
                            <td>{p.bank || p.transaction_id || '-'}</td>
                            <td className="note-text">{p.notes || p.description || '-'}</td>
                            <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: '700' }}>
                              + PKR {Number(p.amount || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-payment-state">
                    <p>No payment receipts recorded for Invoice #{c.invoice_number} yet.</p>
                    <span className="sub">Remaining balance: <strong>PKR {Number(c.outstanding_amount).toLocaleString()}</strong></span>
                  </div>
                )}
              </div>

              {/* SECTION 3: PROJECT DETAILS & DELIVERABLES */}
              <div className="dash-card">
                <div className="dash-card-header">
                  <div className="dch-title-wrap">
                    <Layers size={16} color="#0f172a" />
                    <div>
                      <h3 className="dch-title">Project Details & Milestones</h3>
                      <span className="dch-subtitle">{c.project_title || 'Direct Billing Account'} ({c.project_status || 'Active'})</span>
                    </div>
                  </div>
                  {c.project_id && (
                    <Link to="/projects" className="btn-dash-action secondary">
                      <ExternalLink size={13} /> View in Projects
                    </Link>
                  )}
                </div>

                <div className="project-detail-hero">
                  <div className="pd-header-meta">
                    <h4>{c.project_title || 'Direct Billing Service'}</h4>
                    <span className="status-badge status-active">{c.project_status || 'Active'}</span>
                  </div>
                  <p className="pd-description">{c.project_description || 'No additional project description provided.'}</p>

                  <div className="pd-progress-box">
                    <div className="pd-progress-header">
                      <span>Milestones Progress</span>
                      <strong>{totalProjectSteps > 0 ? `${completedProjectSteps} of ${totalProjectSteps} Steps (${projectPct}%)` : 'Active'}</strong>
                    </div>
                    <div className="kpi-progress-bar-wrap">
                      <div className="kpi-progress-bar info" style={{ width: `${projectPct}%` }} />
                    </div>
                  </div>
                </div>

                {/* Milestone Steps */}
                <div className="card-inner-section">
                  <h4 className="inner-section-heading">Milestone Deliverable Steps</h4>
                  {caseData.project?.steps && caseData.project.steps.length > 0 ? (
                    <div className="steps-flow-list">
                      {caseData.project.steps.map((st, idx) => (
                        <div key={idx} className={`step-flow-card ${st.status === 'Completed' ? 'completed' : ''}`}>
                          <div className="step-flow-left">
                            <span className="step-num-pill">{idx + 1}</span>
                            <div>
                              <span className="step-name-txt">{st.title}</span>
                              {st.description && <p className="step-desc-sub">{st.description}</p>}
                            </div>
                          </div>
                          <span className={`step-status-chip ${st.status === 'Completed' ? 'done' : 'pending'}`}>
                            {st.status === 'Completed' ? 'Completed' : st.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-subtext">No individual milestone steps logged for this project.</p>
                  )}
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: OVERDUE URGENCY, NEXT FOLLOWUP ON & FOLLOWUPS TIMELINE */}
            <div className="dash-col-right">

              {/* SECTION 4: DAYS ABOVE DUE DATE & URGENCY */}
              <div className="dash-card urgency-card">
                <div className="urgency-header">
                  <AlertTriangle size={16} color="#d97706" />
                  <h4>Days Above Due Date Status</h4>
                </div>
                
                <div className="urgency-body">
                  <div className="urgency-days-big">
                    <span className="days-number">{daysOverdue}</span>
                    <span className="days-label">Days Past Due Date</span>
                  </div>
                  
                  <div className="urgency-meta-row">
                    <span className="um-lbl">Agreed Due Date:</span>
                    <span className="um-val">{c.invoice_due_date ? new Date(c.invoice_due_date).toLocaleDateString('en-GB') : 'N/A'}</span>
                  </div>
                  
                  <div className="urgency-meta-row">
                    <span className="um-lbl">Severity Status:</span>
                    <span className="um-val font-bold">
                      {daysOverdue > 30 ? 'Critical Overdue (30+ Days)' : daysOverdue > 15 ? 'High Overdue (15-30 Days)' : 'Overdue'}
                    </span>
                  </div>

                  <div className="urgency-tone-guide">
                    <div className="utg-title">
                      <ShieldCheck size={13} color="#475569" /> Approach Guidance
                    </div>
                    <p className="utg-desc">
                      Category: <strong>{c.category}</strong>. Maintain <strong>{c.tone_guidance || 'Professional'}</strong> communication referencing Invoice #{c.invoice_number}.
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION 5: NEXT FOLLOW-UP ON ACTION CARD */}
              <div className="dash-card next-followup-action-card">
                <div className="dash-card-header">
                  <div className="dch-title-wrap">
                    <Calendar size={16} color="#0f172a" />
                    <div>
                      <h3 className="dch-title">Next Follow-up On</h3>
                      <span className="dch-subtitle">Scheduled recovery touchpoint</span>
                    </div>
                  </div>
                  <button 
                    className="btn-dash-action secondary"
                    onClick={() => {
                      setScheduleForm({
                        next_followup_date: effectiveNextFollowup ? new Date(effectiveNextFollowup).toISOString().slice(0, 16) : '',
                        notes: ''
                      });
                      setIsScheduleModalOpen(true);
                    }}
                  >
                    <Clock size={12} /> Set Date
                  </button>
                </div>

                <div className="next-followup-display-box">
                  <div className="nfd-date-main">
                    <Calendar size={18} color="#64748b" />
                    <div>
                      <div className="nfd-date-str">
                        {effectiveNextFollowup 
                          ? new Date(effectiveNextFollowup).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
                          : 'No Date Scheduled'}
                      </div>
                      <span className={`nfd-status-pill ${nextFollowupInfo.type}`}>
                        {nextFollowupInfo.text}
                      </span>
                    </div>
                  </div>

                  {c.last_followup_date && (
                    <div className="nfd-last-interaction">
                      <span className="lbl">Last Interaction:</span>
                      <span className="val">
                        {new Date(c.last_followup_date).toLocaleDateString('en-GB')} via {c.last_followup_method || 'Call'}
                      </span>
                      {c.last_followup_remark && (
                        <p className="last-remark">"{c.last_followup_remark}"</p>
                      )}
                    </div>
                  )}

                  <button className="btn-record-followup-primary" onClick={() => setIsFollowupOpen(true)}>
                    <MessageSquare size={14} /> + Record Follow-up
                  </button>
                </div>
              </div>

              {/* SECTION 6: FOLLOW-UPS TIMELINE */}
              <div className="dash-card">
                <div className="dash-card-header">
                  <div className="dch-title-wrap">
                    <History size={16} color="#0f172a" />
                    <div>
                      <h3 className="dch-title">Follow-ups Timeline</h3>
                      <span className="dch-subtitle">Discussion history</span>
                    </div>
                  </div>
                  <button className="btn-dash-action secondary" onClick={() => setIsFollowupOpen(true)}>
                    <MessageSquare size={12} /> + Add
                  </button>
                </div>

                <div className="followups-feed-list">
                  {caseData.followups && caseData.followups.length > 0 ? (
                    caseData.followups.map(f => (
                      <div key={f.id} className="followup-feed-card">
                        <div className="ffc-header">
                          <div className="ffc-method-wrap">
                            <span className="ffc-method-icon">
                              {f.method === 'WhatsApp' ? <MessageCircle size={13} color="#16a34a" /> : 
                               f.method === 'Email' ? <Mail size={13} color="#2563eb" /> : 
                               <Phone size={13} color="#475569" />}
                            </span>
                            <span className="ffc-method-name">{f.method}</span>
                          </div>
                          <span className="ffc-outcome-pill">
                            {f.outcome}
                          </span>
                        </div>

                        <p className="ffc-remark-text">"{f.remark}"</p>

                        {f.promised_amount && (
                          <div className="ffc-promise-banner">
                            <span>
                              Promised: <strong>PKR {Number(f.promised_amount).toLocaleString()}</strong>
                              {f.promised_date && ` on ${new Date(f.promised_date).toLocaleDateString('en-GB')}`}
                            </span>
                          </div>
                        )}

                        {f.next_followup_date && (
                          <div className="ffc-next-date-tag">
                            <Calendar size={12} /> Next: {new Date(f.next_followup_date).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        )}

                        <div className="ffc-footer">
                          <span>{f.user_name || 'Agent'}</span>
                          <span>{new Date(f.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-followup-state">
                      <p>No follow-ups recorded yet.</p>
                      <button className="btn-dash-action secondary" onClick={() => setIsFollowupOpen(true)}>
                        + Record First Follow-up
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 7: CLIENT DIRECT CONTACT & KEY CONTACTS */}
              <div className="dash-card">
                <div className="dash-card-header">
                  <div className="dch-title-wrap">
                    <User size={16} color="#0f172a" />
                    <div>
                      <h3 className="dch-title">Client Details & Contacts</h3>
                      <span className="dch-subtitle">Contact links</span>
                    </div>
                  </div>
                  <button className="btn-dash-action secondary" onClick={() => setIsContactOpen(true)}>
                    <UserPlus size={12} /> + Contact
                  </button>
                </div>

                <div className="client-info-stack">
                  <div className="cis-item">
                    <span className="cis-lbl">Client Name:</span>
                    <span className="cis-val font-bold">{c.client_name}</span>
                  </div>
                  {c.client_business_name && (
                    <div className="cis-item">
                      <span className="cis-lbl">Company:</span>
                      <span className="cis-val">{c.client_business_name}</span>
                    </div>
                  )}
                  {c.client_email && (
                    <div className="cis-item">
                      <span className="cis-lbl">Email:</span>
                      <a href={`mailto:${c.client_email}`} className="cis-link">{c.client_email}</a>
                    </div>
                  )}
                  {c.client_whatsapp && (
                    <div className="cis-item">
                      <span className="cis-lbl">Phone / WhatsApp:</span>
                      <div className="cis-phone-actions">
                        <span>{c.client_whatsapp}</span>
                        {whatsappUrl && (
                          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn-quick-wa">
                            <MessageCircle size={12} /> Chat
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                  {c.client_address && (
                    <div className="cis-item">
                      <span className="cis-lbl">Address:</span>
                      <span className="cis-val">{c.client_address}</span>
                    </div>
                  )}
                </div>

                {caseData.contacts && caseData.contacts.length > 0 && (
                  <div className="card-inner-section">
                    <h4 className="inner-section-heading">Additional Key Contacts</h4>
                    <div className="additional-contacts-list">
                      {caseData.contacts.map(ct => (
                        <div key={ct.id} className="act-contact-card">
                          <strong>{ct.contact_name}</strong>
                          <span className="act-role">{ct.role_designation || 'Staff'}</span>
                          {ct.phone && <span className="act-sub"><Phone size={11} /> {ct.phone}</span>}
                          {ct.email && <span className="act-sub"><Mail size={11} /> {ct.email}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: FOLLOW-UPS TIMELINE (FULL EXPANDED VIEW) */}
        {activeTab === 'followups' && (
          <div className="tab-panel">
            <div className="panel-section-header">
              <div>
                <h3>Follow-up History & Client Interactions</h3>
                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                  Chronological record for Case #{c.case_number}
                </p>
              </div>
              <button className="btn-master-action primary" onClick={() => setIsFollowupOpen(true)}>
                <MessageSquare size={14} /> + Record Follow-up
              </button>
            </div>

            <div className="followup-list">
              {caseData.followups && caseData.followups.length > 0 ? (
                caseData.followups.map(f => (
                  <div key={f.id} className="followup-item-card">
                    <div className="f-header">
                      <span className="f-method">{f.method} Interaction</span>
                      <span className="f-outcome">{f.outcome}</span>
                      <span className="f-date">{new Date(f.created_at).toLocaleString()}</span>
                    </div>
                    <p className="f-remark">"{f.remark}"</p>
                    {f.promised_amount && (
                      <div className="f-promised-box">
                        <span>Promised Amount: <strong>PKR {Number(f.promised_amount || 0).toLocaleString()}</strong></span>
                        {f.promised_date && <span>Promised Date: {new Date(f.promised_date).toLocaleDateString('en-GB')}</span>}
                      </div>
                    )}
                    {f.next_followup_date && (
                      <div style={{ marginTop: '6px', fontSize: '0.82rem', color: '#0f172a', fontWeight: '600' }}>
                        📅 Next follow-up scheduled: {new Date(f.next_followup_date).toLocaleString('en-GB')}
                      </div>
                    )}
                    <span className="f-user">Logged by: {f.user_name || 'Agent'}</span>
                  </div>
                ))
              ) : (
                <div className="empty-payment-state">
                  <p>No follow-ups recorded yet for this client.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: INVOICES & PAYMENT HISTORY */}
        {activeTab === 'financial' && (
          <div className="tab-panel">
            <div className="panel-section-header">
              <div>
                <h3>Financial Summary & Invoices</h3>
                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                  All invoices and payment records for {c.client_name}
                </p>
              </div>
              <button className="btn-master-action secondary" onClick={() => handleOpenInvoiceModal(c.invoice_id)}>
                <FileText size={14} /> View Case Invoice
              </button>
            </div>

            <div className="fin-summary-cards">
              <div className="fin-summary-box">
                <span className="lbl">Case Invoice Total</span>
                <span className="val">PKR {Number(c.invoice_amount || 0).toLocaleString()}</span>
              </div>
              <div className="fin-summary-box">
                <span className="lbl">Total Recovered</span>
                <span className="val">PKR {Number(c.recovered_amount || 0).toLocaleString()}</span>
              </div>
              <div className="fin-summary-box">
                <span className="lbl">Outstanding Balance</span>
                <span className="val danger">PKR {Number(c.outstanding_amount || 0).toLocaleString()}</span>
              </div>
              <div className="fin-summary-box">
                <span className="lbl">Client Lifetime Debt</span>
                <span className="val danger">PKR {Number(caseData.client_stats?.total_outstanding || c.outstanding_amount).toLocaleString()}</span>
              </div>
            </div>

            {/* 1. Payment Received History */}
            <div style={{ marginTop: '1.25rem' }}>
              <h4 style={{ color: '#0f172a', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
                <DollarSign size={16} /> Payment Received History
              </h4>
              {caseData.financial?.payment_history && caseData.financial.payment_history.length > 0 ? (
                <div className="table-responsive">
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Payment Date</th>
                        <th>Invoice #</th>
                        <th>Payment Method</th>
                        <th>Bank / Ref</th>
                        <th>Notes</th>
                        <th style={{ textAlign: 'right' }}>Amount Paid (PKR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {caseData.financial.payment_history.map((p, idx) => (
                        <tr key={idx}>
                          <td><strong>{p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-GB') : 'N/A'}</strong></td>
                          <td>{p.invoice_number || c.invoice_number}</td>
                          <td><span className="method-pill">{p.payment_method || 'Received'}</span></td>
                          <td>{p.bank || p.transaction_id || '-'}</td>
                          <td>{p.notes || p.description || '-'}</td>
                          <td style={{ textAlign: 'right', fontWeight: '700', color: '#16a34a' }}>
                            + PKR {Number(p.amount || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-subtext">No payment transactions recorded for this invoice yet.</p>
              )}
            </div>

            {/* 2. All Client Invoices */}
            <div style={{ marginTop: '1.5rem' }}>
              <h4 style={{ color: '#0f172a', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
                <FileText size={16} /> All Client Invoices
              </h4>
              {caseData.financial?.all_invoices && caseData.financial.all_invoices.length > 0 ? (
                <div className="table-responsive">
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Issue Date</th>
                        <th>Due Date</th>
                        <th style={{ textAlign: 'right' }}>Total Amount</th>
                        <th style={{ textAlign: 'right' }}>Paid Amount</th>
                        <th style={{ textAlign: 'right' }}>Balance Due</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {caseData.financial.all_invoices.map((inv) => {
                        const isCurrentCaseInv = inv.id === c.invoice_id;
                        return (
                          <tr key={inv.id} style={{ background: isCurrentCaseInv ? '#f8fafc' : '#ffffff' }}>
                            <td>
                              <strong>{inv.invoice_number}</strong>
                              {isCurrentCaseInv && (
                                <span style={{ marginLeft: '6px', fontSize: '0.7rem', background: '#0f172a', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>
                                  CASE
                                </span>
                              )}
                            </td>
                            <td>{inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('en-GB') : '-'}</td>
                            <td>{inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB') : '-'}</td>
                            <td style={{ textAlign: 'right', fontWeight: '600' }}>PKR {Number(inv.amount || 0).toLocaleString()}</td>
                            <td style={{ textAlign: 'right', fontWeight: '600' }}>PKR {Number(inv.paid_amount || (inv.amount - inv.balance) || 0).toLocaleString()}</td>
                            <td style={{ textAlign: 'right', color: inv.balance > 0 ? '#dc2626' : '#64748b' }}>
                              <strong>PKR {Number(inv.balance || 0).toLocaleString()}</strong>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="status-badge status-active">{inv.status}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button 
                                className="btn-dash-action secondary" 
                                style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                onClick={() => handleOpenInvoiceModal(inv.id)}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-subtext">No other invoices found for this client.</p>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: PROJECT & DELIVERABLES */}
        {activeTab === 'project' && (
          <div className="tab-panel">
            <div className="panel-section-header">
              <div>
                <h3>Project & Deliverables Overview</h3>
                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                  Milestones and deliverables for {c.client_name}
                </p>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h4 style={{ margin: 0, color: '#0f172a', fontWeight: '700' }}>
                  {c.project_title || 'Direct Billing Account'}
                </h4>
                <span className="status-badge status-active">{c.project_status || 'Active'}</span>
              </div>
              <p style={{ color: '#475569', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                {c.project_description || 'No detailed description recorded.'}
              </p>

              <div className="pd-progress-box">
                <div className="pd-progress-header">
                  <span>Milestone Completion</span>
                  <strong>{totalProjectSteps > 0 ? `${completedProjectSteps} of ${totalProjectSteps} Steps (${projectPct}%)` : 'Active'}</strong>
                </div>
                <div className="kpi-progress-bar-wrap">
                  <div className="kpi-progress-bar info" style={{ width: `${projectPct}%` }} />
                </div>
              </div>
            </div>

            <h4 style={{ color: '#0f172a', marginBottom: '0.75rem', fontWeight: '700' }}>Milestones</h4>
            {caseData.project?.steps && caseData.project.steps.length > 0 ? (
              <div className="steps-flow-list">
                {caseData.project.steps.map((st, idx) => (
                  <div key={idx} className={`step-flow-card ${st.status === 'Completed' ? 'completed' : ''}`}>
                    <div className="step-flow-left">
                      <span className="step-num-pill">{idx + 1}</span>
                      <div>
                        <span className="step-name-txt">{st.title}</span>
                        {st.description && <p className="step-desc-sub">{st.description}</p>}
                      </div>
                    </div>
                    <span className="step-status-chip">
                      {st.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-subtext">No individual milestone steps logged for this project.</p>
            )}
          </div>
        )}

        {/* TAB 5: CLIENT PROFILE & KEY CONTACTS */}
        {activeTab === 'client' && (
          <div className="tab-panel">
            <div className="panel-section-header">
              <h3>Client Account & Key Contacts</h3>
              <button className="btn-master-action secondary" onClick={() => setIsContactOpen(true)}>
                <UserPlus size={14} /> + Add Contact
              </button>
            </div>

            <div className="contact-grid">
              <div className="contact-card">
                <h4>Primary Client Details</h4>
                <div className="info-row"><User size={14} /> <span>{c.client_name}</span></div>
                {c.client_business_name && <div className="info-row"><Layers size={14} /> <span>{c.client_business_name}</span></div>}
                <div className="info-row"><Mail size={14} /> <a href={`mailto:${c.client_email}`}>{c.client_email}</a></div>
                <div className="info-row"><Phone size={14} /> <span>{c.client_whatsapp || 'N/A'}</span></div>
                {c.client_address && <div className="info-row"><MapPin size={14} /> <span>{c.client_address}</span></div>}
              </div>

              <div className="contact-card">
                <h4>Assigned Staff</h4>
                <div className="info-row"><UserCheck size={14} /> <span>Assigned Agent: <strong>{c.salesperson_name}</strong></span></div>
                {c.original_salesperson_name && <div className="info-row"><User size={14} /> <span>Original Owner: {c.original_salesperson_name}</span></div>}
                {c.creator_name && <div className="info-row"><Clock size={14} /> <span>Created By: {c.creator_name}</span></div>}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: INTERNAL ESCALATIONS & NOTES */}
        {activeTab === 'escalation' && (
          <div className="tab-panel">
            <div className="panel-section-header">
              <h3>Internal Notes & Escalation</h3>
              <button className="btn-master-action secondary" onClick={() => setIsEscalateOpen(true)}>
                <AlertCircle size={14} /> Escalate Case
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
              <p style={{ margin: '0 0 6px 0' }}><strong>Trigger Reason:</strong> {c.manager_reason || 'N/A'}</p>
              <p style={{ margin: '0' }}><strong>Internal Remark:</strong> {c.manager_remark || 'None recorded.'}</p>
              {c.escalation_level !== 'None' && (
                <div style={{ marginTop: '0.75rem', padding: '8px 12px', background: '#f1f5f9', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <strong>Escalation Level: {c.escalation_level}</strong>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem' }}>{c.escalation_reason || 'No specific note recorded.'}</p>
                </div>
              )}
            </div>

            <h4 style={{ color: '#0f172a', marginBottom: '0.75rem', fontWeight: '700' }}>Timeline Events</h4>
            <div className="timeline-feed">
              {caseData.timeline && caseData.timeline.length > 0 ? (
                caseData.timeline.map(t => (
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
                ))
              ) : (
                <p className="empty-subtext">No audit timeline events logged.</p>
              )}
            </div>
          </div>
        )}

      </div>

      {/* MODAL 1: VIEW FULL INVOICE PREVIEW */}
      {isInvoiceModalOpen && previewInvoice && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content custom-modal invoice-view-modal" style={{ maxWidth: '880px', width: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="modal-header-custom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="#0f172a" />
                <h3 style={{ margin: 0 }}>Invoice #{previewInvoice.invoice_number}</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  className="btn-print-invoice"
                  onClick={() => window.print()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '6px', background: '#0f172a', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem' }}
                >
                  <Printer size={14} /> Print / Save PDF
                </button>
                <button className="modal-close-btn" onClick={() => setIsInvoiceModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="modal-body-custom invoice-printable-area" style={{ padding: '1rem', background: '#ffffff' }}>
              <InvoiceTemplate invoice={previewInvoice} />
            </div>

            <div className="modal-footer-custom">
              <button type="button" className="btn-cancel" onClick={() => setIsInvoiceModalOpen(false)}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: RECORD FOLLOW-UP */}
      {isFollowupOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content custom-modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header-custom">
              <h3><MessageSquare size={17} /> Record Follow-up for {c.case_number}</h3>
              <button className="modal-close-btn" onClick={() => setIsFollowupOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleFollowupSubmit} className="modal-body-custom">
              <div className="form-row-2">
                <div className="form-group-custom">
                  <label className="required">Contact Method</label>
                  <select 
                    value={followupForm.method} 
                    onChange={(e) => setFollowupForm({ ...followupForm, method: e.target.value })}
                  >
                    <option value="Call">Phone Call</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Email">Email</option>
                    <option value="Meeting">Meeting</option>
                  </select>
                </div>
                <div className="form-group-custom">
                  <label className="required">Outcome</label>
                  <select 
                    value={followupForm.outcome} 
                    onChange={(e) => setFollowupForm({ ...followupForm, outcome: e.target.value })}
                  >
                    <option value="Payment Promised">Payment Promised</option>
                    <option value="Payment Received">Payment Received</option>
                    <option value="Partial Payment">Partial Payment</option>
                    <option value="No Response">No Response / Unreachable</option>
                    <option value="Extension">Extension Requested</option>
                    <option value="Dispute">Invoice Dispute</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group-custom">
                <label className="required">Discussion Remarks</label>
                <textarea 
                  rows={3} 
                  value={followupForm.remark} 
                  onChange={(e) => setFollowupForm({ ...followupForm, remark: e.target.value })} 
                  placeholder="Detail the discussion..."
                  required 
                />
              </div>

              {followupForm.outcome === 'Payment Promised' && (
                <div className="form-row-2" style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div className="form-group-custom">
                    <label className="required">Promised Amount (PKR)</label>
                    <input 
                      type="number" 
                      value={followupForm.promised_amount} 
                      onChange={(e) => setFollowupForm({ ...followupForm, promised_amount: e.target.value })} 
                      placeholder="e.g. 50000"
                      required 
                    />
                  </div>
                  <div className="form-group-custom">
                    <label className="required">Promised Date</label>
                    <input 
                      type="date" 
                      value={followupForm.promised_date} 
                      onChange={(e) => setFollowupForm({ ...followupForm, promised_date: e.target.value })} 
                      required 
                    />
                  </div>
                </div>
              )}

              <div className="form-group-custom">
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                  <Calendar size={14} /> Schedule Next Follow-up Date & Time
                </label>
                <input 
                  type="datetime-local" 
                  value={followupForm.next_followup_date} 
                  onChange={(e) => setFollowupForm({ ...followupForm, next_followup_date: e.target.value })} 
                />
              </div>

              <div className="modal-footer-custom">
                <button type="button" className="btn-cancel" onClick={() => setIsFollowupOpen(false)}>Cancel</button>
                <button type="submit" className="btn-submit">Save Follow-up</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: QUICK SCHEDULE NEXT FOLLOW-UP */}
      {isScheduleModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content custom-modal" style={{ maxWidth: '460px' }}>
            <div className="modal-header-custom">
              <h3><Calendar size={17} /> Set Next Follow-up</h3>
              <button className="modal-close-btn" onClick={() => setIsScheduleModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleScheduleSubmit} className="modal-body-custom">
              <div className="form-group-custom">
                <label className="required">Next Follow-up Date & Time</label>
                <input 
                  type="datetime-local" 
                  value={scheduleForm.next_followup_date} 
                  onChange={(e) => setScheduleForm({ ...scheduleForm, next_followup_date: e.target.value })} 
                  required 
                />
              </div>

              <div className="form-group-custom">
                <label>Notes (Optional)</label>
                <textarea 
                  rows={2} 
                  value={scheduleForm.notes} 
                  onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })} 
                  placeholder="e.g. Call client CFO to verify payment transfer slip..."
                />
              </div>

              <div className="modal-footer-custom">
                <button type="button" className="btn-cancel" onClick={() => setIsScheduleModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-submit">Update Date</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: REASSIGN */}
      {isReassignOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content custom-modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header-custom">
              <h3><UserPlus size={17} /> Reassign Case</h3>
              <button className="modal-close-btn" onClick={() => setIsReassignOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleReassignSubmit} className="modal-body-custom">
              <div className="form-group-custom">
                <label className="required">Select Salesperson</label>
                <select 
                  value={reassignForm.new_salesperson_id} 
                  onChange={(e) => setReassignForm({ ...reassignForm, new_salesperson_id: e.target.value })} 
                  required
                >
                  <option value="">-- Choose Salesperson --</option>
                  {salespeople.map(sp => (
                    <option key={sp.id} value={sp.id}>{sp.name} ({sp.email})</option>
                  ))}
                </select>
              </div>

              <div className="form-group-custom">
                <label className="required">Reason</label>
                <textarea 
                  rows={3} 
                  value={reassignForm.reason} 
                  onChange={(e) => setReassignForm({ ...reassignForm, reason: e.target.value })} 
                  placeholder="Reason for reassignment..."
                  required 
                />
              </div>

              <div className="modal-footer-custom">
                <button type="button" className="btn-cancel" onClick={() => setIsReassignOpen(false)}>Cancel</button>
                <button type="submit" className="btn-submit">Reassign</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: ESCALATE */}
      {isEscalateOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content custom-modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header-custom">
              <h3><AlertCircle size={17} /> Escalate Recovery Case</h3>
              <button className="modal-close-btn" onClick={() => setIsEscalateOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleEscalateSubmit} className="modal-body-custom">
              <div className="form-group-custom">
                <label className="required">Escalation Level</label>
                <select 
                  value={escalateForm.escalation_level} 
                  onChange={(e) => setEscalateForm({ ...escalateForm, escalation_level: e.target.value })}
                >
                  <option value="Sales Manager">Sales Manager</option>
                  <option value="Finance Head">Finance Head</option>
                  <option value="Legal Notice">Legal Notice</option>
                </select>
              </div>

              <div className="form-group-custom">
                <label className="required">Reason</label>
                <textarea 
                  rows={3} 
                  value={escalateForm.reason} 
                  onChange={(e) => setEscalateForm({ ...escalateForm, reason: e.target.value })} 
                  placeholder="Reason for escalation..."
                  required 
                />
              </div>

              <div className="modal-footer-custom">
                <button type="button" className="btn-cancel" onClick={() => setIsEscalateOpen(false)}>Cancel</button>
                <button type="submit" className="btn-submit">Submit Escalation</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: ADD CONTACT */}
      {isContactOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content custom-modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header-custom">
              <h3><UserPlus size={17} /> Add Key Contact</h3>
              <button className="modal-close-btn" onClick={() => setIsContactOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleContactSubmit} className="modal-body-custom">
              <div className="form-group-custom">
                <label className="required">Contact Name</label>
                <input 
                  type="text" 
                  value={contactForm.contact_name} 
                  onChange={(e) => setContactForm({ ...contactForm, contact_name: e.target.value })} 
                  required 
                />
              </div>
              <div className="form-group-custom">
                <label>Role / Designation</label>
                <input 
                  type="text" 
                  placeholder="e.g. Accounts Manager" 
                  value={contactForm.role_designation} 
                  onChange={(e) => setContactForm({ ...contactForm, role_designation: e.target.value })} 
                />
              </div>
              <div className="form-row-2">
                <div className="form-group-custom">
                  <label>Phone / WhatsApp</label>
                  <input 
                    type="text" 
                    value={contactForm.phone} 
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} 
                  />
                </div>
                <div className="form-group-custom">
                  <label>Email</label>
                  <input 
                    type="email" 
                    value={contactForm.email} 
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} 
                  />
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
