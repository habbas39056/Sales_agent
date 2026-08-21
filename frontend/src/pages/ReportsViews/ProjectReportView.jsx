import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  FileSpreadsheet, Download, RefreshCw, AlertTriangle, CheckCircle,
  TrendingUp, TrendingDown, DollarSign, Award, Target, Layers,
  BarChart2, PieChart as PieChartIcon, Search, Filter, ChevronRight,
  Eye, X, ShoppingBag, Briefcase, Users, FileText, ArrowUpRight,
  ArrowDownRight, HelpCircle, MessageCircle, Mail, Calendar, Clock,
  FolderKanban, CheckSquare, AlertCircle, ShieldAlert, Sparkles
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Pagination from '../../components/Pagination';
import './ProjectReportView.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const STATUS_PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function ProjectReportView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data from backend
  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [servicesBreakdown, setServicesBreakdown] = useState([]);
  const [pmScorecard, setPmScorecard] = useState([]);

  // Sub-tab: 'projects-ledger' | 'service-matrix' | 'pm-scorecard'
  const [activeSubTab, setActiveSubTab] = useState('projects-ledger');

  // Date Range Filters
  const [datePreset, setDatePreset] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Search & Filter for Projects Ledger
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [healthFilter, setHealthFilter] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // 360° Project Modal
  const [selectedProject, setSelectedProject] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [projectDetails, setProjectDetails] = useState(null);

  // Handle Date Preset Change
  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(y, m, 1).toISOString().slice(0, 10);
      const lastDay = new Date(y, m + 1, 0).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'LAST_MONTH') {
      const firstDay = new Date(y, m - 1, 1).toISOString().slice(0, 10);
      const lastDay = new Date(y, m, 0).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'THIS_QUARTER') {
      const qMonth = Math.floor(m / 3) * 3;
      const firstDay = new Date(y, qMonth, 1).toISOString().slice(0, 10);
      const lastDay = new Date(y, qMonth + 3, 0).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'THIS_YEAR') {
      const firstDay = new Date(y, 0, 1).toISOString().slice(0, 10);
      const lastDay = new Date(y, 11, 31).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
    }
  };

  const fetchProjectReports = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/reports/projects`, {
        params: {
          start_date: startDate || undefined,
          end_date: endDate || undefined
        }
      });
      setSummary(res.data.summary || null);
      setProjects(res.data.projects || []);
      setServicesBreakdown(res.data.services_breakdown || []);
      setPmScorecard(res.data.pm_scorecard || []);
    } catch (err) {
      console.error('Error loading project reports:', err);
      setError(err.response?.data?.error || 'Failed to load project reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectReports();
  }, [startDate, endDate]);

  // Open 360° Project Modal
  const openProject360 = async (project) => {
    setSelectedProject(project);
    setModalLoading(true);
    try {
      const res = await axios.get(`${API_URL}/reports/projects/details/${project.id}`);
      setProjectDetails(res.data);
    } catch (err) {
      console.error('Error fetching project details:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const closeProject360 = () => {
    setSelectedProject(null);
    setProjectDetails(null);
  };

  // Format Currency PKR
  const fmt = (val) => {
    const n = Number(val || 0);
    return `Rs ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Filtered Projects Ledger
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch = (p.title && p.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.client_name && p.client_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.pm_name && p.pm_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.service_type && p.service_type.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
      const matchesHealth = healthFilter === 'ALL' || p.delivery_health === healthFilter;

      return matchesSearch && matchesStatus && matchesHealth;
    });
  }, [projects, searchTerm, statusFilter, healthFilter]);

  // Paginated Projects
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProjects.slice(start, start + itemsPerPage);
  }, [filteredProjects, currentPage, itemsPerPage]);

  // Chart Data: Services Revenue vs Cost vs Profit
  const serviceChartData = useMemo(() => {
    return servicesBreakdown.map(s => ({
      name: s.service.length > 14 ? s.service.slice(0, 13) + '…' : s.service,
      Revenue: s.revenue,
      Cost: s.cost,
      Profit: s.profit
    }));
  }, [servicesBreakdown]);

  // Chart Data: Status Donut
  const statusPieData = useMemo(() => {
    const map = {};
    projects.forEach(p => {
      const st = p.status || 'Assigned';
      map[st] = (map[st] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [projects]);

  // Export to Multi-Sheet Excel
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Project Profitability Ledger
    const projHeaders = [
      'Project ID', 'Project Title', 'Client Name', 'Business Name', 'Project Manager (PM)',
      'Service Type', 'Status', 'Completion %', 'Delivery Health', 'Revenue (PKR)',
      'Collected (PKR)', 'Employee Cost', 'Software Cost', 'Overhead', 'Total Cost',
      'Actual Profit (PKR)', 'Profit Margin %', 'Deadline'
    ];

    const projRows = projects.map(p => [
      p.id, p.title, p.client_name, p.business_name, p.pm_name,
      p.service_type, p.status, `${p.completion_pct}%`, p.delivery_health,
      p.revenue, p.collected_revenue, p.employee_cost, p.software_cost,
      p.allocated_overheads, p.total_cost, p.actual_profit, `${p.profit_margin_pct}%`,
      p.locked_deadline || '-'
    ]);

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Adwise Labs - Project Management & Profitability Report'],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      projHeaders,
      ...projRows
    ]), 'Project Profitability');

    // Sheet 2: Service Breakdown Matrix (Matching Reference Format)
    const srvHeaders = ['Service', 'Revenue (PKR)', 'Cost (PKR)', 'Profit (PKR)', 'Margin %', 'Total Projects', 'Completed', 'Active'];
    const srvRows = servicesBreakdown.map(s => [
      s.service, s.revenue, s.cost, s.profit, `${s.margin}%`, s.projects_count, s.completed_count, s.active_count
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Service Profitability Breakdown Matrix'], [], srvHeaders, ...srvRows]), 'Service Breakdown');

    // Sheet 3: PM Scorecard
    const pmHeaders = ['Project Manager', 'Total Projects', 'Active', 'Completed', 'Delayed', 'On-Time Rate %', 'Managed Revenue', 'Profit Generated', 'Avg Margin %'];
    const pmRows = pmScorecard.map(pm => [
      pm.pm_name, pm.total_projects, pm.active_projects, pm.completed_projects, pm.delayed_projects,
      `${pm.on_time_delivery_rate}%`, pm.total_revenue_managed, pm.total_profit_generated, `${pm.avg_margin_pct}%`
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['PM Delivery & Financial Scorecard'], [], pmHeaders, ...pmRows]), 'PM Performance');

    XLSX.writeFile(wb, `Project_Management_Profitability_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export to Corporate PDF
  const exportToPDF = () => {
    const doc = new jsPDF('landscape', 'pt', 'a4');

    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('Adwise Labs - Project Management & Profitability Audit', 30, 40);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleString()} | Delivery Health & Project Unit Economics`, 30, 56);

    const headers = ['Project Title', 'Client', 'PM', 'Service', 'Revenue', 'Total Cost', 'Actual Profit', 'Margin %', 'Progress', 'Health'];
    const body = projects.map(p => [
      p.title,
      p.client_name,
      p.pm_name,
      p.service_type,
      fmt(p.revenue),
      fmt(p.total_cost),
      fmt(p.actual_profit),
      `${p.profit_margin_pct}%`,
      `${p.completion_pct}%`,
      p.delivery_health
    ]);

    autoTable(doc, {
      startY: 75,
      head: [headers],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 30, right: 30 }
    });

    doc.save(`Project_Profitability_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="project-reports-view">
      {/* 1. Header & Date Range Controls */}
      <div className="project-header-panel">
        <div className="header-info">
          <div className="header-badge">
            <FolderKanban size={15} /> Delivery Health & Project Unit Profitability
          </div>
          <h1>Project Management Reports</h1>
          <p className="header-subtext">
            Monitor real-time project delivery, milestone completion %, project manager throughput, and exact project profitability (Revenue − Employee Cost − Software Cost − Overheads).
          </p>
        </div>

        <div className="header-action-group">
          {/* Start & End Date Pickers */}
          <div className="date-filter-container">
            <div className="preset-selector-wrap">
              <Calendar size={15} color="#64748b" />
              <select value={datePreset} onChange={(e) => handlePresetChange(e.target.value)}>
                <option value="ALL">All Time</option>
                <option value="THIS_MONTH">This Month</option>
                <option value="LAST_MONTH">Last Month</option>
                <option value="THIS_QUARTER">This Quarter</option>
                <option value="THIS_YEAR">This Fiscal Year</option>
                <option value="CUSTOM">Custom Range</option>
              </select>
            </div>

            <div className="date-inputs-group">
              <div className="date-field-wrap">
                <span className="date-label">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setDatePreset('CUSTOM'); }}
                  className="date-input-field"
                />
              </div>
              <div className="date-field-wrap">
                <span className="date-label">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setDatePreset('CUSTOM'); }}
                  className="date-input-field"
                />
              </div>
              {(startDate || endDate) && (
                <button
                  className="btn-clear-date"
                  onClick={() => handlePresetChange('ALL')}
                  title="Clear Date Filter"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <button className="btn-export btn-export-excel" onClick={exportToExcel} title="Export full workbook">
            <FileSpreadsheet size={16} /> Export Excel
          </button>
          <button className="btn-export btn-export-pdf" onClick={exportToPDF} title="Download certified PDF statement">
            <Download size={16} /> Export PDF
          </button>
          <button className="btn-refresh" onClick={fetchProjectReports} title="Refresh project reports">
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {error && <div className="error-banner"><AlertTriangle size={18} /> {error}</div>}

      {/* 2. Macro Delivery & Financial KPI Cards (6 Cards) */}
      <div className="project-kpi-grid">
        {/* Card 1: Active Projects */}
        <div className="proj-kpi-card card-blue">
          <div className="card-top">
            <span className="card-title">Active Projects</span>
            <div className="card-icon"><Briefcase size={20} /></div>
          </div>
          <h2 className="card-value text-blue">{summary?.active_projects || 0}</h2>
          <div className="card-meta">
            <span className="meta-pill blue">In-Flight Delivery</span>
          </div>
        </div>

        {/* Card 2: Completed Deliverables */}
        <div className="proj-kpi-card card-green">
          <div className="card-top">
            <span className="card-title">Completed Projects</span>
            <div className="card-icon"><CheckCircle size={20} /></div>
          </div>
          <h2 className="card-value text-green">{summary?.completed_projects || 0}</h2>
          <div className="card-meta">
            <span className="meta-pill green">Delivered & Signed Off</span>
          </div>
        </div>

        {/* Card 3: Delayed / Overdue */}
        <div className="proj-kpi-card card-red">
          <div className="card-top">
            <span className="card-title">Delayed / At Risk</span>
            <div className="card-icon"><AlertTriangle size={20} /></div>
          </div>
          <h2 className="card-value text-red">{summary?.delayed_projects || 0}</h2>
          <div className="card-meta">
            <span className="meta-pill red">Requires PM Attention</span>
          </div>
        </div>

        {/* Card 4: Portfolio Revenue */}
        <div className="proj-kpi-card card-purple">
          <div className="card-top">
            <span className="card-title">Project Portfolio Revenue</span>
            <div className="card-icon"><DollarSign size={20} /></div>
          </div>
          <h2 className="card-value text-purple">{fmt(summary?.total_portfolio_revenue)}</h2>
          <div className="card-meta">
            <span className="meta-pill purple">Total Project Invoiced</span>
          </div>
        </div>

        {/* Card 5: Project Delivery Costs */}
        <div className="proj-kpi-card card-orange">
          <div className="card-top">
            <span className="card-title">Total Delivery Costs</span>
            <div className="card-icon"><ArrowDownRight size={20} /></div>
          </div>
          <h2 className="card-value text-orange">{fmt(summary?.total_portfolio_cost)}</h2>
          <div className="card-meta">
            <span className="meta-pill orange">Labor + Tools + Overheads</span>
          </div>
        </div>

        {/* Card 6: Net Project Profit */}
        <div className="proj-kpi-card card-gold">
          <div className="card-top">
            <span className="card-title">Actual Project Profit</span>
            <div className="card-icon"><TrendingUp size={20} /></div>
          </div>
          <h2 className="card-value text-gold">{fmt(summary?.total_portfolio_profit)}</h2>
          <div className="card-meta">
            <span className="meta-pill gold">Margin: {summary?.blended_portfolio_margin || 0}%</span>
          </div>
        </div>
      </div>

      {/* 3. Visual Analytics Row */}
      <div className="analytics-dual-charts-grid">
        {/* Left Chart: Service Revenue vs Cost vs Profit (Matching User's Reference) */}
        <div className="chart-container-card">
          <div className="chart-card-header">
            <h4>
              <BarChart2 size={18} color="#2563eb" /> Service Profitability Comparison (PKR)
            </h4>
          </div>
          <div style={{ height: '270px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serviceChartData} margin={{ top: 15, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(val) => `Rs ${(val / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(val) => [`Rs ${Number(val).toLocaleString()}`, '']} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="Cost" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="Profit" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Chart: Delivery Status Donut */}
        <div className="chart-container-card">
          <div className="chart-card-header">
            <h4>
              <PieChartIcon size={18} color="#8b5cf6" /> Project Status & Delivery Breakdown
            </h4>
          </div>
          <div style={{ height: '270px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_PIE_COLORS[index % STATUS_PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => [`${val} Projects`, 'Count']} />
                <Legend wrapperStyle={{ fontSize: '11px' }} layout="horizontal" align="center" verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. Sub-Navigation Tabs */}
      <div className="acct-view-tabs-bar">
        <button
          className={`acct-view-tab ${activeSubTab === 'projects-ledger' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('projects-ledger')}
        >
          <Briefcase size={16} /> Project Profitability & Health Ledger ({projects.length})
        </button>
        <button
          className={`acct-view-tab ${activeSubTab === 'service-matrix' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('service-matrix')}
        >
          <Layers size={16} /> Service Economics Matrix ({servicesBreakdown.length})
        </button>
        <button
          className={`acct-view-tab ${activeSubTab === 'pm-scorecard' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('pm-scorecard')}
        >
          <Users size={16} /> Project Manager (PM) Scorecard ({pmScorecard.length})
        </button>
      </div>

      {/* 5. TAB 1: Project Profitability Ledger */}
      {activeSubTab === 'projects-ledger' && (
        <div className="service-matrix-card">
          <div className="matrix-header-bar">
            <div>
              <h4>Comprehensive Project Profitability & Delivery Ledger</h4>
              <p>Showing {filteredProjects.length} client projects with unit labor, software cost, and actual net profit</p>
            </div>

            <div className="matrix-filters-row">
              <div className="search-input-wrap">
                <Search size={15} color="#64748b" />
                <input
                  type="text"
                  placeholder="Search project, client, PM, service..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
              </div>

              <select
                className="tier-filter-dropdown"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="ALL">All Statuses</option>
                <option value="Assigned">Assigned</option>
                <option value="In Progress">In Progress</option>
                <option value="Production">Production</option>
                <option value="Completed">Completed</option>
              </select>

              <select
                className="tier-filter-dropdown"
                value={healthFilter}
                onChange={(e) => { setHealthFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="ALL">All Health States</option>
                <option value="On Track">On Track</option>
                <option value="Completed">Completed</option>
                <option value="At Risk">At Risk</option>
                <option value="Delayed / Overdue">Delayed / Overdue</option>
              </select>
            </div>
          </div>

          <div className="table-responsive-wrapper" style={{ overflowX: 'auto' }}>
            <table className="modern-service-table">
              <thead>
                <tr>
                  <th>Project Title</th>
                  <th>Client Name</th>
                  <th>Project Manager</th>
                  <th>Service Line</th>
                  <th style={{ textAlign: 'right' }}>Revenue</th>
                  <th style={{ textAlign: 'right' }}>Total Cost</th>
                  <th style={{ textAlign: 'right' }}>Actual Profit</th>
                  <th style={{ textAlign: 'center' }}>Margin %</th>
                  <th style={{ textAlign: 'center' }}>Progress</th>
                  <th style={{ textAlign: 'center' }}>Health</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProjects.length === 0 ? (
                  <tr><td colSpan="11" className="table-empty-cell">No matching project records found.</td></tr>
                ) : (
                  paginatedProjects.map((p, idx) => (
                    <tr key={idx} className="service-row-hover">
                      <td>
                        <div className="service-name-cell">
                          <FolderKanban size={15} color="#2563eb" />
                          <div>
                            <strong>{p.title}</strong>
                            <div style={{ fontSize: '0.725rem', color: '#64748b' }}>ID: #{p.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{p.client_name}</div>
                        {p.business_name && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.business_name}</div>}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#334155' }}>{p.pm_name}</div>
                      </td>
                      <td>
                        <span className="obligation-tag">{p.service_type}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{fmt(p.revenue)}</td>
                      <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{fmt(p.total_cost)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: p.actual_profit >= 0 ? '#10b981' : '#ef4444' }}>
                        {fmt(p.actual_profit)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`margin-pill ${p.profit_margin_pct >= 60 ? 'margin-high' : (p.profit_margin_pct >= 35 ? 'margin-mid' : 'margin-low')}`}>
                          {p.profit_margin_pct}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="progress-bar-wrapper">
                          <div className="progress-bar-track">
                            <div className="progress-bar-fill" style={{ width: `${p.completion_pct}%` }}></div>
                          </div>
                          <span className="progress-text">{p.completion_pct}%</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`health-pill health-${p.delivery_health.toLowerCase().replace(/[^a-z]/g, '-')}`}>
                          {p.delivery_health}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn-view-360"
                          onClick={() => openProject360(p)}
                          title="View 360° Project Intelligence"
                        >
                          <Eye size={14} /> 360° View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          <div className="ledger-pagination-bar">
            <div className="pagination-left-controls">
              <span className="pagination-showing-text">
                Showing <strong>{filteredProjects.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</strong> to <strong>{Math.min(currentPage * itemsPerPage, filteredProjects.length)}</strong> of <strong>{filteredProjects.length}</strong> projects
              </span>
              <div className="rows-per-page-selector">
                <label>Rows per page:</label>
                <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
            <Pagination
              currentPage={currentPage}
              totalItems={filteredProjects.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}

      {/* 6. TAB 2: Service Economics Matrix (Exact Layout from User Reference Image) */}
      {activeSubTab === 'service-matrix' && (
        <div className="statement-sheet-card">
          <div className="statement-sheet-header">
            <h3>Service Economics & Profitability Matrix</h3>
            <p>Compare revenue, cost, net profit, and margin % across agency service lines to decide which services to push harder.</p>
          </div>

          <table className="financial-statement-table">
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '0.85rem 1.5rem', textAlign: 'left' }}>Service</th>
                <th style={{ textAlign: 'right' }}>Revenue</th>
                <th style={{ textAlign: 'right' }}>Cost</th>
                <th style={{ textAlign: 'right' }}>Profit</th>
                <th style={{ textAlign: 'center' }}>Margin</th>
                <th style={{ textAlign: 'center', paddingRight: '1.5rem' }}>Active / Completed</th>
              </tr>
            </thead>
            <tbody>
              {servicesBreakdown.map((s, idx) => (
                <tr key={idx}>
                  <td style={{ paddingLeft: '1.5rem', fontWeight: 700, color: '#0f172a' }}>{s.service}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{fmt(s.revenue)}</td>
                  <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{fmt(s.cost)}</td>
                  <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 800 }}>{fmt(s.profit)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`margin-pill ${s.margin >= 60 ? 'margin-high' : 'margin-mid'}`}>
                      {s.margin}%
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', paddingRight: '1.5rem', color: '#64748b', fontWeight: 600 }}>
                    {s.active_count} Active / {s.completed_count} Completed
                  </td>
                </tr>
              ))}
              <tr className="statement-grand-total-row">
                <td style={{ paddingLeft: '1.5rem', fontWeight: 800 }}>TOTAL PORTFOLIO</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>{fmt(summary?.total_portfolio_revenue)}</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>{fmt(summary?.total_portfolio_cost)}</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: '#10b981' }}>{fmt(summary?.total_portfolio_profit)}</td>
                <td style={{ textAlign: 'center', fontWeight: 800, color: '#2563eb' }}>{summary?.blended_portfolio_margin}%</td>
                <td style={{ textAlign: 'center', paddingRight: '1.5rem', fontWeight: 700 }}>{summary?.total_projects} Total Projects</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 7. TAB 3: PM Performance Scorecard */}
      {activeSubTab === 'pm-scorecard' && (
        <div className="statement-sheet-card">
          <div className="statement-sheet-header">
            <h3>Project Manager (PM) Performance Scorecard</h3>
            <p>Throughput, on-time delivery rate, managed revenue, and generated project profit by PM.</p>
          </div>

          <table className="financial-statement-table">
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '0.85rem 1.5rem', textAlign: 'left' }}>Project Manager</th>
                <th style={{ textAlign: 'center' }}>Total Projects</th>
                <th style={{ textAlign: 'center' }}>Active</th>
                <th style={{ textAlign: 'center' }}>Completed</th>
                <th style={{ textAlign: 'center' }}>On-Time Delivery Rate</th>
                <th style={{ textAlign: 'right' }}>Revenue Managed</th>
                <th style={{ textAlign: 'right' }}>Profit Generated</th>
                <th style={{ textAlign: 'center', paddingRight: '1.5rem' }}>Avg Margin</th>
              </tr>
            </thead>
            <tbody>
              {pmScorecard.map((pm, idx) => (
                <tr key={idx}>
                  <td style={{ paddingLeft: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <Users size={15} color="#2563eb" />
                      {pm.pm_name}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{pm.total_projects}</td>
                  <td style={{ textAlign: 'center', color: '#2563eb', fontWeight: 600 }}>{pm.active_projects}</td>
                  <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 600 }}>{pm.completed_projects}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`rate-pill ${pm.on_time_delivery_rate >= 80 ? 'rate-high' : 'rate-mid'}`}>
                      {pm.on_time_delivery_rate}%
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(pm.total_revenue_managed)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#10b981' }}>{fmt(pm.total_profit_generated)}</td>
                  <td style={{ textAlign: 'center', paddingRight: '1.5rem' }}>
                    <span className="margin-pill margin-high">{pm.avg_margin_pct}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 8. 360° Project Intelligence Modal */}
      {selectedProject && (
        <div className="service-modal-overlay" onClick={closeProject360}>
          <div className="service-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="service-modal-header">
              <div className="modal-title-group">
                <div className="service-icon-box"><FolderKanban size={24} color="#2563eb" /></div>
                <div>
                  <h3>{selectedProject.title} - 360° Project Intelligence</h3>
                  <p>Client: {selectedProject.client_name} • PM: {selectedProject.pm_name} • Health: {selectedProject.delivery_health}</p>
                </div>
              </div>
              <button className="btn-close-modal" onClick={closeProject360}>
                <X size={20} />
              </button>
            </div>

            <div className="service-modal-body">
              {/* Modal KPIs */}
              <div className="modal-kpi-row">
                <div className="modal-kpi-box">
                  <span className="mkpi-label">Project Revenue</span>
                  <span className="mkpi-val text-blue">{fmt(selectedProject.revenue)}</span>
                </div>
                <div className="modal-kpi-box">
                  <span className="mkpi-label">Labor + Tools Cost</span>
                  <span className="mkpi-val text-red">{fmt(selectedProject.total_cost)}</span>
                </div>
                <div className="modal-kpi-box">
                  <span className="mkpi-label">Actual Profit</span>
                  <span className="mkpi-val text-green">{fmt(selectedProject.actual_profit)}</span>
                </div>
                <div className="modal-kpi-box">
                  <span className="mkpi-label">Profit Margin</span>
                  <span className="mkpi-val text-purple">{selectedProject.profit_margin_pct}%</span>
                </div>
                <div className="modal-kpi-box">
                  <span className="mkpi-label">Completion %</span>
                  <span className="mkpi-val text-teal">{selectedProject.completion_pct}%</span>
                </div>
              </div>

              {/* Unit Cost Waterfall Breakdown Box */}
              <div className="waterfall-cost-box">
                <h4>Unit Cost & Profit Waterfall Breakdown</h4>
                <div className="waterfall-items-grid">
                  <div className="wf-item">
                    <span>Gross Billed Revenue:</span>
                    <strong>{fmt(selectedProject.revenue)}</strong>
                  </div>
                  <div className="wf-item text-red">
                    <span>− Employee Labor Cost:</span>
                    <strong>{fmt(selectedProject.employee_cost)}</strong>
                  </div>
                  <div className="wf-item text-red">
                    <span>− Software / Tool Spend:</span>
                    <strong>{fmt(selectedProject.software_cost)}</strong>
                  </div>
                  <div className="wf-item text-red">
                    <span>− Allocated Overheads:</span>
                    <strong>{fmt(selectedProject.allocated_overheads)}</strong>
                  </div>
                  <div className="wf-item total-wf-item">
                    <span>= Actual Net Project Profit:</span>
                    <strong className="text-green">{fmt(selectedProject.actual_profit)} ({selectedProject.profit_margin_pct}%)</strong>
                  </div>
                </div>
              </div>

              {/* Milestones / Steps in Modal */}
              <div className="modal-transactions-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4>Project Delivery Milestones & Tasks</h4>
                  {selectedProject.client_phone && (
                    <a
                      href={`https://wa.me/${selectedProject.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                        `*PROJECT STATUS UPDATE - ADWISE LABS*\n\n` +
                        `Dear *${selectedProject.client_name}*,\n\n` +
                        `Here is your live project delivery update for *${selectedProject.title}*:\n` +
                        `📌 *Service:* ${selectedProject.service_type}\n` +
                        `📊 *Progress:* ${selectedProject.completion_pct}% Complete\n` +
                        `⏱️ *Status:* ${selectedProject.status}\n` +
                        `📅 *Deadline:* ${selectedProject.locked_deadline || 'Scheduled'}\n\n` +
                        `Thank you!\n*Adwise Labs Project Team*`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="modal-btn-whatsapp"
                    >
                      <MessageCircle size={14} color="#10b981" /> Send WhatsApp Progress Update
                    </a>
                  )}
                </div>

                {modalLoading ? (
                  <div className="modal-loading-state"><RefreshCw size={24} className="spinning" /> Loading milestones...</div>
                ) : (
                  <div className="table-responsive-wrapper" style={{ maxHeight: '260px', overflowY: 'auto' }}>
                    <table className="modern-service-table">
                      <thead>
                        <tr>
                          <th>Milestone / Task</th>
                          <th>Assignee</th>
                          <th>Deadline</th>
                          <th style={{ textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!projectDetails || projectDetails.steps.length === 0 ? (
                          <tr><td colSpan="4" className="table-empty-cell">No milestone steps created for this project yet.</td></tr>
                        ) : (
                          projectDetails.steps.map((step, i) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 700, color: '#0f172a' }}>{step.title}</td>
                              <td>{step.assignee_name || 'Unassigned'}</td>
                              <td>{step.deadline ? step.deadline.slice(0, 10) : '-'}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`step-status-pill step-${(step.status || 'pending').toLowerCase().replace(/\s+/g, '-')}`}>
                                  {step.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
