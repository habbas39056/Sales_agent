import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { 
  Search, Folder, Plus, X, FileSpreadsheet, Edit2, Trash2, Eye, 
  MessageCircle, Lock, FileText, Bell, Calendar, AlertCircle, Clock, 
  RefreshCw, LayoutGrid, List, RotateCcw, User, Users, CheckCircle2, 
  Layers, Download, ChevronRight, Briefcase
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Pagination from '../components/Pagination';
import { getProjectDueDateStatus } from '../utils/projectDueDate';
import './ProjectsList.css';
import './Modal.css';

export default function ProjectsList() {
  const navigate = useNavigate();

  // Data States
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filter & Search States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [serviceFilter, setServiceFilter] = useState('All Services');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('All Actions');

  // UI View Mode: 'table' or 'grid'
  const [viewMode, setViewMode] = useState('table');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // New Project Form
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_id: '',
    invoice_id: '',
    pm_id: '',
    team_member_ids: [],
    service_type: [],
    revision_cycles_included: 0,
    terms_and_conditions: '',
    due_date: '',
    status: 'Assigned'
  });

  const availableServices = useMemo(() => {
    return categories.map(c => c.name);
  }, [categories]);

  const availableStatuses = useMemo(() => {
    const list = [
      'Active (All Incomplete)',
      'Assigned',
      'In Progress',
      'Completed',
      'On Hold',
      'Pending',
      'Submitted for Review',
      'Revision Requested',
      'Deadline Confirmed'
    ];
    projects.forEach(p => {
      if (p.status && !list.includes(p.status)) {
        list.push(p.status);
      }
    });
    return list;
  }, [projects]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchProjects(),
        fetchClients(),
        fetchInvoices(),
        fetchCategories(),
        fetchTeamMembers(),
        fetchNotifications()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (!user) return;
      const res = await axios.get(`/api/notifications?user_id=${user.id}`);
      setNotifications(res.data || []);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const res = await axios.get('/api/users/specialists');
      setTeamMembers(res.data || []);
    } catch (error) {
      console.error('Failed to fetch team members', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get('/api/project-categories');
      setCategories(res.data || []);
      if (res.data && res.data.length > 0 && formData.service_type.length === 0) {
        setFormData(prev => ({
          ...prev,
          service_type: [res.data[0].name]
        }));
      }
    } catch (error) {
      console.error('Failed to fetch project categories', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      let url = '/api/projects';
      if (user) {
        url += `?user_id=${user.id}&role=${encodeURIComponent(user.role)}`;
      }
      const res = await axios.get(url);
      setProjects(res.data || []);
    } catch (error) {
      console.error('Failed to fetch projects', error);
    }
  };

  const fetchClients = async () => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      let url = '/api/clients';
      if (user) {
        url += `?user_id=${user.id}&role=${encodeURIComponent(user.role)}`;
      }
      const res = await axios.get(url);
      setClients(res.data || []);
    } catch (error) {
      console.error('Failed to fetch clients', error);
    }
  };

  const fetchInvoices = async () => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      let url = '/api/invoices';
      if (user) {
        url += `?user_id=${user.id}&role=${encodeURIComponent(user.role)}`;
      }
      const res = await axios.get(url);
      setInvoices(res.data || []);
    } catch (error) {
      console.error('Failed to fetch invoices', error);
    }
  };

  // Filter Logic
  const isFilterActive = searchTerm !== '' || 
    statusFilter !== 'All Statuses' || 
    serviceFilter !== 'All Services' || 
    startDateFilter !== '' || 
    endDateFilter !== '' || 
    actionFilter !== 'All Actions';

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('All Statuses');
    setServiceFilter('All Services');
    setStartDateFilter('');
    setEndDateFilter('');
    setActionFilter('All Actions');
    setCurrentPage(1);
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      // 1. Search Query
      const term = searchTerm.trim().toLowerCase();
      let matchesSearch = true;
      if (term) {
        const titleMatch = (project.title || '').toLowerCase().includes(term);
        const clientMatch = (project.client_name || '').toLowerCase().includes(term);
        const pmMatch = (project.assigned_name || '').toLowerCase().includes(term);
        const membersMatch = project.assigned_members && project.assigned_members.some(m => (m.name || '').toLowerCase().includes(term));
        matchesSearch = titleMatch || clientMatch || pmMatch || membersMatch;
      }

      // 2. Status Filter
      let matchesStatus = true;
      if (statusFilter !== 'All Statuses') {
        if (statusFilter === 'Active' || statusFilter === 'Active (All Incomplete)') {
          matchesStatus = project.status !== 'Completed' && project.status !== 'Commission Released' && project.status !== 'On Hold';
        } else if (statusFilter === 'Completed') {
          matchesStatus = project.status === 'Completed' || project.status === 'Commission Released';
        } else {
          matchesStatus = project.status === statusFilter;
        }
      }

      // 3. Service Filter
      let matchesService = true;
      if (serviceFilter !== 'All Services') {
        let st = project.service_type;
        try {
          if (typeof st === 'string' && st.startsWith('[')) {
            st = JSON.parse(st);
          }
        } catch(e){}

        if (Array.isArray(st)) {
          matchesService = st.includes(serviceFilter);
        } else {
          matchesService = st === serviceFilter;
        }
      }

      // 4. Date Filter
      let matchesDate = true;
      if (startDateFilter || endDateFilter) {
        const projDateStr = project.due_date || project.locked_deadline || project.start_date || project.created_at;
        if (projDateStr) {
          const projDate = new Date(projDateStr);
          if (startDateFilter) {
            const start = new Date(startDateFilter);
            start.setHours(0, 0, 0, 0);
            if (projDate < start) matchesDate = false;
          }
          if (endDateFilter) {
            const end = new Date(endDateFilter);
            end.setHours(23, 59, 59, 999);
            if (projDate > end) matchesDate = false;
          }
        } else {
          matchesDate = false;
        }
      }

      // 5. Action / Deadline Urgency Filter
      let matchesAction = true;
      const dueStatus = getProjectDueDateStatus(project.due_date || project.locked_deadline, project.status);

      if (actionFilter === 'Pending Approval') {
        matchesAction = project.steps && project.steps.some(s => s.status === 'Pending Approval');
      } else if (actionFilter === 'Appealed') {
        matchesAction = project.steps && project.steps.some(s => s.deadline_status === 'Appealed');
      } else if (actionFilter === 'Overdue') {
        matchesAction = dueStatus.status === 'overdue';
      } else if (actionFilter === 'Due Soon') {
        matchesAction = dueStatus.status === 'due_today' || dueStatus.status === 'urgent' || dueStatus.status === 'soon';
      }

      return matchesSearch && matchesStatus && matchesService && matchesDate && matchesAction;
    });
  }, [projects, searchTerm, statusFilter, serviceFilter, startDateFilter, endDateFilter, actionFilter]);

  const currentProjects = useMemo(() => {
    return filteredProjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredProjects, currentPage, itemsPerPage]);

  // Status Badge Styling Helper
  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Completed':
      case 'Commission Released':
        return { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
      case 'In Progress':
      case 'Active':
        return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
      case 'Assigned':
        return { bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' };
      case 'Submitted for Review':
        return { bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc' };
      case 'Revision Requested':
        return { bg: '#fff1f2', color: '#e11d48', border: '#fecdd3' };
      case 'Pending':
        return { bg: '#fffbeb', color: '#b45309', border: '#fde68a' };
      case 'On Hold':
        return { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
      case 'Deadline Confirmed':
        return { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' };
      default:
        return { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' };
    }
  };

  // Multi-Sheet Excel Export
  const handleExportExcel = () => {
    if (!filteredProjects || filteredProjects.length === 0) {
      alert('No projects to export!');
      return;
    }

    const wb = XLSX.utils.book_new();

    // 1. All Projects Summary Sheet
    const allProjectsData = filteredProjects.map(p => {
      let st = p.service_type;
      try {
        if (typeof st === 'string' && st.startsWith('[')) st = JSON.parse(st);
      } catch(e){}
      const serviceDisplay = Array.isArray(st) ? st.join(', ') : (st || 'Unspecified');

      return {
        'Project ID': p.id,
        'Project Title': p.title,
        'Client Name': p.client_name || 'N/A',
        'Lead / Team': p.assigned_name || 'Unassigned',
        'Service Categories': serviceDisplay,
        'Due Date': p.due_date ? new Date(p.due_date).toLocaleDateString('en-GB') : (p.locked_deadline ? new Date(p.locked_deadline).toLocaleDateString('en-GB') : 'N/A'),
        'Deadline Status': getProjectDueDateStatus(p.due_date || p.locked_deadline, p.status).label,
        'Status': p.status || 'Assigned',
        'Completed Steps': p.completed_steps || 0,
        'Total Steps': p.total_steps || 0,
        'Progress (%)': p.total_steps > 0 ? Math.round((p.completed_steps / p.total_steps) * 100) : 0,
        'Created Date': p.created_at ? new Date(p.created_at).toLocaleDateString('en-GB') : 'N/A'
      };
    });

    const wsAll = XLSX.utils.json_to_sheet(allProjectsData);
    XLSX.utils.book_append_sheet(wb, wsAll, 'All Projects');

    // 2. Separate sheet for each Service Category
    const categoryMap = {};
    filteredProjects.forEach(p => {
      let st = p.service_type;
      try {
        if (typeof st === 'string' && st.startsWith('[')) st = JSON.parse(st);
      } catch(e){}
      const catList = Array.isArray(st) ? st : [st || 'Unspecified'];

      catList.forEach(catName => {
        if (!categoryMap[catName]) {
          categoryMap[catName] = [];
        }
        categoryMap[catName].push({
          'Project Title': p.title,
          'Client Name': p.client_name || 'N/A',
          'Lead / Team': p.assigned_name || 'Unassigned',
          'Due Date': p.due_date ? new Date(p.due_date).toLocaleDateString('en-GB') : 'N/A',
          'Deadline Status': getProjectDueDateStatus(p.due_date || p.locked_deadline, p.status).label,
          'Status': p.status || 'Assigned',
          'Steps': `${p.completed_steps || 0}/${p.total_steps || 0}`,
          'Progress (%)': p.total_steps > 0 ? Math.round((p.completed_steps / p.total_steps) * 100) : 0
        });
      });
    });

    Object.keys(categoryMap).forEach(catName => {
      const sheetName = catName.replace(/[:\\/?*\[\]]/g, '').substring(0, 30) || 'Category';
      const wsCat = XLSX.utils.json_to_sheet(categoryMap[catName]);
      XLSX.utils.book_append_sheet(wb, wsCat, sheetName);
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Projects_Directory_${dateStr}.xlsx`);
  };

  // PDF Statement Report Export
  const handleExportPDF = () => {
    if (!filteredProjects || filteredProjects.length === 0) {
      alert('No projects to export!');
      return;
    }

    try {
      const doc = new jsPDF('landscape', 'pt', 'a4');
      
      // Header Title & Branding
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text("Adwise Sales - Project Creation & Portfolio Statement", 40, 45);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Generated: ${new Date().toLocaleDateString('en-GB')} | Records: ${filteredProjects.length} | Status Filter: ${statusFilter} | Service Filter: ${serviceFilter}`,
        40,
        62
      );

      const tableColumns = [
        "ID", "Project Title", "Client Name", "Team Assigned", "Services", "Due Date", "Urgency", "Steps", "Progress", "Status"
      ];

      const tableRows = filteredProjects.map(p => {
        let st = p.service_type;
        try {
          if (typeof st === 'string' && st.startsWith('[')) st = JSON.parse(st);
        } catch(e){}
        const serviceDisplay = Array.isArray(st) ? st.join(', ') : (st || '-');

        const dueStatus = getProjectDueDateStatus(p.due_date || p.locked_deadline, p.status);
        const total = p.total_steps || 0;
        const completed = p.completed_steps || 0;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

        return [
          `#${p.id}`,
          p.title || '-',
          p.client_name || '-',
          p.assigned_name || 'Unassigned',
          serviceDisplay,
          dueStatus.formattedDate,
          dueStatus.badgeText,
          `${completed}/${total}`,
          `${pct}%`,
          p.status || 'Assigned'
        ];
      });

      autoTable(doc, {
        head: [tableColumns],
        body: tableRows,
        startY: 75,
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 150 },
          2: { cellWidth: 100 },
          3: { cellWidth: 100 },
          4: { cellWidth: 110 },
          5: { cellWidth: 65 },
          6: { cellWidth: 80 },
          7: { cellWidth: 45 },
          8: { cellWidth: 50 },
          9: { cellWidth: 70 }
        }
      });

      doc.save(`projects_statement_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error('PDF generation error', error);
      alert('Failed to generate PDF: ' + error.message);
    }
  };

  // Form Handlers
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Project Title is required');
      return;
    }
    if (!formData.client_id) {
      alert('Please select a client for this project');
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.post('/api/projects', formData);
      setIsModalOpen(false);
      setFormData({
        title: '',
        description: '',
        client_id: '',
        invoice_id: '',
        pm_id: '',
        team_member_ids: [],
        service_type: availableServices.length > 0 ? [availableServices[0]] : [],
        revision_cycles_included: 0,
        terms_and_conditions: '',
        due_date: '',
        status: 'Assigned'
      });
      await fetchProjects();
    } catch (error) {
      console.error('Error creating project', error);
      alert('Error creating project: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (e, project) => {
    e.stopPropagation();
    const existingMemberIds = project.assigned_members && project.assigned_members.length > 0
      ? project.assigned_members.map(m => m.id)
      : (project.pm_id ? [project.pm_id] : []);
    
    let st = project.service_type;
    try { if (typeof st === 'string' && st.startsWith('[')) st = JSON.parse(st); } catch(e){}

    const pDueDate = project.due_date || project.locked_deadline;
    const formattedDueDate = pDueDate ? String(pDueDate).split('T')[0] : '';

    setEditFormData({
      title: project.title || '',
      description: project.description || '',
      client_id: project.client_id || '',
      pm_id: project.pm_id || '',
      team_member_ids: existingMemberIds,
      service_type: Array.isArray(st) ? st : (st ? [st] : []),
      revision_cycles_included: project.revision_cycles_included || 0,
      terms_and_conditions: project.terms_and_conditions || '',
      due_date: formattedDueDate,
      status: project.status || 'Assigned'
    });
    setEditingProject(project);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editFormData.title.trim()) {
      alert('Project Title is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.put(`/api/projects/${editingProject.id}`, editFormData);
      setIsEditModalOpen(false);
      setEditingProject(null);
      await fetchProjects();
    } catch (error) {
      console.error('Error updating project', error);
      alert('Error updating project: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = async (e, project) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${project.title}"? This will also remove all associated steps, deliverables, and comments.`)) return;
    try {
      await axios.delete(`/api/projects/${project.id}`);
      fetchProjects();
    } catch (error) {
      console.error('Error deleting project', error);
      alert('Error deleting project: ' + (error.response?.data?.error || error.message));
    }
  };

  // Custom styling for React-Select to match Crimson Red theme
  const customSelectStyles = {
    control: (base, state) => ({
      ...base,
      borderRadius: '8px',
      borderColor: state.isFocused ? '#e11d48' : '#cbd5e1',
      boxShadow: state.isFocused ? '0 0 0 3px rgba(225, 29, 72, 0.15)' : 'none',
      '&:hover': { borderColor: '#e11d48' },
      padding: '2px',
      fontSize: '0.9rem',
      backgroundColor: '#ffffff'
    }),
    menu: (base) => ({
      ...base,
      zIndex: 9999,
      borderRadius: '8px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected ? '#e11d48' : (state.isFocused ? '#fff1f2' : 'transparent'),
      color: state.isSelected ? '#ffffff' : '#1e293b',
      fontSize: '0.85rem',
      cursor: 'pointer'
    })
  };

  return (
    <div className="projects-container modern-ui">
      {/* 1. Header with Title and Shifted Right-Aligned Action Buttons */}
      <div className="projects-page-header">
        <div className="header-title-area">
          <div className="header-badge-row">
            <h1 className="projects-main-heading">Project Creation & Management</h1>
            <span className="project-count-badge">
              {filteredProjects.length} {filteredProjects.length === 1 ? 'Project' : 'Projects'}
            </span>
            {isFilterActive && (
              <span className="filter-active-pill">Filtered Results</span>
            )}
          </div>
          <p className="projects-subheading">
            Create new client deliverables, configure specialist teams, monitor deadlines, and track execution milestones
          </p>
        </div>

        <div className="projects-header-actions">
          <button 
            type="button" 
            className="action-btn secondary-btn" 
            onClick={fetchInitialData}
            title="Refresh projects list"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button 
            type="button" 
            className="action-btn export-pdf-btn" 
            onClick={handleExportPDF}
            title="Download PDF Portfolio Statement"
          >
            <FileText size={15} />
            <span>PDF Statement</span>
          </button>

          <button 
            type="button" 
            className="action-btn excel-btn" 
            onClick={handleExportExcel}
            title="Download Multi-Sheet Excel Workbook"
          >
            <FileSpreadsheet size={15} />
            <span>Export Excel</span>
          </button>

          <button 
            type="button" 
            className="action-btn primary-add-btn" 
            onClick={() => setIsModalOpen(true)}
            title="Create a new client project"
          >
            <Plus size={16} />
            <span>Create Project</span>
          </button>
        </div>
      </div>

      {/* 2. Control Toolbar: Search, Filters, Date Range, Action Filter, View Mode Switcher */}
      <div className="projects-control-panel">
        <div className="projects-filter-bar">
          {/* Search Box */}
          <div className="projects-search-box">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by project title, client, or team..." 
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchTerm && (
              <button 
                type="button" 
                className="search-clear-btn" 
                onClick={() => setSearchTerm('')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="filter-item-wrapper">
            <select 
              className="custom-filter-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="All Statuses">All Statuses</option>
              {availableStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Service Category Filter */}
          <div className="filter-item-wrapper">
            <select 
              className="custom-filter-select"
              value={serviceFilter}
              onChange={(e) => {
                setServiceFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="All Services">All Services</option>
              {availableServices.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Date Range Picker */}
          <div className="date-filter-box">
            <Calendar size={14} className="calendar-icon" />
            <span className="date-label">From:</span>
            <input 
              type="date"
              value={startDateFilter}
              onChange={(e) => { setStartDateFilter(e.target.value); setCurrentPage(1); }}
              className="date-input"
              title="Filter from start date"
            />
            <span className="date-label">To:</span>
            <input 
              type="date"
              value={endDateFilter}
              onChange={(e) => { setEndDateFilter(e.target.value); setCurrentPage(1); }}
              className="date-input"
              title="Filter to end date"
            />
            {(startDateFilter || endDateFilter) && (
              <button 
                type="button" 
                onClick={() => { setStartDateFilter(''); setEndDateFilter(''); setCurrentPage(1); }}
                className="date-clear-btn"
                title="Clear date filter"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Action / Deadline Status Filter */}
          <div className="filter-item-wrapper">
            <select 
              className="custom-filter-select"
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="All Actions">All Urgency & Actions</option>
              <option value="Overdue">🚨 Overdue Projects</option>
              <option value="Due Soon">⏰ Due Today / Soon</option>
              <option value="Pending Approval">⏳ Pending Approval</option>
              <option value="Appealed">🚨 Deadline Appealed</option>
            </select>
          </div>

          {/* 1-Click Reset */}
          {isFilterActive && (
            <button 
              type="button" 
              className="reset-filters-btn" 
              onClick={handleResetFilters}
              title="Reset all filters"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}

          {/* Dual View Mode Switcher */}
          <div className="view-mode-toggle" title="Switch View Mode">
            <button 
              type="button" 
              className={`view-mode-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Enterprise Table View"
            >
              <List size={16} />
            </button>
            <button 
              type="button" 
              className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Visual Cards Grid View"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Projects Display: Table View or Cards Grid View */}
      {viewMode === 'table' ? (
        <div className="projects-table-card">
          <div className="table-responsive">
            <table className="enterprise-projects-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: '1.25rem', width: '28%' }}>Project Title & Scope</th>
                  <th style={{ width: '16%' }}>Client</th>
                  <th style={{ width: '16%' }}>Assigned Team</th>
                  <th style={{ width: '12%' }}>Services</th>
                  <th style={{ width: '12%' }}>Due Date & Urgency</th>
                  <th style={{ width: '10%' }}>Progress</th>
                  <th style={{ width: '8%' }}>Status</th>
                  <th style={{ textAlign: 'right', paddingRight: '1.25rem', width: '10%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentProjects.map(project => {
                  const total = project.total_steps || 0;
                  const completed = project.completed_steps || 0;
                  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
                  const dueStatus = getProjectDueDateStatus(project.due_date || project.locked_deadline, project.status);
                  const sStyle = getStatusBadgeStyle(project.status);

                  // Notifications for this project
                  const unreadForProject = notifications.filter(n => 
                    !n.is_read && n.link && (n.link.includes(`/projects?id=${project.id}`) || n.link.includes(`/projects/${project.id}`))
                  );
                  const commentsCount = unreadForProject.filter(n => n.type === 'comment').length;
                  const internalCount = unreadForProject.filter(n => n.type === 'internal_chat').length;
                  const docsCount = unreadForProject.filter(n => n.type === 'document').length;

                  // Service tags
                  let st = project.service_type;
                  try {
                    if (typeof st === 'string' && st.startsWith('[')) st = JSON.parse(st);
                  } catch(e){}
                  const serviceTags = Array.isArray(st) ? st : (st ? [st] : []);

                  return (
                    <tr 
                      key={project.id} 
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="project-row"
                    >
                      {/* Project Title & Scope */}
                      <td style={{ paddingLeft: '1.25rem' }}>
                        <div className="project-title-wrapper">
                          <div className="project-folder-icon">
                            <Folder size={18} />
                          </div>
                          <div className="project-name-group">
                            <div className="project-name-row">
                              <span className="project-name-text">{project.title}</span>
                              
                              {/* Unread Alert Badges */}
                              {unreadForProject.length > 0 && (
                                <div className="project-alert-badges">
                                  {commentsCount > 0 && (
                                    <span className="alert-badge comment" title={`${commentsCount} new comments`}>
                                      <MessageCircle size={10} /> {commentsCount}
                                    </span>
                                  )}
                                  {internalCount > 0 && (
                                    <span className="alert-badge internal" title={`${internalCount} new internal chats`}>
                                      <Lock size={10} /> {internalCount}
                                    </span>
                                  )}
                                  {docsCount > 0 && (
                                    <span className="alert-badge doc" title={`${docsCount} new deliverables`}>
                                      <FileText size={10} /> {docsCount}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="project-sub-meta">
                              <span className="project-id-tag">#{project.id}</span>
                              {project.description && (
                                <span className="project-desc-snippet" title={project.description}>
                                  {project.description.slice(0, 45)}...
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Client */}
                      <td>
                        <div className="client-cell">
                          <div className="client-avatar-sm">
                            <User size={13} />
                          </div>
                          <div className="client-info-sm">
                            <span className="client-name">{project.client_name || 'No Client'}</span>
                            {project.business_name && (
                              <span className="client-business">{project.business_name}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Assigned Team */}
                      <td>
                        <div className="team-cell">
                          {project.assigned_members && project.assigned_members.length > 0 ? (
                            <div className="team-chips-wrap">
                              {project.assigned_members.slice(0, 2).map(m => (
                                <span key={m.id} className="team-member-chip" title={`${m.name} (${m.role})`}>
                                  {m.name}
                                </span>
                              ))}
                              {project.assigned_members.length > 2 && (
                                <span className="team-member-chip extra" title={project.assigned_members.slice(2).map(m => m.name).join(', ')}>
                                  +{project.assigned_members.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="unassigned-text">{project.assigned_name || 'Unassigned'}</span>
                          )}
                        </div>
                      </td>

                      {/* Services */}
                      <td>
                        <div className="services-cell">
                          {serviceTags.length > 0 ? (
                            <div className="service-tags-wrap">
                              {serviceTags.slice(0, 2).map((s, idx) => (
                                <span key={idx} className="service-category-tag">{s}</span>
                              ))}
                              {serviceTags.length > 2 && (
                                <span className="service-category-tag extra">+{serviceTags.length - 2}</span>
                              )}
                            </div>
                          ) : (
                            <span className="service-category-tag empty">General</span>
                          )}
                        </div>
                      </td>

                      {/* Due Date & Urgency */}
                      <td>
                        <div className="due-date-cell">
                          {dueStatus.status === 'none' ? (
                            <span className="no-date-text">No Due Date</span>
                          ) : (
                            <>
                              <div className="due-date-row">
                                <Calendar size={13} style={{ color: dueStatus.color }} />
                                <span className="due-date-text">{dueStatus.formattedDate}</span>
                              </div>
                              <span 
                                className="due-urgency-pill"
                                style={{
                                  color: dueStatus.color,
                                  backgroundColor: dueStatus.bg,
                                  borderColor: dueStatus.border
                                }}
                              >
                                {dueStatus.badgeText}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Progress */}
                      <td>
                        <div className="progress-cell">
                          <div className="progress-track">
                            <div 
                              className="progress-fill" 
                              style={{ 
                                width: `${percent}%`,
                                backgroundColor: percent === 100 ? '#10b981' : (percent > 40 ? '#e11d48' : '#f59e0b')
                              }}
                            ></div>
                          </div>
                          <div className="progress-stats-row">
                            <span className="progress-percent">{percent}%</span>
                            <span className="progress-steps">({completed}/{total})</span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <span 
                          className="project-status-badge"
                          style={{
                            backgroundColor: sStyle.bg,
                            color: sStyle.color,
                            borderColor: sStyle.border
                          }}
                        >
                          {project.status || 'Assigned'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right', paddingRight: '1.25rem' }}>
                        <div className="row-action-btns" onClick={(e) => e.stopPropagation()}>
                          <button 
                            type="button" 
                            className="row-btn view" 
                            onClick={() => navigate(`/projects/${project.id}`)}
                            title="View Project Workspace"
                          >
                            <Eye size={14} />
                            <span>View</span>
                          </button>

                          <button 
                            type="button" 
                            className="row-btn edit" 
                            onClick={(e) => handleEditClick(e, project)}
                            title="Edit Project"
                          >
                            <Edit2 size={14} />
                          </button>

                          <button 
                            type="button" 
                            className="row-btn delete" 
                            onClick={(e) => handleDeleteClick(e, project)}
                            title="Delete Project"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {currentProjects.length === 0 && (
                  <tr>
                    <td colSpan="8" className="empty-table-cell">
                      <div className="empty-state-content">
                        <Folder size={40} className="empty-icon" />
                        <h3>No projects found</h3>
                        <p>No projects matched your active filters or search criteria.</p>
                        {isFilterActive && (
                          <button type="button" className="action-btn secondary-btn" onClick={handleResetFilters}>
                            <RotateCcw size={14} /> Clear All Filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Visual Cards Grid View */
        <div className="projects-cards-grid">
          {currentProjects.map(project => {
            const total = project.total_steps || 0;
            const completed = project.completed_steps || 0;
            const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
            const dueStatus = getProjectDueDateStatus(project.due_date || project.locked_deadline, project.status);
            const sStyle = getStatusBadgeStyle(project.status);

            let st = project.service_type;
            try {
              if (typeof st === 'string' && st.startsWith('[')) st = JSON.parse(st);
            } catch(e){}
            const serviceTags = Array.isArray(st) ? st : (st ? [st] : []);

            return (
              <div 
                key={project.id} 
                className="project-grid-card"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <div className="grid-card-top">
                  <div className="card-identity">
                    <div className="grid-folder-icon">
                      <Folder size={20} />
                    </div>
                    <div>
                      <span className="grid-project-id">#{project.id}</span>
                      <h3 className="grid-project-title" title={project.title}>{project.title}</h3>
                    </div>
                  </div>

                  <span 
                    className="project-status-badge"
                    style={{
                      backgroundColor: sStyle.bg,
                      color: sStyle.color,
                      borderColor: sStyle.border
                    }}
                  >
                    {project.status || 'Assigned'}
                  </span>
                </div>

                <div className="grid-card-client-row">
                  <div className="client-avatar-sm">
                    <User size={12} />
                  </div>
                  <div className="client-text-col">
                    <span className="client-label">Client</span>
                    <span className="client-name-val">{project.client_name || 'No Client Assigned'}</span>
                  </div>
                </div>

                {/* Service Tags */}
                {serviceTags.length > 0 && (
                  <div className="grid-services-row">
                    {serviceTags.map((s, i) => (
                      <span key={i} className="service-category-tag">{s}</span>
                    ))}
                  </div>
                )}

                {/* Timeline / Due Date Info */}
                <div className="grid-timeline-box">
                  <div className="timeline-col">
                    <span className="timeline-title">Deadline</span>
                    <div className="timeline-val-row">
                      <Calendar size={13} style={{ color: dueStatus.color }} />
                      <span>{dueStatus.formattedDate}</span>
                    </div>
                  </div>
                  <span 
                    className="due-urgency-pill"
                    style={{
                      color: dueStatus.color,
                      backgroundColor: dueStatus.bg,
                      borderColor: dueStatus.border
                    }}
                  >
                    {dueStatus.badgeText}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="grid-progress-section">
                  <div className="grid-progress-labels">
                    <span className="progress-name">Milestone Progress</span>
                    <span className="progress-numbers">{completed}/{total} steps ({percent}%)</span>
                  </div>
                  <div className="progress-track">
                    <div 
                      className="progress-fill" 
                      style={{ 
                        width: `${percent}%`,
                        backgroundColor: percent === 100 ? '#10b981' : (percent > 40 ? '#e11d48' : '#f59e0b')
                      }}
                    ></div>
                  </div>
                </div>

                {/* Team Members */}
                <div className="grid-card-team-row">
                  <div className="team-lead-info">
                    <Users size={14} className="team-lead-icon" />
                    <span className="team-lead-text">
                      {project.assigned_members && project.assigned_members.length > 0
                        ? `${project.assigned_members.length} team members assigned`
                        : (project.assigned_name || 'Unassigned')}
                    </span>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="grid-card-footer" onClick={(e) => e.stopPropagation()}>
                  <button 
                    type="button" 
                    className="action-btn secondary-btn small-btn"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <Eye size={14} /> View Workspace
                  </button>

                  <div className="grid-action-icon-group">
                    <button 
                      type="button" 
                      className="grid-icon-btn edit" 
                      onClick={(e) => handleEditClick(e, project)}
                      title="Edit Project Details"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      type="button" 
                      className="grid-icon-btn delete" 
                      onClick={(e) => handleDeleteClick(e, project)}
                      title="Delete Project"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {currentProjects.length === 0 && (
            <div className="empty-grid-state">
              <Folder size={48} className="empty-icon" />
              <h3>No projects found</h3>
              <p>Try adjusting your search criteria or reset filters.</p>
              {isFilterActive && (
                <button type="button" className="action-btn secondary-btn" onClick={handleResetFilters}>
                  <RotateCcw size={14} /> Clear All Filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. Pagination */}
      {filteredProjects.length > itemsPerPage && (
        <div className="projects-pagination-wrap">
          <Pagination 
            currentPage={currentPage}
            totalItems={filteredProjects.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* 5. Senior-Level Figma-Quality Create Project Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content professional-project-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-text">
                <h2>Create New Project</h2>
                <p>Configure deliverables, client association, team specialists, and milestone schedules</p>
              </div>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setIsModalOpen(false)}
                title="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="project-modal-form">
              {/* Section 1: Project Identity & Client Association */}
              <div className="form-section-card">
                <div className="form-section-header">
                  <Briefcase size={16} className="section-icon" />
                  <h3>1. Project & Client Association</h3>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Project Title <span className="req-star">*</span>
                  </label>
                  <input 
                    type="text" 
                    name="title" 
                    value={formData.title} 
                    onChange={handleInputChange} 
                    required 
                    placeholder="e.g. Annual Tax Return Filing (ABC Logistics)" 
                    className="form-input"
                  />
                  <span className="field-hint">Use a descriptive title that both the client and specialists recognize immediately.</span>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">
                      Client Account <span className="req-star">*</span>
                    </label>
                    <Select
                      options={clients.map(c => ({ 
                        value: c.id, 
                        label: `${c.full_name}${c.business_name ? ` · ${c.business_name}` : ''}` 
                      }))}
                      value={(() => {
                        if (!formData.client_id) return null;
                        const found = clients.find(c => String(c.id) === String(formData.client_id));
                        return found ? { 
                          value: found.id, 
                          label: `${found.full_name}${found.business_name ? ` · ${found.business_name}` : ''}` 
                        } : null;
                      })()}
                      onChange={(selectedOption) => {
                        handleInputChange({ 
                          target: { name: 'client_id', value: selectedOption ? selectedOption.value : '' } 
                        });
                        // Reset linked invoice if client changed
                        setFormData(prev => ({ ...prev, invoice_id: '' }));
                      }}
                      placeholder="Search and select client..."
                      isSearchable={true}
                      isClearable={true}
                      required
                      styles={customSelectStyles}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Link Client Invoice (Optional)</label>
                    <select 
                      name="invoice_id" 
                      value={formData.invoice_id} 
                      onChange={handleInputChange}
                      className="form-select"
                      disabled={!formData.client_id}
                    >
                      <option value="">
                        {!formData.client_id ? "Select a client first to link invoices" : "No Invoice Linked"}
                      </option>
                      {formData.client_id && invoices
                        .filter(i => i.client_id === parseInt(formData.client_id))
                        .map(i => (
                          <option key={i.id} value={i.id}>
                            #{i.invoice_number} · PKR {Number(i.amount).toLocaleString()} ({i.status || 'Active'})
                          </option>
                        ))}
                    </select>
                    <span className="field-hint">Associates financial receivables with this execution workflow.</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Team & Specialists Assignment */}
              <div className="form-section-card">
                <div className="form-section-header">
                  <Users size={16} className="section-icon" />
                  <h3>2. Team & Resource Assignment</h3>
                </div>

                <div className="form-group">
                  <label className="form-label">Assign Team Specialists</label>
                  <div className="multi-select-container">
                    <div className="selected-tags-box">
                      {(formData.team_member_ids || []).length === 0 ? (
                        <span className="empty-tags-hint">No specialists assigned yet. Pick from the selector below.</span>
                      ) : (
                        (formData.team_member_ids || []).map(id => {
                          const m = teamMembers.find(member => member.id === parseInt(id));
                          if (!m) return null;
                          return (
                            <span key={id} className="member-chip">
                              <span className="member-chip-name">{m.full_name}</span>
                              <span className="member-chip-role">{m.role}</span>
                              <button 
                                type="button" 
                                className="tag-remove-btn" 
                                onClick={() => {
                                  setFormData(prev => ({
                                    ...prev,
                                    team_member_ids: prev.team_member_ids.filter(mId => mId !== id),
                                    pm_id: prev.pm_id === id ? (prev.team_member_ids.find(mId => mId !== id) || '') : prev.pm_id
                                  }));
                                }}
                              >
                                <X size={12} />
                              </button>
                            </span>
                          );
                        })
                      )}
                    </div>

                    <select 
                      className="form-select"
                      value=""
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val && !formData.team_member_ids.includes(val)) {
                          setFormData(prev => ({
                            ...prev,
                            team_member_ids: [...prev.team_member_ids, val],
                            pm_id: prev.pm_id || val
                          }));
                        }
                      }}
                    >
                      <option value="">+ Click to Add Specialist / Team Member...</option>
                      {teamMembers
                        .filter(m => !(formData.team_member_ids || []).includes(m.id))
                        .map(m => (
                          <option key={m.id} value={m.id}>{m.full_name} · {m.role}</option>
                        ))}
                    </select>
                  </div>
                  <span className="field-hint">Assigned specialists receive automated WhatsApp alerts and portal task permissions.</span>
                </div>
              </div>

              {/* Section 3: Services, Schedules & Specs */}
              <div className="form-section-card">
                <div className="form-section-header">
                  <Layers size={16} className="section-icon" />
                  <h3>3. Services, Schedules & Revisions</h3>
                </div>

                {/* Service Types Multi-Tags */}
                <div className="form-group">
                  <label className="form-label">
                    Service Categories <span className="req-star">*</span>
                  </label>
                  <div className="service-tags-box">
                    {(formData.service_type || []).map(st => (
                      <span key={st} className="service-tag-chip">
                        <span>{st}</span>
                        <X 
                          size={13} 
                          className="remove-icon"
                          onClick={() => setFormData(prev => ({...prev, service_type: prev.service_type.filter(s => s !== st)}))} 
                        />
                      </span>
                    ))}
                  </div>

                  <select 
                    className="form-select"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && !(formData.service_type || []).includes(val)) {
                        setFormData(prev => ({
                          ...prev,
                          service_type: [...(prev.service_type || []), val]
                        }));
                      }
                      e.target.value = "";
                    }}
                  >
                    <option value="">+ Add Service Category...</option>
                    {availableServices.filter(s => !(formData.service_type || []).includes(s)).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="form-grid-3">
                  {/* Due Date */}
                  <div className="form-group">
                    <label className="form-label">
                      <Calendar size={14} className="input-icon" /> Target Due Date
                    </label>
                    <input 
                      type="date" 
                      name="due_date" 
                      value={formData.due_date} 
                      onChange={handleInputChange} 
                      className="form-input"
                    />
                    {formData.due_date && (() => {
                      const st = getProjectDueDateStatus(formData.due_date, 'Active');
                      return (
                        <div 
                          className="date-preview-badge"
                          style={{
                            backgroundColor: st.bg,
                            color: st.color,
                            borderColor: st.border
                          }}
                        >
                          {st.status === 'overdue' ? <AlertCircle size={13} /> : <Clock size={13} />}
                          <span>{st.status === 'overdue' ? `⚠️ Date is overdue by ${st.daysOverdue} days` : st.label}</span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Initial Status */}
                  <div className="form-group">
                    <label className="form-label">Initial Project Status</label>
                    <select 
                      name="status" 
                      value={formData.status || 'Assigned'} 
                      onChange={handleInputChange}
                      className="form-select"
                    >
                      <option value="Assigned">Assigned</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>

                  {/* Revision Cycles */}
                  <div className="form-group">
                    <label className="form-label">Included Revisions</label>
                    <input 
                      type="number" 
                      name="revision_cycles_included" 
                      value={formData.revision_cycles_included} 
                      onChange={handleInputChange} 
                      min="0" 
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Scope, Specs & Terms */}
              <div className="form-section-card">
                <div className="form-section-header">
                  <FileText size={16} className="section-icon" />
                  <h3>4. Scope Brief & Deliverable Terms</h3>
                </div>

                <div className="form-group">
                  <label className="form-label">Project Scope & Description</label>
                  <textarea 
                    name="description" 
                    value={formData.description} 
                    onChange={handleInputChange} 
                    rows="3"
                    className="form-textarea"
                    placeholder="Provide deliverables description, expectations, and specific client guidelines..."
                  ></textarea>
                </div>

                <div className="form-group">
                  <label className="form-label">Terms & Conditions / Special Constraints</label>
                  <textarea 
                    name="terms_and_conditions" 
                    value={formData.terms_and_conditions} 
                    onChange={handleInputChange} 
                    rows="2" 
                    className="form-textarea"
                    placeholder="Specify payment clauses, milestone locks, or revision deadlines..."
                  ></textarea>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="modal-footer-actions">
                <button 
                  type="button" 
                  className="action-btn secondary-btn" 
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="action-btn primary-add-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={15} className="spin" />
                      <span>Creating Project...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      <span>Create Project</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Senior-Level Figma-Quality Edit Project Modal */}
      {isEditModalOpen && editingProject && (
        <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div className="modal-content professional-project-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-text">
                <h2>Edit Project #{editingProject.id}</h2>
                <p>Update deliverables, assigned personnel, schedules, and revision specs</p>
              </div>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setIsEditModalOpen(false)}
                title="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="project-modal-form">
              {/* Section 1: Project Identity & Client Association */}
              <div className="form-section-card">
                <div className="form-section-header">
                  <Briefcase size={16} className="section-icon" />
                  <h3>1. Project & Client Association</h3>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Project Title <span className="req-star">*</span>
                  </label>
                  <input 
                    type="text" 
                    name="title" 
                    value={editFormData.title || ''} 
                    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })} 
                    required 
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Client Account <span className="req-star">*</span>
                  </label>
                  <Select
                    options={clients.map(c => ({ 
                      value: c.id, 
                      label: `${c.full_name}${c.business_name ? ` · ${c.business_name}` : ''}` 
                    }))}
                    value={(() => {
                      if (!editFormData.client_id) return null;
                      const found = clients.find(c => String(c.id) === String(editFormData.client_id));
                      return found ? { 
                        value: found.id, 
                        label: `${found.full_name}${found.business_name ? ` · ${found.business_name}` : ''}` 
                      } : null;
                    })()}
                    onChange={(selectedOption) => setEditFormData({ 
                      ...editFormData, 
                      client_id: selectedOption ? selectedOption.value : '' 
                    })}
                    placeholder="Search and select client..."
                    isSearchable={true}
                    isClearable={true}
                    required
                    styles={customSelectStyles}
                  />
                </div>
              </div>

              {/* Section 2: Team & Specialists */}
              <div className="form-section-card">
                <div className="form-section-header">
                  <Users size={16} className="section-icon" />
                  <h3>2. Team & Resource Assignment</h3>
                </div>

                <div className="form-group">
                  <label className="form-label">Assign Team Specialists</label>
                  <div className="multi-select-container">
                    <div className="selected-tags-box">
                      {(editFormData.team_member_ids || []).length === 0 ? (
                        <span className="empty-tags-hint">No specialists assigned yet. Pick from the selector below.</span>
                      ) : (
                        (editFormData.team_member_ids || []).map(id => {
                          const m = teamMembers.find(member => member.id === parseInt(id));
                          if (!m) return null;
                          return (
                            <span key={id} className="member-chip">
                              <span className="member-chip-name">{m.full_name}</span>
                              <span className="member-chip-role">{m.role}</span>
                              <button 
                                type="button" 
                                className="tag-remove-btn" 
                                onClick={() => {
                                  setEditFormData(prev => ({
                                    ...prev,
                                    team_member_ids: prev.team_member_ids.filter(mId => mId !== id),
                                    pm_id: prev.pm_id === id ? (prev.team_member_ids.find(mId => mId !== id) || '') : prev.pm_id
                                  }));
                                }}
                              >
                                <X size={12} />
                              </button>
                            </span>
                          );
                        })
                      )}
                    </div>

                    <select 
                      className="form-select"
                      value=""
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val && !(editFormData.team_member_ids || []).includes(val)) {
                          setEditFormData(prev => ({
                            ...prev,
                            team_member_ids: [...(prev.team_member_ids || []), val],
                            pm_id: prev.pm_id || val
                          }));
                        }
                      }}
                    >
                      <option value="">+ Add Specialist / Team Member...</option>
                      {teamMembers
                        .filter(m => !(editFormData.team_member_ids || []).includes(m.id))
                        .map(m => (
                          <option key={m.id} value={m.id}>{m.full_name} · {m.role}</option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Services & Schedule */}
              <div className="form-section-card">
                <div className="form-section-header">
                  <Layers size={16} className="section-icon" />
                  <h3>3. Services, Schedules & Revisions</h3>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Service Categories <span className="req-star">*</span>
                  </label>
                  <div className="service-tags-box">
                    {(editFormData.service_type || []).map(st => (
                      <span key={st} className="service-tag-chip">
                        <span>{st}</span>
                        <X 
                          size={13} 
                          className="remove-icon"
                          onClick={() => setEditFormData(prev => ({...prev, service_type: prev.service_type.filter(s => s !== st)}))} 
                        />
                      </span>
                    ))}
                  </div>

                  <select 
                    className="form-select"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && !(editFormData.service_type || []).includes(val)) {
                        setEditFormData(prev => ({
                          ...prev,
                          service_type: [...(prev.service_type || []), val]
                        }));
                      }
                      e.target.value = "";
                    }}
                  >
                    <option value="">+ Add Service Category...</option>
                    {availableServices.filter(s => !(editFormData.service_type || []).includes(s)).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">
                      <Calendar size={14} className="input-icon" /> Target Due Date
                    </label>
                    <input 
                      type="date" 
                      name="due_date" 
                      value={editFormData.due_date || ''} 
                      onChange={(e) => setEditFormData({ ...editFormData, due_date: e.target.value })} 
                      className="form-input"
                    />
                    {editFormData.due_date && (() => {
                      const st = getProjectDueDateStatus(editFormData.due_date, editingProject ? editingProject.status : 'Active');
                      return (
                        <div 
                          className="date-preview-badge"
                          style={{
                            backgroundColor: st.bg,
                            color: st.color,
                            borderColor: st.border
                          }}
                        >
                          {st.status === 'overdue' ? <AlertCircle size={13} /> : <Clock size={13} />}
                          <span>{st.status === 'overdue' ? `⚠️ Date is overdue by ${st.daysOverdue} days` : st.label}</span>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Project Status</label>
                    <select 
                      name="status" 
                      value={editFormData.status || 'Assigned'} 
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                      className="form-select"
                    >
                      <option value="Assigned">Assigned</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Pending">Pending</option>
                      <option value="Submitted for Review">Submitted for Review</option>
                      <option value="Revision Requested">Revision Requested</option>
                      <option value="Deadline Confirmed">Deadline Confirmed</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Revision Cycles</label>
                    <input 
                      type="number" 
                      name="revision_cycles_included" 
                      value={editFormData.revision_cycles_included || 0} 
                      onChange={(e) => setEditFormData({ ...editFormData, revision_cycles_included: e.target.value })} 
                      min="0" 
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Description & Terms */}
              <div className="form-section-card">
                <div className="form-section-header">
                  <FileText size={16} className="section-icon" />
                  <h3>4. Scope Brief & Deliverable Terms</h3>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea 
                    name="description" 
                    value={editFormData.description || ''} 
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} 
                    rows="3"
                    className="form-textarea"
                  ></textarea>
                </div>

                <div className="form-group">
                  <label className="form-label">Terms & Conditions</label>
                  <textarea 
                    name="terms_and_conditions" 
                    value={editFormData.terms_and_conditions || ''} 
                    onChange={(e) => setEditFormData({ ...editFormData, terms_and_conditions: e.target.value })} 
                    rows="2"
                    className="form-textarea"
                  ></textarea>
                </div>
              </div>

              {/* Actions */}
              <div className="modal-footer-actions">
                <button 
                  type="button" 
                  className="action-btn secondary-btn" 
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="action-btn primary-add-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={15} className="spin" />
                      <span>Updating Project...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Update Project</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
