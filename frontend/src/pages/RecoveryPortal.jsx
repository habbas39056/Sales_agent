import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ShieldAlert, Search, Filter, RefreshCw, Plus, Clock, DollarSign, 
  CheckCircle2, AlertTriangle, User, Calendar, MessageSquare, ArrowUpDown, 
  ExternalLink, PhoneCall, Send, ShieldCheck, UserCheck, Check, ChevronRight, X, Trash2, Eye, FolderPlus, Tag
} from 'lucide-react';
import Pagination from '../components/Pagination';
import './RecoveryPortal.css';
import '../pages/Modal.css';

export default function RecoveryPortal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState({
    total_assigned: 0,
    total_recovered: 0,
    total_outstanding: 0,
    active_cases: 0,
    followup_today: 0,
    overdue_cases: 0,
    payment_promised: 0
  });

  const [loading, setLoading] = useState(true);
  const [salespeople, setSalespeople] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [projects, setProjects] = useState([]);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [salespersonFilter, setSalespersonFilter] = useState('All');
  const [followupTab, setFollowupTab] = useState('pending'); // 'pending' | 'recorded' | 'all'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Modals
  const [isTriggerModalOpen, setIsTriggerModalOpen] = useState(false);
  const [isFollowupModalOpen, setIsFollowupModalOpen] = useState(false);
  const [isViewFollowupModalOpen, setIsViewFollowupModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);

  // Custom Categories State
  const [categories, setCategories] = useState([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#4f46e5');

  // Trigger Form State
  const [triggerForm, setTriggerForm] = useState({
    invoice_id: '',
    project_id: '',
    manager_reason: '',
    manager_remark: '',
    assigned_salesperson_id: ''
  });

  // Follow-up Form State
  const [followupForm, setFollowupForm] = useState({
    method: 'Call',
    outcome: 'Payment Promised',
    remark: '',
    promised_amount: '',
    promised_date: '',
    next_followup_date: '',
    attachment_url: ''
  });

  const getFollowupDateStatusInfo = (dateStr) => {
    if (!dateStr) {
      return {
        text: 'Pending',
        color: '#be123c',
        bgColor: '#ffe4e6',
        borderColor: '#fecdd3'
      };
    }

    const followupDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const compDate = new Date(followupDate);
    compDate.setHours(0, 0, 0, 0);

    const formattedDate = followupDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

    if (compDate > today) {
      return {
        text: formattedDate,
        color: '#047857',
        bgColor: '#ecfdf5',
        borderColor: '#a7f3d0'
      };
    } else if (compDate.getTime() === today.getTime()) {
      return {
        text: `Today (${formattedDate})`,
        color: '#be123c',
        bgColor: '#ffe4e6',
        borderColor: '#fecdd3'
      };
    } else {
      return {
        text: `Overdue (${formattedDate})`,
        color: '#be123c',
        bgColor: '#ffe4e6',
        borderColor: '#fecdd3'
      };
    }
  };

  // Reassign Form State
  const [reassignForm, setReassignForm] = useState({
    new_salesperson_id: '',
    reason: ''
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchCases();
  }, [categoryFilter, statusFilter, salespersonFilter]);

  const fetchInitialData = async () => {
    try {
      const [spRes, invRes, projRes] = await Promise.all([
        axios.get('/api/users'),
        axios.get('/api/invoices'),
        axios.get('/api/projects')
      ]);

      const staff = (spRes.data || []).filter(u => u.role !== 'Client');
      setSalespeople(staff);
      setInvoices(invRes.data || []);
      setProjects(projRes.data || []);
      fetchCategories();
    } catch (err) {
      console.error('Failed to load metadata:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get('/api/recovery/categories');
      setCategories(res.data || []);
    } catch (err) {
      console.error('Failed to fetch recovery categories:', err);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await axios.post('/api/recovery/categories', { name: newCatName.trim(), color: newCatColor });
      setNewCatName('');
      fetchCategories();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add category');
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm('Are you sure you want to delete this custom category?')) return;
    try {
      await axios.delete(`/api/recovery/categories/${catId}`);
      fetchCategories();
    } catch (err) {
      alert('Failed to delete category');
    }
  };

  const fetchCases = async () => {
    setLoading(true);
    try {
      const userStr = localStorage.getItem('user');
      const u = userStr ? JSON.parse(userStr) : null;

      let spFilter = salespersonFilter;
      if (u && u.role === 'Sales') {
        spFilter = u.id.toString();
      }

      const params = new URLSearchParams();
      if (categoryFilter !== 'All') params.append('category', categoryFilter);
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (spFilter !== 'All') params.append('salesperson_id', spFilter);

      const [casesRes, statsRes] = await Promise.all([
        axios.get(`/api/recovery?${params.toString()}`),
        axios.get(`/api/recovery/stats?${params.toString()}`)
      ]);

      setCases(casesRes.data?.cases || []);
      setStats(statsRes.data || {});
    } catch (err) {
      console.error('Failed to fetch recovery cases:', err);
    } finally {
      setLoading(false);
    }
  };

  const pendingCasesCount = useMemo(() => cases.filter(c => !c.last_followup_date).length, [cases]);
  const recordedCasesCount = useMemo(() => cases.filter(c => c.last_followup_date).length, [cases]);

  const activeCaseInvoiceIds = useMemo(() => {
    return new Set(cases.filter(c => c.is_active && c.status !== 'Closed' && c.status !== 'Recovered').map(c => c.invoice_id));
  }, [cases]);

  // Client-side search & follow-up status filtering
  const filteredCases = useMemo(() => {
    let list = cases;
    if (followupTab === 'pending') {
      list = list.filter(c => !c.last_followup_date);
    } else if (followupTab === 'recorded') {
      list = list.filter(c => Boolean(c.last_followup_date));
    }

    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(c => 
      (c.case_number && c.case_number.toLowerCase().includes(term)) ||
      (c.client_name && c.client_name.toLowerCase().includes(term)) ||
      (c.client_business_name && c.client_business_name.toLowerCase().includes(term)) ||
      (c.invoice_number && c.invoice_number.toLowerCase().includes(term)) ||
      (c.project_title && c.project_title.toLowerCase().includes(term)) ||
      (c.salesperson_name && c.salesperson_name.toLowerCase().includes(term))
    );
  }, [cases, followupTab, searchTerm]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);
  const currentCases = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCases.slice(start, start + itemsPerPage);
  }, [filteredCases, currentPage]);

  const handleManualTrigger = async (e) => {
    e.preventDefault();
    if (!triggerForm.invoice_id) {
      alert('Please select an invoice');
      return;
    }
    try {
      const userStr = localStorage.getItem('user');
      const u = userStr ? JSON.parse(userStr) : null;
      await axios.post('/api/recovery/manual-trigger', {
        ...triggerForm,
        user_id: u?.id
      });
      alert('Recovery case created successfully!');
      setIsTriggerModalOpen(false);
      setTriggerForm({ invoice_id: '', project_id: '', manager_reason: '', manager_remark: '', assigned_salesperson_id: '' });
      fetchCases();
    } catch (err) {
      console.error('Failed to trigger recovery:', err);
      alert(err.response?.data?.error || 'Failed to trigger recovery case');
    }
  };

  const handleFollowupSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCase) return;
    try {
      const userStr = localStorage.getItem('user');
      const u = userStr ? JSON.parse(userStr) : null;
      await axios.post(`/api/recovery/${selectedCase.id}/followups`, {
        ...followupForm,
        user_id: u?.id
      });
      alert('Follow-up recorded successfully!');
      setIsFollowupModalOpen(false);
      setFollowupForm({ method: 'Call', outcome: 'Payment Promised', remark: '', promised_amount: '', promised_date: '', next_followup_date: '', attachment_url: '' });
      fetchCases();
    } catch (err) {
      console.error('Failed to record follow-up:', err);
      alert(err.response?.data?.error || 'Failed to record follow-up');
    }
  };

  const handleReassignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCase || !reassignForm.new_salesperson_id) return;
    try {
      const userStr = localStorage.getItem('user');
      const u = userStr ? JSON.parse(userStr) : null;
      await axios.put(`/api/recovery/${selectedCase.id}/reassign`, {
        ...reassignForm,
        user_id: u?.id
      });
      alert('Case reassigned successfully!');
      setIsReassignModalOpen(false);
      setReassignForm({ new_salesperson_id: '', reason: '' });
      fetchCases();
    } catch (err) {
      console.error('Failed to reassign case:', err);
      alert(err.response?.data?.error || 'Failed to reassign case');
    }
  };

  const getCategoryBadgeClass = (cat) => {
    switch (cat) {
      case 'Contact Required': return 'badge-contact-req';
      case 'Normal Follow-up': return 'badge-normal';
      case 'Payment Promised': return 'badge-promised';
      case 'Promise Missed': return 'badge-missed';
      case 'Repeated Delay': return 'badge-delay';
      case 'No Response': return 'badge-no-resp';
      case 'Dispute': return 'badge-dispute';
      case 'High-Value Recovery': return 'badge-high-value';
      case 'Management Escalation': return 'badge-escalation';
      default: return 'badge-default';
    }
  };

  return (
    <div className="recovery-portal-container">
      {/* 1. Header Toolbar */}
      <div className="recovery-page-header">
        <div>
          <h1 className="page-title">
            <ShieldAlert size={26} color="#e11d48" /> ERP Recovery Module
          </h1>
          <p className="page-subtitle">
            Centralized overdue-payment recovery, amount-based prioritization, follow-up categorization, and verified payment closure.
          </p>
        </div>
        <div className="header-action-buttons">
          <button className="btn-secondary" onClick={fetchCases}>
            <RefreshCw size={16} /> Refresh Queue
          </button>
          <button 
            type="button" 
            className="btn-primary" 
            style={{ background: '#4f46e5', color: '#ffffff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => setIsCategoryModalOpen(true)}
          >
            <FolderPlus size={16} /> Custom Categories
          </button>
        </div>
      </div>

      {/* 2. Executive KPI Cards (7 Core Metrics) */}
      <div className="recovery-kpi-grid">
        <div className="rec-kpi-card purple">
          <div className="rec-kpi-top">
            <span>Total Assigned</span>
            <DollarSign size={18} />
          </div>
          <div className="rec-kpi-val">PKR {stats.total_assigned?.toLocaleString()}</div>
          <span className="rec-kpi-sub">Total recovery balance</span>
        </div>

        <div className="rec-kpi-card green">
          <div className="rec-kpi-top">
            <span>Total Recovered</span>
            <CheckCircle2 size={18} />
          </div>
          <div className="rec-kpi-val">PKR {stats.total_recovered?.toLocaleString()}</div>
          <span className="rec-kpi-sub">Verified payments closed</span>
        </div>

        <div className="rec-kpi-card orange">
          <div className="rec-kpi-top">
            <span>Total Outstanding</span>
            <Clock size={18} />
          </div>
          <div className="rec-kpi-val">PKR {stats.total_outstanding?.toLocaleString()}</div>
          <span className="rec-kpi-sub">Pending collection balance</span>
        </div>

        <div className="rec-kpi-card blue">
          <div className="rec-kpi-top">
            <span>Active Cases</span>
            <ShieldCheck size={18} />
          </div>
          <div className="rec-kpi-val">{stats.active_cases}</div>
          <span className="rec-kpi-sub">Open recovery queue</span>
        </div>

        <div className="rec-kpi-card cyan">
          <div className="rec-kpi-top">
            <span>Follow-up Today</span>
            <Calendar size={18} />
          </div>
          <div className="rec-kpi-val">{stats.followup_today}</div>
          <span className="rec-kpi-sub">Requires action today</span>
        </div>

        <div className="rec-kpi-card red">
          <div className="rec-kpi-top">
            <span>Overdue / Missed</span>
            <AlertTriangle size={18} />
          </div>
          <div className="rec-kpi-val">{stats.overdue_cases}</div>
          <span className="rec-kpi-sub">Promise missed cases</span>
        </div>

        <div className="rec-kpi-card emerald">
          <div className="rec-kpi-top">
            <span>Payment Promised</span>
            <UserCheck size={18} />
          </div>
          <div className="rec-kpi-val">{stats.payment_promised}</div>
          <span className="rec-kpi-sub">Committed payment dates</span>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="rec-filter-card">
        <div className="rec-search-box">
          <Search size={18} className="search-icn" />
          <input 
            type="text" 
            placeholder="Search by client name, invoice #, case ID, project..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="rec-filters-group">
          <div className="filter-item">
            <label>Category:</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="All">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-item">
            <label>Salesperson:</label>
            <select value={salespersonFilter} onChange={(e) => setSalespersonFilter(e.target.value)}>
              <option value="All">All Salespersons</option>
              {salespeople.map(sp => (
                <option key={sp.id} value={sp.id}>{sp.name}</option>
              ))}
            </select>
          </div>

          <button className="btn-reset-filters" onClick={() => {
            setSearchTerm('');
            setCategoryFilter('All');
            setStatusFilter('All');
            setSalespersonFilter('All');
            setFollowupTab('pending');
            setCurrentPage(1);
          }}>
            Reset
          </button>
        </div>
      </div>

      {/* 4. Priority-Sorted Cases Table */}
      <div className="rec-table-card">
        <div className="table-header-info" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <span className="table-title">Recovery Queue (Sorted by Outstanding Amount - Highest First)</span>
          </div>

          {/* Follow-up Status Tabs */}
          <div style={{ display: 'flex', gap: '0.35rem', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => { setFollowupTab('pending'); setCurrentPage(1); }}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: 'pointer',
                background: followupTab === 'pending' ? '#ef4444' : 'transparent',
                color: followupTab === 'pending' ? '#ffffff' : '#64748b',
                transition: 'all 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>⏳ Record Pending</span>
              <span style={{
                background: followupTab === 'pending' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                color: followupTab === 'pending' ? '#ffffff' : '#475569',
                padding: '1px 7px',
                borderRadius: '10px',
                fontSize: '0.72rem'
              }}>
                {pendingCasesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setFollowupTab('recorded'); setCurrentPage(1); }}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: 'pointer',
                background: followupTab === 'recorded' ? '#10b981' : 'transparent',
                color: followupTab === 'recorded' ? '#ffffff' : '#64748b',
                transition: 'all 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>✅ Follow-up Logged</span>
              <span style={{
                background: followupTab === 'recorded' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                color: followupTab === 'recorded' ? '#ffffff' : '#475569',
                padding: '1px 7px',
                borderRadius: '10px',
                fontSize: '0.72rem'
              }}>
                {recordedCasesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setFollowupTab('all'); setCurrentPage(1); }}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: 'pointer',
                background: followupTab === 'all' ? '#4f46e5' : 'transparent',
                color: followupTab === 'all' ? '#ffffff' : '#64748b',
                transition: 'all 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>All ({cases.length})</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rec-loading-state">
            <RefreshCw className="spin" size={32} />
            <p>Loading recovery queue...</p>
          </div>
        ) : currentCases.length === 0 ? (
          <div className="rec-empty-state">
            <ShieldCheck size={48} color="#10b981" />
            <h3>No Active Recovery Cases Found</h3>
            <p>There are no overdue accounts matching your filter criteria.</p>
          </div>
        ) : (
          <div className="rec-table-wrap">
            <table className="rec-data-table">
              <thead>
                <tr>
                  <th>CASE & INVOICE</th>
                  <th>CLIENT / BUSINESS</th>
                  <th>PROJECT</th>
                  <th style={{ textAlign: 'right' }}>OUTSTANDING (PKR)</th>
                  <th style={{ textAlign: 'center' }}>DAYS OVERDUE</th>
                  <th>CATEGORY & APPROACH TONE</th>
                  <th>NEXT FOLLOW-UP</th>
                  <th>ASSIGNED SALESPERSON</th>
                  <th style={{ textAlign: 'center' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {currentCases.map(c => {
                  const isHighVal = Number(c.outstanding_amount) >= 100000;
                  return (
                    <tr key={c.id} className="rec-table-row" onClick={() => navigate(c.client_id ? `/clients/${c.client_id}` : `/recovery/${c.id}`)}>
                      {/* Case & Invoice */}
                      <td>
                        <div className="case-id-block">
                          <span className="case-num-text">{c.case_number}</span>
                          <span className="inv-num-sub">{c.invoice_number}</span>
                        </div>
                      </td>

                      {/* Client */}
                      <td>
                        <div className="client-identity">
                          <span className="client-name-txt">{c.client_name}</span>
                          {c.client_business_name && <span className="biz-sub-txt">{c.client_business_name}</span>}
                        </div>
                      </td>

                      {/* Project */}
                      <td>
                        <span className="proj-title-txt">{c.project_title || 'Direct Billing'}</span>
                      </td>

                      {/* Outstanding Amount (Highest Priority) */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="amount-cell">
                          <span className="amt-primary">PKR {Number(c.outstanding_amount).toLocaleString()}</span>
                          {isHighVal && <span className="high-val-tag">HIGH VALUE</span>}
                        </div>
                      </td>

                      {/* Days Overdue */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`days-overdue-chip ${c.days_overdue > 30 ? 'critical' : c.days_overdue > 15 ? 'warning' : ''}`}>
                          {c.days_overdue || 0}d overdue
                        </span>
                      </td>

                      {/* Category & Tone */}
                      <td>
                        <div className="cat-tone-block">
                          <span className={`category-chip ${getCategoryBadgeClass(c.category)}`}>
                            {c.category}
                          </span>
                          <span className="tone-guide-txt">{c.tone_guidance || 'Professional'}</span>
                        </div>
                      </td>

                      {/* Next Followup */}
                      <td>
                        {(() => {
                          const info = getFollowupDateStatusInfo(c.next_followup_date);
                          return (
                            <span style={{
                              background: info.bgColor,
                              color: info.color,
                              border: `1px solid ${info.borderColor}`,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '10px',
                              fontSize: '0.72rem',
                              fontWeight: '700',
                              whiteSpace: 'nowrap',
                              display: 'inline-block'
                            }}>
                              {info.text}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Salesperson */}
                      <td>
                        <div className="salesperson-identity">
                          <User size={13} />
                          <span>{c.salesperson_name}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <div className="row-actions">
                          {c.last_followup_date ? (
                            <button 
                              className="btn-action view-details" 
                              title="View Saved Follow-up Details"
                              style={{ background: '#e0e7ff', color: '#4f46e5', border: 'none', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCase(c);
                                setIsViewFollowupModalOpen(true);
                              }}
                            >
                              <Eye size={14} />
                            </button>
                          ) : (
                            <button 
                              className="btn-action followup" 
                              title="Record Follow-up"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCase(c);
                                setIsFollowupModalOpen(true);
                              }}
                            >
                              <MessageSquare size={14} />
                            </button>
                          )}
                          <button 
                            className="btn-action delete" 
                            title="Delete Recovery Case"
                            style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer' }}
                            onClick={(e) => handleDeleteCase(e, c)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(page)}
          />
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: MANUAL TRIGGER RECOVERY CASE */}
      {/* ========================================================================= */}
      {isTriggerModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content custom-modal" style={{ maxWidth: '580px' }}>
            <div className="modal-header-custom">
              <h3><ShieldAlert size={20} color="#e11d48" /> Send Invoice / Project to Recovery</h3>
              <button className="modal-close-btn" onClick={() => setIsTriggerModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleManualTrigger} className="modal-body-custom">
              <div className="form-group-custom">
                <label className="required">Select Overdue Invoice</label>
                <select 
                  value={triggerForm.invoice_id} 
                  onChange={(e) => {
                    const invId = e.target.value;
                    const selectedInv = invoices.find(i => i.id.toString() === invId);
                    setTriggerForm({
                      ...triggerForm,
                      invoice_id: invId,
                      project_id: selectedInv?.project_id || ''
                    });
                  }}
                  required
                >
                  <option value="">-- Choose Invoice --</option>
                  {invoices.map(inv => {
                    const hasActiveCase = activeCaseInvoiceIds.has(inv.id);
                    return (
                      <option key={inv.id} value={inv.id} disabled={hasActiveCase}>
                        {inv.invoice_number} - {inv.client_name || 'Client'} (Bal: PKR {Number(inv.balance || inv.amount).toLocaleString()}){hasActiveCase ? ' — [Active Case Exists]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group-custom">
                <label>Assigned Salesperson (Defaults to Client Owner)</label>
                <select 
                  value={triggerForm.assigned_salesperson_id}
                  onChange={(e) => setTriggerForm({ ...triggerForm, assigned_salesperson_id: e.target.value })}
                >
                  <option value="">-- Default Client Salesperson --</option>
                  {salespeople.map(sp => (
                    <option key={sp.id} value={sp.id}>{sp.name} ({sp.role})</option>
                  ))}
                </select>
              </div>

              <div className="form-group-custom">
                <label className="required">Reason for Recovery Attention</label>
                <input 
                  type="text" 
                  placeholder="e.g. Client unresponsive after final deliverable, promise missed twice..."
                  value={triggerForm.manager_reason}
                  onChange={(e) => setTriggerForm({ ...triggerForm, manager_reason: e.target.value })}
                  required
                />
              </div>

              <div className="form-group-custom">
                <label>Internal Remark & Strategy</label>
                <textarea 
                  rows={3}
                  placeholder="Add guidance for salesperson regarding project history, hold status..."
                  value={triggerForm.manager_remark}
                  onChange={(e) => setTriggerForm({ ...triggerForm, manager_remark: e.target.value })}
                />
              </div>

              <div className="modal-footer-custom">
                <button type="button" className="btn-cancel" onClick={() => setIsTriggerModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-submit-danger">Confirm & Send Case</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: RECORD FOLLOW-UP ENTRY FORM */}
      {/* ========================================================================= */}
      {isFollowupModalOpen && selectedCase && (
        <div className="modal-overlay">
          <div className="modal-content custom-modal" style={{ maxWidth: '620px' }}>
            <div className="modal-header-custom">
              <h3><MessageSquare size={20} color="#2563eb" /> Record Follow-up for {selectedCase.case_number}</h3>
              <button className="modal-close-btn" onClick={() => setIsFollowupModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleFollowupSubmit} className="modal-body-custom">
              <div className="form-row-2">
                <div className="form-group-custom">
                  <label className="required">Contact Method</label>
                  <select 
                    value={followupForm.method} 
                    onChange={(e) => setFollowupForm({ ...followupForm, method: e.target.value })}
                  >
                    <option value="Call">Call</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Email">Email</option>
                    <option value="Meeting">Meeting</option>
                  </select>
                </div>

                <div className="form-group-custom">
                  <label className="required">Interaction Outcome</label>
                  <select 
                    value={followupForm.outcome} 
                    onChange={(e) => setFollowupForm({ ...followupForm, outcome: e.target.value })}
                  >
                    <option value="Payment Promised">Payment Promised</option>
                    <option value="Payment Received">Payment Received</option>
                    <option value="Partial Payment">Partial Payment</option>
                    <option value="No Response">No Response</option>
                    <option value="Extension">Extension Requested</option>
                    <option value="Dispute">Dispute Raised</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group-custom">
                <label className="required">Client Remark / Discussion Summary</label>
                <textarea 
                  rows={3}
                  placeholder="What did the client say or what happened during contact?"
                  value={followupForm.remark}
                  onChange={(e) => setFollowupForm({ ...followupForm, remark: e.target.value })}
                  required
                />
              </div>

              {followupForm.outcome === 'Payment Promised' && (
                <div className="form-row-2">
                  <div className="form-group-custom">
                    <label className="required">Promised Amount (PKR)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 75000"
                      value={followupForm.promised_amount}
                      onChange={(e) => setFollowupForm({ ...followupForm, promised_amount: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group-custom">
                    <label className="required">Promised Payment Date</label>
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
                <label>Next Scheduled Follow-up Date/Time</label>
                <input 
                  type="datetime-local" 
                  value={followupForm.next_followup_date}
                  onChange={(e) => setFollowupForm({ ...followupForm, next_followup_date: e.target.value })}
                />
              </div>

              <div className="modal-footer-custom">
                <button type="button" className="btn-cancel" onClick={() => setIsFollowupModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-submit">Save Follow-up Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Saved Follow-up Details Modal */}
      {isViewFollowupModalOpen && selectedCase && (
        <div className="modal-overlay" onClick={() => setIsViewFollowupModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px', width: '90%', background: '#ffffff', color: '#0f172a', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #e2e8f0', padding: '1rem 1.25rem', background: '#ffffff', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Eye size={20} color="#4f46e5" />
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem', fontWeight: '700' }}>Saved Follow-up Details ({selectedCase.case_number})</h3>
              </div>
              <button onClick={() => setIsViewFollowupModalOpen(false)} className="modal-close-btn" style={{ color: '#64748b' }}>&times;</button>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', background: '#ffffff' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Client / Business</div>
                  <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{selectedCase.client_name} {selectedCase.client_business_name ? `(${selectedCase.client_business_name})` : ''}</strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Assigned Salesperson</div>
                  <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{selectedCase.salesperson_name}</strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Interaction Outcome</label>
                  <span style={{ fontWeight: '700', color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', display: 'inline-block' }}>
                    {selectedCase.category || 'Payment Promised'}
                  </span>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Last Follow-up Date</label>
                  <span style={{ fontWeight: '600', color: '#334155', fontSize: '0.85rem' }}>
                    {selectedCase.last_followup_date ? new Date(selectedCase.last_followup_date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                  </span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: '#475569', fontWeight: '700', display: 'block', marginBottom: '6px' }}>💬 Client Remark / What Client Said (Discussion Summary)</label>
                <div style={{ background: '#fffef0', border: '1px solid #fef08a', padding: '0.85rem', borderRadius: '8px', fontSize: '0.9rem', color: '#854d0e', whiteSpace: 'pre-wrap', minHeight: '65px', lineHeight: '1.4' }}>
                  {selectedCase.last_followup_remark || selectedCase.manager_remark || 'No remark recorded.'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>Promised Amount</label>
                  <strong style={{ color: '#047857', fontSize: '1rem' }}>
                    {selectedCase.promised_amount ? `PKR ${Number(selectedCase.promised_amount).toLocaleString()}` : 'N/A'}
                  </strong>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>Promised Payment Date</label>
                  <strong style={{ color: '#047857', fontSize: '0.9rem' }}>
                    {selectedCase.promised_date ? new Date(selectedCase.promised_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                  </strong>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>Next Scheduled Follow-up Date/Time</label>
                <div style={{ fontWeight: '700', color: '#2563eb', fontSize: '0.9rem' }}>
                  {selectedCase.next_followup_date ? new Date(selectedCase.next_followup_date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not scheduled'}
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '1rem 1.25rem', borderTop: '1px solid #e2e8f0', background: '#ffffff', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
              <button type="button" className="btn-secondary" onClick={() => setIsViewFollowupModalOpen(false)} style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '6px 20px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Categories Management Modal */}
      {isCategoryModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCategoryModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px', width: '90%', background: '#ffffff', color: '#0f172a', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #e2e8f0', padding: '1rem 1.25rem', background: '#ffffff', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FolderPlus size={20} color="#4f46e5" />
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem', fontWeight: '700' }}>Manage Custom Categories</h3>
              </div>
              <button onClick={() => setIsCategoryModalOpen(false)} className="modal-close-btn" style={{ color: '#64748b' }}>&times;</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.25rem', background: '#ffffff' }}>
              {/* Form to Add Category */}
              <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <input 
                  type="text"
                  placeholder="Enter new category name..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  style={{ flex: 1, padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  required
                />
                <input 
                  type="color"
                  value={newCatColor}
                  onChange={(e) => setNewCatColor(e.target.value)}
                  style={{ width: '40px', height: '36px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                  title="Pick Badge Color"
                />
                <button type="submit" style={{ background: '#4f46e5', color: '#ffffff', border: 'none', padding: '0.55rem 1rem', borderRadius: '6px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                  <Plus size={14} /> Add Category
                </button>
              </form>

              {/* List of Active Categories */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '8px' }}>Active Recovery Categories ({categories.length})</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto', padding: '4px' }}>
                  {categories.map(cat => (
                    <div 
                      key={cat.id} 
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        background: '#f1f5f9', 
                        border: '1px solid #e2e8f0', 
                        padding: '4px 10px', 
                        borderRadius: '20px', 
                        fontSize: '0.82rem', 
                        fontWeight: '600', 
                        color: '#334155' 
                      }}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cat.color || '#4f46e5' }} />
                      <span>{cat.name}</span>
                      <button 
                        type="button" 
                        onClick={() => handleDeleteCategory(cat.id)} 
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, marginLeft: '2px', display: 'inline-flex', alignItems: 'center' }}
                        title="Delete Category"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '1rem 1.25rem', borderTop: '1px solid #e2e8f0', background: '#ffffff', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
              <button type="button" className="btn-secondary" onClick={() => setIsCategoryModalOpen(false)} style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '6px 20px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
