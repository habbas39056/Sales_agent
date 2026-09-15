import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Target, 
  Plus, 
  Search, 
  Filter, 
  RefreshCw, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Phone, 
  Mail, 
  Building, 
  User, 
  Calendar, 
  MessageSquare, 
  Edit3, 
  Trash2, 
  UserPlus, 
  Columns, 
  List, 
  ArrowRight,
  ChevronRight,
  Send,
  Sparkles,
  Tag,
  Check,
  Settings as SettingsIcon,
  Palette
} from 'lucide-react';
import './LeadsManagement.css';

const DEFAULT_STAGES = [
  { id: 'New Lead', name: 'New Lead', color: '#3b82f6', bg: '#eff6ff' },
  { id: 'Contacted', name: 'Contacted', color: '#8b5cf6', bg: '#f5f3ff' },
  { id: 'Qualified', name: 'Qualified', color: '#06b6d4', bg: '#ecfeff' },
  { id: 'Proposal Sent', name: 'Proposal Sent', color: '#f59e0b', bg: '#fffbeb' },
  { id: 'Negotiation', name: 'Negotiation', color: '#ec4899', bg: '#fdf2f8' },
  { id: 'Won', name: 'Won (Client)', color: '#10b981', bg: '#ecfdf5' },
  { id: 'Lost', name: 'Lost', color: '#64748b', bg: '#f8fafc' }
];

const DEFAULT_SOURCES = ['Website', 'Referral', 'Social Media', 'Cold Call', 'WhatsApp', 'Direct', 'Other'];

const COLOR_OPTIONS = [
  { color: '#3b82f6', bg: '#eff6ff' },
  { color: '#8b5cf6', bg: '#f5f3ff' },
  { color: '#06b6d4', bg: '#ecfeff' },
  { color: '#f59e0b', bg: '#fffbeb' },
  { color: '#ec4899', bg: '#fdf2f8' },
  { color: '#10b981', bg: '#ecfdf5' },
  { color: '#64748b', bg: '#f8fafc' },
  { color: '#6366f1', bg: '#eef2ff' },
  { color: '#f97316', bg: '#fff7ed' }
];

export default function LeadsManagement() {
  const [leads, setLeads] = useState([]);
  const [summary, setSummary] = useState({
    total_leads: 0,
    total_pipeline_value: 0,
    active_count: 0,
    won_count: 0,
    won_value: 0,
    followups_due: 0
  });

  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);

  // Editable Pipeline Stages & Sources
  const [stages, setStages] = useState(DEFAULT_STAGES);
  const [sources, setSources] = useState(DEFAULT_SOURCES);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('board'); // 'board' (Kanban) or 'table'

  // Filters State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [assignedFilter, setAssignedFilter] = useState('All');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);

  // Settings Modal State (Edit Stages & Sources)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsActiveTab, setSettingsActiveTab] = useState('stages'); // 'stages' or 'sources'
  const [newStageName, setNewStageName] = useState('');
  const [newStageColorIndex, setNewStageColorIndex] = useState(0);
  const [newSourceName, setNewSourceName] = useState('');

  // Activity Drawer State
  const [activeLeadDetails, setActiveLeadDetails] = useState(null);
  const [leadActivities, setLeadActivities] = useState([]);
  const [activityNote, setActivityNote] = useState('');
  const [activityType, setActivityType] = useState('Note');
  const [nextFollowupInActivity, setNextFollowupInActivity] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    contact_name: '',
    company_name: '',
    email: '',
    phone: '',
    whatsapp_number: '',
    source: 'Website',
    status: 'New Lead',
    estimated_value: '',
    category_id: '',
    assigned_to: '',
    next_followup_date: '',
    notes: ''
  });

  // Alert State
  const [alert, setAlert] = useState({ type: '', message: '' });

  useEffect(() => {
    loadLeads();
    loadDropdowns();
  }, [statusFilter, sourceFilter, assignedFilter]);

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert({ type: '', message: '' }), 4000);
  };

  const loadLeads = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'All') params.status = statusFilter;
      if (sourceFilter !== 'All') params.source = sourceFilter;
      if (assignedFilter !== 'All') params.assigned_to = assignedFilter;

      const res = await axios.get('/api/leads', { params });
      setLeads(res.data.leads || []);
      setSummary(res.data.summary || {});
    } catch (err) {
      showAlert('error', 'Failed to fetch leads.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadDropdowns = async () => {
    try {
      const [catRes, usersRes, settingsRes] = await Promise.all([
        axios.get('/api/project-categories'),
        axios.get('/api/users'),
        axios.get('/api/settings')
      ]);
      setCategories(catRes.data || []);
      setUsers(usersRes.data || []);

      const settings = settingsRes.data || {};
      if (settings.lead_sources) {
        try {
          const parsed = JSON.parse(settings.lead_sources);
          if (Array.isArray(parsed) && parsed.length > 0) setSources(parsed);
        } catch (e) {}
      }
      if (settings.lead_stages) {
        try {
          const parsed = JSON.parse(settings.lead_stages);
          if (Array.isArray(parsed) && parsed.length > 0) setStages(parsed);
        } catch (e) {}
      }
    } catch (err) {
      console.warn('Failed to load dropdown metadata:', err);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadLeads();
  };

  const openCreateModal = () => {
    setEditingLead(null);
    const defaultSrc = sources.length > 0 ? sources[0] : 'Website';
    const defaultStg = stages.length > 0 ? stages[0].id : 'New Lead';
    setFormData({
      title: '',
      contact_name: '',
      company_name: '',
      email: '',
      phone: '',
      whatsapp_number: '',
      source: defaultSrc,
      status: defaultStg,
      estimated_value: '',
      category_id: '',
      assigned_to: '',
      next_followup_date: '',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (lead) => {
    setEditingLead(lead);
    const phoneVal = lead.phone || lead.whatsapp_number || '';
    setFormData({
      title: lead.title || '',
      contact_name: lead.contact_name || '',
      company_name: lead.company_name || '',
      email: lead.email || '',
      phone: phoneVal,
      whatsapp_number: phoneVal,
      source: lead.source || (sources[0] || 'Website'),
      status: lead.status || (stages[0]?.id || 'New Lead'),
      estimated_value: lead.estimated_value || '',
      category_id: lead.category_id || '',
      assigned_to: lead.assigned_to || '',
      next_followup_date: lead.next_followup_date ? lead.next_followup_date.substring(0, 16) : '',
      notes: lead.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleSaveLead = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.contact_name.trim()) {
      return showAlert('error', 'Please fill in Lead Title and Contact Name.');
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        whatsapp_number: formData.phone // Single phone & whatsapp field
      };

      if (editingLead) {
        await axios.put(`/api/leads/${editingLead.id}`, payload);
        showAlert('success', 'Lead updated successfully!');
      } else {
        await axios.post('/api/leads', payload);
        showAlert('success', 'New lead created successfully!');
      }
      setIsModalOpen(false);
      loadLeads();
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatusChange = async (leadId, newStatus) => {
    try {
      await axios.put(`/api/leads/${leadId}`, { status: newStatus });
      showAlert('success', `Lead stage updated to "${newStatus}"`);
      loadLeads();
    } catch (err) {
      showAlert('error', 'Failed to update lead stage');
    }
  };

  const handleDeleteLead = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete lead "${title}"?`)) return;
    try {
      await axios.delete(`/api/leads/${id}`);
      showAlert('success', 'Lead deleted successfully!');
      if (activeLeadDetails?.id === id) setActiveLeadDetails(null);
      loadLeads();
    } catch (err) {
      showAlert('error', 'Failed to delete lead');
    }
  };

  const handleConvertLeadToClient = async (leadId) => {
    if (!window.confirm('Convert this lead into an official Client? This will create a Client record and mark lead as Won.')) return;
    try {
      const res = await axios.post(`/api/leads/${leadId}/convert`);
      showAlert('success', res.data.message || 'Lead converted to Client!');
      loadLeads();
      if (activeLeadDetails?.id === leadId) openLeadActivities(leadId);
    } catch (err) {
      showAlert('error', err.response?.data?.error || 'Failed to convert lead');
    }
  };

  const openLeadActivities = async (leadId) => {
    try {
      const res = await axios.get(`/api/leads/${leadId}`);
      setActiveLeadDetails(res.data.lead);
      setLeadActivities(res.data.activities || []);
      setActivityNote('');
      setNextFollowupInActivity('');
    } catch (err) {
      showAlert('error', 'Failed to load lead activity log');
    }
  };

  const handleAddActivity = async (e) => {
    e.preventDefault();
    if (!activityNote.trim()) return;

    try {
      await axios.post(`/api/leads/${activeLeadDetails.id}/activities`, {
        type: activityType,
        summary: activityNote
      });

      // Update follow up date if set (silent: true prevents duplicate lead update note)
      if (nextFollowupInActivity) {
        await axios.put(`/api/leads/${activeLeadDetails.id}`, {
          next_followup_date: nextFollowupInActivity,
          silent: true
        });
      }

      setActivityNote('');
      setNextFollowupInActivity('');
      showAlert('success', 'Activity logged!');
      openLeadActivities(activeLeadDetails.id);
      loadLeads();
    } catch (err) {
      showAlert('error', 'Failed to add activity log');
    }
  };

  // --- Dynamic Settings Handlers (Stages & Sources) ---
  const handleAddStage = () => {
    if (!newStageName.trim()) return;
    const nameStr = newStageName.trim();
    if (stages.some(s => s.name.toLowerCase() === nameStr.toLowerCase())) {
      return showAlert('error', 'A stage with this name already exists.');
    }
    const colorObj = COLOR_OPTIONS[newStageColorIndex] || COLOR_OPTIONS[0];
    const updated = [...stages, { id: nameStr, name: nameStr, color: colorObj.color, bg: colorObj.bg }];
    setStages(updated);
    setNewStageName('');
  };

  const handleDeleteStage = (stageId) => {
    if (stages.length <= 1) return showAlert('error', 'Must have at least one pipeline stage.');
    const updated = stages.filter(s => s.id !== stageId);
    setStages(updated);
  };

  const handleAddSource = () => {
    if (!newSourceName.trim()) return;
    const nameStr = newSourceName.trim();
    if (sources.includes(nameStr)) {
      return showAlert('error', 'This lead source already exists.');
    }
    setSources([...sources, nameStr]);
    setNewSourceName('');
  };

  const handleDeleteSource = (sourceName) => {
    if (sources.length <= 1) return showAlert('error', 'Must have at least one lead source.');
    setSources(sources.filter(s => s !== sourceName));
  };

  const handleSavePipelineSettings = async () => {
    setSaving(true);
    try {
      await axios.post('/api/settings', {
        lead_sources: JSON.stringify(sources),
        lead_stages: JSON.stringify(stages)
      });
      showAlert('success', 'Pipeline stages & sources updated successfully!');
      setIsSettingsModalOpen(false);
      loadLeads();
    } catch (err) {
      showAlert('error', 'Failed to save pipeline settings');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return 'PKR ' + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  return (
    <div className="leads-page-container">
      {/* Toast Alert */}
      {alert.message && (
        <div className={`toast-banner ${alert.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {alert.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{alert.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="leads-page-header">
        <div className="header-title-box">
          <div className="header-icon-wrapper">
            <Target size={24} />
          </div>
          <div>
            <h2>Sales & Leads Management</h2>
            <p>Track, qualify, and nurture sales prospects through your conversion pipeline.</p>
          </div>
        </div>

        <div className="header-actions">
          <button className="btn-secondary" onClick={() => setIsSettingsModalOpen(true)}>
            <SettingsIcon size={16} /> Manage Pipeline Settings
          </button>
          <button className="btn-secondary" onClick={loadLeads} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin-icon' : ''} /> Refresh
          </button>
          <button className="btn-primary" onClick={openCreateModal}>
            <Plus size={18} /> Create New Lead
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="leads-stats-grid">
        <div className="kpi-card">
          <div className="kpi-icon-box bg-blue">
            <Target size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Total Leads</span>
            <h3 className="kpi-value">{summary.total_leads || 0}</h3>
            <span className="kpi-subtext">Pipeline: <strong>{formatCurrency(summary.total_pipeline_value)}</strong></span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box bg-purple">
            <TrendingUp size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Active Opportunities</span>
            <h3 className="kpi-value">{summary.active_count || 0}</h3>
            <span className="kpi-subtext">In-progress pipeline</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box bg-emerald">
            <Sparkles size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Won Conversions</span>
            <h3 className="kpi-value">{summary.won_count || 0}</h3>
            <span className="kpi-subtext">Revenue: <strong>{formatCurrency(summary.won_value)}</strong></span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box bg-amber">
            <Clock size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Actionable Follow-ups</span>
            <h3 className="kpi-value">{summary.followups_due || 0}</h3>
            <span className="kpi-subtext text-amber">Due today or overdue</span>
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="leads-toolbar">
        <form onSubmit={handleSearchSubmit} className="search-form">
          <div className="search-input-wrapper">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Search leads by title, contact, company, email, phone..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </form>

        <div className="filter-group">
          <div className="filter-item">
            <label>Stage:</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">All Stages</option>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="filter-item">
            <label>Source:</label>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
              <option value="All">All Sources</option>
              {sources.map(src => <option key={src} value={src}>{src}</option>)}
            </select>
          </div>

          <div className="filter-item">
            <label>Sales Rep:</label>
            <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)}>
              <option value="All">All Reps</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          <div className="view-toggle-box">
            <button 
              className={`toggle-btn ${viewMode === 'board' ? 'active' : ''}`} 
              onClick={() => setViewMode('board')}
              title="Pipeline Board View"
            >
              <Columns size={16} /> Board
            </button>
            <button 
              className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`} 
              onClick={() => setViewMode('table')}
              title="Data Table View"
            >
              <List size={16} /> List
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="loading-container">
          <RefreshCw size={36} className="spin-icon" />
          <p>Loading Sales Leads...</p>
        </div>
      ) : leads.length === 0 ? (
        <div className="empty-state-card">
          <Target size={48} />
          <h3>No Sales Leads Found</h3>
          <p>Get started by adding your first lead or adjust your filter options.</p>
          <button className="btn-primary" onClick={openCreateModal} style={{ marginTop: '1rem' }}>
            <Plus size={16} /> Create Lead
          </button>
        </div>
      ) : viewMode === 'board' ? (
        /* KANBAN BOARD VIEW */
        <div className="kanban-pipeline-grid">
          {stages.map(stage => {
            const stageLeads = leads.filter(l => l.status === stage.id);
            const totalStageValue = stageLeads.reduce((acc, curr) => acc + Number(curr.estimated_value || 0), 0);

            return (
              <div key={stage.id} className="kanban-column" style={{ borderColor: stage.color }}>
                <div className="kanban-column-header" style={{ backgroundColor: stage.bg || '#f8fafc' }}>
                  <div className="header-left">
                    <span className="stage-dot" style={{ backgroundColor: stage.color }} />
                    <span className="stage-title">{stage.name}</span>
                    <span className="stage-count">{stageLeads.length}</span>
                  </div>
                  <span className="stage-value">{formatCurrency(totalStageValue)}</span>
                </div>

                <div className="kanban-cards-container">
                  {stageLeads.length === 0 ? (
                    <div className="empty-column-placeholder">
                      <span>No leads</span>
                    </div>
                  ) : (
                    stageLeads.map(lead => (
                      <div key={lead.id} className="lead-card" onClick={() => openLeadActivities(lead.id)}>
                        <div className="lead-card-top">
                          <span className="lead-number">{lead.lead_number || `#${lead.id}`}</span>
                          <span className="lead-source-tag"><Tag size={12} /> {lead.source}</span>
                        </div>

                        <h4 className="lead-title">{lead.title}</h4>

                        <div className="lead-contact-info">
                          <span className="contact-name"><User size={13} /> {lead.contact_name}</span>
                          {lead.company_name && (
                            <span className="company-name"><Building size={13} /> {lead.company_name}</span>
                          )}
                          {(lead.phone || lead.whatsapp_number) && (
                            <span className="company-name"><Phone size={13} /> {lead.phone || lead.whatsapp_number}</span>
                          )}
                        </div>

                        <div className="lead-card-meta">
                          <span className="deal-value">{formatCurrency(lead.estimated_value)}</span>
                        </div>

                        {lead.next_followup_date && (
                          <div className="followup-alert-row">
                            <Clock size={12} />
                            <span>Follow up: {new Date(lead.next_followup_date).toLocaleDateString()}</span>
                          </div>
                        )}

                        <div className="lead-card-footer" onClick={(e) => e.stopPropagation()}>
                          <div className="assigned-user">
                            {lead.assigned_avatar ? (
                              <img src={lead.assigned_avatar} alt={lead.assigned_name} className="user-avatar" />
                            ) : (
                              <div className="user-initials">
                                {lead.assigned_name ? lead.assigned_name.charAt(0).toUpperCase() : '?'}
                              </div>
                            )}
                            <span className="user-name">{lead.assigned_name || 'Unassigned'}</span>
                          </div>

                          <div className="card-actions">
                            {lead.status !== 'Won' && (
                              <button 
                                className="action-btn text-emerald" 
                                title="Convert to Client"
                                onClick={() => handleConvertLeadToClient(lead.id)}
                              >
                                <UserPlus size={14} />
                              </button>
                            )}
                            <button 
                              className="action-btn" 
                              title="Edit Lead" 
                              onClick={() => openEditModal(lead)}
                            >
                              <Edit3 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE LIST VIEW */
        <div className="table-responsive-card">
          <table className="leads-table">
            <thead>
              <tr>
                <th>Lead Info</th>
                <th>Contact & Phone/WhatsApp</th>
                <th>Source & Category</th>
                <th>Est. Value</th>
                <th>Pipeline Stage</th>
                <th>Next Follow-up</th>
                <th>Assigned Rep</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => {
                const matchedStage = stages.find(s => s.id === lead.status) || { color: '#3b82f6', bg: '#eff6ff' };
                return (
                  <tr 
                    key={lead.id}
                    className="stage-colored-row"
                    style={{
                      backgroundColor: matchedStage.bg || '#ffffff',
                      borderLeft: `5px solid ${matchedStage.color || '#cbd5e1'}`
                    }}
                  >
                    <td>
                      <div className="lead-cell-title">
                        <strong onClick={() => openLeadActivities(lead.id)} className="clickable-lead">
                          {lead.title}
                        </strong>
                        <span className="lead-number-sub">{lead.lead_number || `#${lead.id}`}</span>
                      </div>
                    </td>

                    <td>
                      <div className="contact-cell">
                        <span><strong>{lead.contact_name}</strong></span>
                        {lead.company_name && <span className="text-sub"><Building size={12} /> {lead.company_name}</span>}
                        {(lead.phone || lead.whatsapp_number) && <span className="text-sub"><Phone size={12} /> {lead.phone || lead.whatsapp_number}</span>}
                        {lead.email && <span className="text-sub"><Mail size={12} /> {lead.email}</span>}
                      </div>
                    </td>

                    <td>
                      <div className="source-cell">
                        <span className="source-pill">{lead.source}</span>
                        {lead.category_name && <span className="cat-pill">{lead.category_name}</span>}
                      </div>
                    </td>

                    <td>
                      <strong className="deal-value-text">{formatCurrency(lead.estimated_value)}</strong>
                    </td>

                    <td>
                      <select 
                        className="stage-select-dropdown"
                        style={{
                          color: matchedStage.color,
                          borderColor: matchedStage.color,
                          backgroundColor: '#ffffff',
                          fontWeight: 700
                        }}
                        value={lead.status}
                        onChange={(e) => handleQuickStatusChange(lead.id, e.target.value)}
                      >
                        {stages.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </td>

                  <td>
                    {lead.next_followup_date ? (
                      <span className="followup-cell">
                        <Calendar size={13} /> {new Date(lead.next_followup_date).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>

                  <td>
                    <div className="assigned-cell">
                      <span className="rep-name">{lead.assigned_name || 'Unassigned'}</span>
                    </div>
                  </td>

                  <td style={{ textAlign: 'right' }}>
                    <div className="table-actions">
                      <button 
                        className="btn-icon" 
                        title="View Activities & Notes"
                        onClick={() => openLeadActivities(lead.id)}
                      >
                        <MessageSquare size={16} />
                      </button>
                      {lead.status !== 'Won' && (
                        <button 
                          className="btn-icon text-emerald" 
                          title="Convert to Client"
                          onClick={() => handleConvertLeadToClient(lead.id)}
                        >
                          <UserPlus size={16} />
                        </button>
                      )}
                      <button 
                        className="btn-icon" 
                        title="Edit Lead"
                        onClick={() => openEditModal(lead)}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        className="btn-icon text-red" 
                        title="Delete Lead"
                        onClick={() => handleDeleteLead(lead.id, lead.title)}
                      >
                        <Trash2 size={16} />
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

      {/* CREATE / EDIT LEAD MODAL */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content-card">
            <div className="modal-header">
              <h3>{editingLead ? 'Edit Sales Lead' : 'Create New Sales Lead'}</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>

            <form onSubmit={handleSaveLead}>
              <div className="modal-body-grid">
                <div className="form-group span-2">
                  <label>Lead Title / Opportunity Name *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Website Redesign & SEO Package" 
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Contact Name *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. John Doe" 
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Company / Business Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Acme Corp" 
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  />
                </div>

                <div className="form-group span-2">
                  <label>Phone / WhatsApp Number</label>
                  <input 
                    type="text" 
                    placeholder="e.g. +92 300 1234567" 
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value, whatsapp_number: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    placeholder="e.g. john@acme.com" 
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Lead Source</label>
                  <select 
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  >
                    {sources.map(src => <option key={src} value={src}>{src}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Estimated Value (PKR)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="e.g. 50000" 
                    value={formData.estimated_value}
                    onChange={(e) => setFormData({ ...formData, estimated_value: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Project Category</label>
                  <select 
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Pipeline Stage</label>
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Assigned Sales Rep</label>
                  <select 
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                  </select>
                </div>

                <div className="form-group span-2">
                  <label>Next Follow-up Date & Time</label>
                  <input 
                    type="datetime-local" 
                    value={formData.next_followup_date}
                    onChange={(e) => setFormData({ ...formData, next_followup_date: e.target.value })}
                  />
                </div>

                <div className="form-group span-2">
                  <label>Initial Notes / Requirement Details</label>
                  <textarea 
                    rows="3" 
                    placeholder="Enter detailed notes regarding client requirements, budget, or scope..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingLead ? 'Update Lead' : 'Create Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PIPELINE STAGES & SOURCES SETTINGS MODAL */}
      {isSettingsModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content-card">
            <div className="modal-header">
              <h3><SettingsIcon size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Customize Pipeline & Sources</h3>
              <button className="close-btn" onClick={() => setIsSettingsModalOpen(false)}>&times;</button>
            </div>

            <div className="pipeline-settings-tabs">
              <button 
                type="button"
                className={`tab-btn ${settingsActiveTab === 'stages' ? 'active' : ''}`}
                onClick={() => setSettingsActiveTab('stages')}
              >
                Pipeline Stages ({stages.length})
              </button>
              <button 
                type="button"
                className={`tab-btn ${settingsActiveTab === 'sources' ? 'active' : ''}`}
                onClick={() => setSettingsActiveTab('sources')}
              >
                Lead Sources ({sources.length})
              </button>
            </div>

            <div className="pipeline-settings-body">
              {settingsActiveTab === 'stages' ? (
                <div>
                  <p className="settings-hint">Add, rename, or remove pipeline stages for your lead Kanban board.</p>
                  
                  {/* Add Stage Form */}
                  <div className="add-item-bar">
                    <input 
                      type="text"
                      placeholder="Enter new stage name (e.g. Discovery Call)..."
                      value={newStageName}
                      onChange={(e) => setNewStageName(e.target.value)}
                    />
                    <div className="color-picker-row">
                      {COLOR_OPTIONS.map((c, idx) => (
                        <div 
                          key={idx}
                          className={`color-dot ${newStageColorIndex === idx ? 'selected' : ''}`}
                          style={{ backgroundColor: c.color }}
                          onClick={() => setNewStageColorIndex(idx)}
                        />
                      ))}
                    </div>
                    <button type="button" className="btn-primary" onClick={handleAddStage}>
                      <Plus size={16} /> Add Stage
                    </button>
                  </div>

                  {/* Existing Stages List */}
                  <div className="settings-items-list">
                    {stages.map((stg, idx) => (
                      <div key={stg.id} className="settings-item-row">
                        <span className="stage-badge-preview" style={{ backgroundColor: stg.bg, color: stg.color, border: `1px solid ${stg.color}` }}>
                          <span className="dot" style={{ backgroundColor: stg.color }} /> {stg.name}
                        </span>
                        <input 
                          type="text" 
                          value={stg.name} 
                          onChange={(e) => {
                            const val = e.target.value;
                            setStages(stages.map((s, i) => i === idx ? { ...s, name: val, id: val } : s));
                          }}
                          className="stage-rename-input"
                        />
                        <button 
                          type="button" 
                          className="btn-icon text-red" 
                          onClick={() => handleDeleteStage(stg.id)}
                          title="Delete Stage"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="settings-hint">Add or remove lead acquisition sources (e.g. WhatsApp, Facebook Ads, Referral).</p>
                  
                  {/* Add Source Form */}
                  <div className="add-item-bar">
                    <input 
                      type="text"
                      placeholder="Enter new lead source (e.g. Instagram Ads)..."
                      value={newSourceName}
                      onChange={(e) => setNewSourceName(e.target.value)}
                    />
                    <button type="button" className="btn-primary" onClick={handleAddSource}>
                      <Plus size={16} /> Add Source
                    </button>
                  </div>

                  {/* Existing Sources List */}
                  <div className="settings-items-list">
                    {sources.map((src, idx) => (
                      <div key={idx} className="settings-item-row">
                        <span className="source-pill-preview">{src}</span>
                        <input 
                          type="text" 
                          value={src} 
                          onChange={(e) => {
                            const val = e.target.value;
                            setSources(sources.map((s, i) => i === idx ? val : s));
                          }}
                          className="stage-rename-input"
                        />
                        <button 
                          type="button" 
                          className="btn-icon text-red" 
                          onClick={() => handleDeleteSource(src)}
                          title="Delete Source"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setIsSettingsModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleSavePipelineSettings} disabled={saving}>
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEAD ACTIVITY & TIMELINE DRAWER */}
      {activeLeadDetails && (
        <div className="modal-backdrop">
          <div className="activity-drawer-card">
            <div className="modal-header">
              <div>
                <h3>{activeLeadDetails.title}</h3>
                <span className="lead-subtitle">
                  {activeLeadDetails.lead_number || `#${activeLeadDetails.id}`} | Contact: <strong>{activeLeadDetails.contact_name}</strong>
                </span>
              </div>
              <button className="close-btn" onClick={() => setActiveLeadDetails(null)}>&times;</button>
            </div>

            <div className="drawer-body">
              {/* Lead Summary Header inside Drawer */}
              <div className="drawer-summary-bar">
                <div className="summary-item">
                  <span>Value:</span> <strong>{formatCurrency(activeLeadDetails.estimated_value)}</strong>
                </div>
                <div className="summary-item">
                  <span>Stage:</span> <strong className="text-primary">{activeLeadDetails.status}</strong>
                </div>
                <div className="summary-item">
                  <span>Source:</span> <strong>{activeLeadDetails.source}</strong>
                </div>
                {activeLeadDetails.status !== 'Won' && (
                  <button 
                    className="btn-convert-small" 
                    onClick={() => handleConvertLeadToClient(activeLeadDetails.id)}
                  >
                    <UserPlus size={14} /> Convert to Client
                  </button>
                )}
              </div>

              {/* Log Activity Form */}
              <form onSubmit={handleAddActivity} className="add-activity-form">
                <h4>Log Activity / Follow-up Note</h4>
                <div className="activity-inputs-grid">
                  <select 
                    value={activityType} 
                    onChange={(e) => setActivityType(e.target.value)}
                    className="activity-type-select"
                  >
                    <option value="Note">📝 General Note</option>
                    <option value="Call">📞 Phone Call / WhatsApp</option>
                    <option value="Email">✉️ Email Sent</option>
                    <option value="Meeting">🤝 Meeting</option>
                    <option value="Proposal">📄 Proposal Sent</option>
                    <option value="Follow-up">⏰ Follow-up Scheduled</option>
                  </select>

                  <input 
                    type="datetime-local" 
                    className="followup-input"
                    title="Set Next Follow-up Date (Optional)"
                    value={nextFollowupInActivity}
                    onChange={(e) => setNextFollowupInActivity(e.target.value)}
                  />
                </div>

                <textarea 
                  rows="3" 
                  placeholder="Enter call outcome, meeting notes, or follow-up summary..."
                  value={activityNote}
                  onChange={(e) => setActivityNote(e.target.value)}
                  required
                />

                <div style={{ textAlign: 'right', marginTop: '0.75rem' }}>
                  <button type="submit" className="btn-primary">
                    <Send size={14} /> Save Activity Log
                  </button>
                </div>
              </form>

              {/* Timeline List */}
              <div className="activities-timeline">
                <h4>Activity Timeline</h4>
                {leadActivities.length === 0 ? (
                  <p className="text-muted" style={{ padding: '1rem 0' }}>No activity logs recorded yet.</p>
                ) : (
                  leadActivities.map(act => (
                    <div key={act.id} className="timeline-item">
                      <div className="timeline-badge">
                        {act.type === 'Call' && '📞'}
                        {act.type === 'Email' && '✉️'}
                        {act.type === 'Meeting' && '🤝'}
                        {act.type === 'Status Change' && '⚡'}
                        {act.type === 'Proposal' && '📄'}
                        {(!act.type || act.type === 'Note') && '📝'}
                      </div>
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <strong>{act.author_name || 'System'}</strong>
                          <span className="timeline-date">{new Date(act.created_at).toLocaleString()}</span>
                        </div>
                        <p className="timeline-summary">{act.summary}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
