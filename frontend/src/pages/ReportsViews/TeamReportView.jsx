import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Users, DollarSign, TrendingUp, AlertTriangle, CheckCircle, Clock,
  Download, Search, RefreshCw, BarChart2, PieChart as PieChartIcon,
  ChevronRight, X, Phone, Mail, FolderKanban, FileText, ArrowUpRight,
  Briefcase, Activity, Calendar, Award, CheckSquare, Zap, UserCheck
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Pagination from '../../components/Pagination';
import './TeamReportView.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const DONUT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

export default function TeamReportView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Server Data
  const [teamData, setTeamData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [topContributors, setTopContributors] = useState([]);
  const [departmentBreakdown, setDepartmentBreakdown] = useState([]);

  // Filters
  const [activePreset, setActivePreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [performanceFilter, setPerformanceFilter] = useState('all');
  const [utilizationFilter, setUtilizationFilter] = useState('all');
  const [sortBy, setSortBy] = useState('contribution_desc');

  // Main Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // 360 Drilldown Modal State
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailTab, setDetailTab] = useState('overview'); // overview, projects, tasks, invoices

  // Modal Sub-tab Pagination
  const [modalProjPage, setModalProjPage] = useState(1);
  const [modalTaskPage, setModalTaskPage] = useState(1);
  const [modalInvPage, setModalInvPage] = useState(1);
  const modalItemsPerPage = 6;

  const fetchTeamReport = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const res = await axios.get(`${API_URL}/reports/team?${params.toString()}`);
      setTeamData(res.data.team || []);
      setSummary(res.data.summary || null);
      setTopContributors(res.data.top_contributors || []);
      setDepartmentBreakdown(res.data.department_breakdown || []);
    } catch (err) {
      console.error('Error fetching team report:', err);
      setError(err.response?.data?.error || 'Failed to load employee/team report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamReport();
  }, [startDate, endDate]);

  // Handle Preset Changes
  const applyPreset = (preset) => {
    setActivePreset(preset);
    const now = new Date();
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const todayStr = now.toISOString().slice(0, 10);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    } else if (preset === 'thisMonth') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(first.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    } else if (preset === 'lastMonth') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(first.toISOString().slice(0, 10));
      setEndDate(last.toISOString().slice(0, 10));
    } else if (preset === 'thisYear') {
      const first = new Date(now.getFullYear(), 0, 1);
      setStartDate(first.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    }
  };

  // Open 360 Drilldown
  const openUser360 = async (userId) => {
    setSelectedUserId(userId);
    setLoadingDetail(true);
    setDetailTab('overview');
    setModalProjPage(1);
    setModalTaskPage(1);
    setModalInvPage(1);
    try {
      const res = await axios.get(`${API_URL}/reports/team/${userId}/details`);
      setUserDetail(res.data);
    } catch (err) {
      console.error('Failed to fetch employee 360 view:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeUser360 = () => {
    setSelectedUserId(null);
    setUserDetail(null);
  };

  // Unique Roles for Dropdown
  const availableRoles = useMemo(() => {
    const set = new Set(teamData.map(t => t.role).filter(Boolean));
    return Array.from(set);
  }, [teamData]);

  // Filtered & Sorted Team
  const filteredTeam = useMemo(() => {
    let result = [...teamData];

    // 1. Search Filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t =>
        (t.name && t.name.toLowerCase().includes(term)) ||
        (t.role && t.role.toLowerCase().includes(term)) ||
        (t.email && t.email.toLowerCase().includes(term)) ||
        (t.whatsapp_number && t.whatsapp_number.toLowerCase().includes(term))
      );
    }

    // 2. Role Filter
    if (roleFilter !== 'all') {
      result = result.filter(t => t.role === roleFilter);
    }

    // 3. Performance Filter
    if (performanceFilter !== 'all') {
      result = result.filter(t => t.performance_tier === performanceFilter);
    }

    // 4. Utilization Filter
    if (utilizationFilter !== 'all') {
      result = result.filter(t => t.utilization_status === utilizationFilter);
    }

    // 5. Sorting
    result.sort((a, b) => {
      if (sortBy === 'contribution_desc') return b.net_contribution - a.net_contribution;
      if (sortBy === 'contribution_asc') return a.net_contribution - b.net_contribution;
      if (sortBy === 'revenue_desc') return b.billable_revenue_generated - a.billable_revenue_generated;
      if (sortBy === 'cost_desc') return b.cost_to_company - a.cost_to_company;
      if (sortBy === 'roi_desc') return b.roi_multiple - a.roi_multiple;
      if (sortBy === 'tasks_desc') return b.tasks_completed - a.tasks_completed;
      if (sortBy === 'projects_desc') return b.projects_completed - a.projects_completed;
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      return 0;
    });

    return result;
  }, [teamData, searchTerm, roleFilter, performanceFilter, utilizationFilter, sortBy]);

  // Paginated Team
  const paginatedTeam = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTeam.slice(start, start + itemsPerPage);
  }, [filteredTeam, currentPage, itemsPerPage]);

  // Table Totals
  const tableTotals = useMemo(() => {
    return filteredTeam.reduce((acc, t) => ({
      tasks_assigned: acc.tasks_assigned + t.tasks_assigned,
      tasks_completed: acc.tasks_completed + t.tasks_completed,
      tasks_overdue: acc.tasks_overdue + t.tasks_overdue,
      projects_assigned: acc.projects_assigned + t.projects_assigned,
      projects_completed: acc.projects_completed + t.projects_completed,
      revenue: acc.revenue + t.billable_revenue_generated,
      cost: acc.cost + t.cost_to_company,
      contribution: acc.contribution + t.net_contribution
    }), {
      tasks_assigned: 0,
      tasks_completed: 0,
      tasks_overdue: 0,
      projects_assigned: 0,
      projects_completed: 0,
      revenue: 0,
      cost: 0,
      contribution: 0
    });
  }, [filteredTeam]);

  // Export to Excel
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summaryRows = [
      ['Adwise Labs - Employee Performance & Workforce Intelligence Report'],
      ['Generated On', new Date().toLocaleString()],
      ['Timeframe', `${startDate || 'All Time'} to ${endDate || 'Present'}`],
      [''],
      ['Workforce Metric', 'Value'],
      ['Total Active Headcount', summary?.total_headcount || 0],
      ['Total Billable Revenue Generated (PKR)', summary?.total_revenue_generated || 0],
      ['Total Workforce Cost (CTC) (PKR)', summary?.total_cost_to_company || 0],
      ['Net Agency Value Add / Contribution (PKR)', summary?.net_contribution || 0],
      ['Portfolio ROI Multiple', `${summary?.portfolio_roi || 0}x`],
      ['Total Tasks Completed', `${summary?.total_tasks_completed || 0} of ${summary?.total_tasks_assigned || 0}`],
      ['Overall Task Efficiency (%)', `${summary?.overall_task_efficiency || 0}%`],
      ['Average Revenue per Employee (ARPE) (PKR)', summary?.avg_revenue_per_employee || 0]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

    // Sheet 2: Employee Matrix
    const employeeRows = filteredTeam.map((t, idx) => ({
      '#': idx + 1,
      'Employee Name': t.name,
      'Role / Department': t.role,
      'Email': t.email,
      'Contact Phone': t.whatsapp_number,
      'Tasks Assigned': t.tasks_assigned,
      'Tasks Completed': t.tasks_completed,
      'Tasks Overdue': t.tasks_overdue,
      'Task Efficiency (%)': `${t.task_efficiency}%`,
      'Projects Assigned': t.projects_assigned,
      'Projects Completed': t.projects_completed,
      'Active Projects': t.projects_active,
      'Billable Revenue Generated (PKR)': t.billable_revenue_generated,
      'Cost to Company (CTC) (PKR)': t.cost_to_company,
      'Net Contribution (PKR)': t.net_contribution,
      'ROI Multiple': `${t.roi_multiple}x`,
      'Performance Tier': t.performance_tier,
      'Utilization Status': t.utilization_status
    }));
    const wsEmployees = XLSX.utils.json_to_sheet(employeeRows);
    XLSX.utils.book_append_sheet(wb, wsEmployees, 'Employee Performance');

    // Sheet 3: Department Breakdown
    const deptRows = (departmentBreakdown || []).map(d => ({
      'Department / Role': d.role,
      'Headcount': d.headcount,
      'Revenue Generated (PKR)': d.revenue,
      'Cost to Company (PKR)': d.cost,
      'Net Profit Contribution (PKR)': d.profit,
      'Tasks Completed': d.tasks_completed,
      'Revenue Share (%)': `${d.share}%`
    }));
    const wsDept = XLSX.utils.json_to_sheet(deptRows);
    XLSX.utils.book_append_sheet(wb, wsDept, 'Department Economics');

    XLSX.writeFile(wb, `Employee_Team_Performance_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF('landscape', 'pt', 'a4');

    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('Employee & Team Workforce Intelligence Report', 40, 45);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleString()} | Period: ${startDate || 'All Time'} - ${endDate || 'Present'}`, 40, 62);

    // Summary Header Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(40, 75, 762, 45, 6, 6, 'F');

    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('HEADCOUNT', 55, 92);
    doc.text('REVENUE GENERATED', 170, 92);
    doc.text('WORKFORCE COST (CTC)', 320, 92);
    doc.text('NET CONTRIBUTION', 470, 92);
    doc.text('PORTFOLIO ROI', 610, 92);
    doc.text('TASK EFFICIENCY', 710, 92);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${summary?.total_headcount || 0} Members`, 55, 110);
    doc.setTextColor(16, 185, 129);
    doc.text(`PKR ${(summary?.total_revenue_generated || 0).toLocaleString()}`, 170, 110);
    doc.setTextColor(245, 158, 11);
    doc.text(`PKR ${(summary?.total_cost_to_company || 0).toLocaleString()}`, 320, 110);
    doc.setTextColor(139, 92, 246);
    doc.text(`PKR ${(summary?.net_contribution || 0).toLocaleString()}`, 470, 110);
    doc.setTextColor(59, 130, 246);
    doc.text(`${summary?.portfolio_roi || 0}x ROI`, 610, 110);
    doc.setTextColor(16, 185, 129);
    doc.text(`${summary?.overall_task_efficiency || 0}%`, 710, 110);

    const tableBody = filteredTeam.map(t => [
      t.name,
      t.role,
      `${t.tasks_completed} / ${t.tasks_assigned} (${t.tasks_overdue} late)`,
      `${t.projects_completed} / ${t.projects_assigned}`,
      `PKR ${t.billable_revenue_generated.toLocaleString()}`,
      `PKR ${t.cost_to_company.toLocaleString()}`,
      `PKR ${t.net_contribution.toLocaleString()}`,
      `${t.roi_multiple}x`,
      t.performance_tier,
      t.utilization_status
    ]);

    autoTable(doc, {
      startY: 135,
      head: [['Employee', 'Role', 'Tasks (Done/Total)', 'Projects', 'Revenue Generated', 'Cost (CTC)', 'Net Value Add', 'ROI', 'Performance', 'Workload']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 40, right: 40 }
    });

    doc.save(`Employee_Team_Performance_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="professional-team-report">
      {/* 1. Header Panel */}
      <div className="team-header-panel">
        <div className="header-info">
          <div className="header-badge">
            <Users size={15} /> Workforce Intelligence & Unit Economics
          </div>
          <h1>Employee & Team Performance</h1>
          <p className="header-subtext">
            Granular agency workforce analytics: billable revenue contribution, cost-to-company (CTC), task throughput, project delivery, and productivity multiples.
          </p>
        </div>

        <div className="header-action-group">
          <button className="btn-export btn-export-excel" onClick={exportToExcel} title="Export multi-sheet Excel workbook">
            <Download size={16} /> Export Excel (.xlsx)
          </button>
          <button className="btn-export btn-export-pdf" onClick={exportToPDF} title="Download corporate PDF statement">
            <Download size={16} /> Export PDF (.pdf)
          </button>
          <button className="btn-refresh" onClick={fetchTeamReport} title="Refresh live data">
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Macro Workforce KPI Cards (7 Cards) */}
      <div className="team-kpi-grid">
        {/* Card 1: Headcount */}
        <div className="team-kpi-card card-blue">
          <div className="card-top">
            <span className="card-title">Total Active Workforce</span>
            <div className="card-icon"><Users size={20} /></div>
          </div>
          <h2 className="card-value">{summary?.total_headcount || 0} Members</h2>
          <div className="card-meta">
            <span className="meta-pill blue">
              <UserCheck size={12} /> Active Headcount
            </span>
          </div>
        </div>

        {/* Card 2: Revenue Generated */}
        <div className="team-kpi-card card-green">
          <div className="card-top">
            <span className="card-title">Billable Revenue Generated</span>
            <div className="card-icon"><DollarSign size={20} /></div>
          </div>
          <h2 className="card-value text-green">PKR {(summary?.total_revenue_generated || 0).toLocaleString()}</h2>
          <div className="card-meta">
            <span className="meta-pill green">
              <ArrowUpRight size={12} /> Agency Topline Inflow
            </span>
          </div>
        </div>

        {/* Card 3: Total Workforce Cost */}
        <div className="team-kpi-card card-orange">
          <div className="card-top">
            <span className="card-title">Total Workforce Cost (CTC)</span>
            <div className="card-icon"><Briefcase size={20} /></div>
          </div>
          <h2 className="card-value text-orange">PKR {(summary?.total_cost_to_company || 0).toLocaleString()}</h2>
          <div className="card-meta">
            <span className="meta-pill orange">
              Salaries + Commissions
            </span>
          </div>
        </div>

        {/* Card 4: Net Value Add */}
        <div className="team-kpi-card card-purple">
          <div className="card-top">
            <span className="card-title">Net Agency Contribution</span>
            <div className="card-icon"><Award size={20} /></div>
          </div>
          <h2 className="card-value text-purple">PKR {(summary?.net_contribution || 0).toLocaleString()}</h2>
          <div className="card-meta">
            <span className="meta-pill purple">
              Net Value Add
            </span>
          </div>
        </div>

        {/* Card 5: Portfolio ROI Multiple */}
        <div className="team-kpi-card card-teal">
          <div className="card-top">
            <span className="card-title">Portfolio ROI Multiple</span>
            <div className="card-icon"><TrendingUp size={20} /></div>
          </div>
          <h2 className="card-value text-teal">{summary?.portfolio_roi || 0}x</h2>
          <div className="card-meta">
            <span className="meta-pill teal">
              <Zap size={12} /> Return on Payroll
            </span>
          </div>
        </div>

        {/* Card 6: Task Throughput Efficiency */}
        <div className="team-kpi-card card-indigo">
          <div className="card-top">
            <span className="card-title">Task Execution Rate</span>
            <div className="card-icon"><CheckSquare size={20} /></div>
          </div>
          <h2 className="card-value">{summary?.overall_task_efficiency || 0}%</h2>
          <div className="card-meta">
            <span className="meta-pill blue">
              <CheckCircle size={12} /> {summary?.total_tasks_completed || 0} of {summary?.total_tasks_assigned || 0} Done
            </span>
          </div>
        </div>

        {/* Card 7: ARPE */}
        <div className="team-kpi-card card-pink">
          <div className="card-top">
            <span className="card-title">Avg Rev Per Employee (ARPE)</span>
            <div className="card-icon"><BarChart2 size={20} /></div>
          </div>
          <h2 className="card-value">PKR {Math.round(summary?.avg_revenue_per_employee || 0).toLocaleString()}</h2>
          <div className="card-meta">
            <span className="meta-pill purple">
              Revenue Per Head
            </span>
          </div>
        </div>
      </div>

      {/* 3. Filter Toolbar */}
      <div className="team-filter-card">
        {/* Preset Row */}
        <div className="preset-pill-row">
          <span className="filter-row-label">Timeframe:</span>
          {[
            { id: 'all', label: 'All Time' },
            { id: 'today', label: 'Today' },
            { id: '30days', label: 'Last 30 Days' },
            { id: 'thisMonth', label: 'This Month' },
            { id: 'lastMonth', label: 'Last Month' },
            { id: 'thisYear', label: 'This Year' }
          ].map(p => (
            <button
              key={p.id}
              className={`preset-btn ${activePreset === p.id ? 'active' : ''}`}
              onClick={() => applyPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Filter Controls Grid */}
        <div className="filter-controls-grid">
          <div className="filter-field">
            <label><Calendar size={13} /> Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setActivePreset('custom'); }}
            />
          </div>

          <div className="filter-field">
            <label><Calendar size={13} /> End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setActivePreset('custom'); }}
            />
          </div>

          <div className="filter-field">
            <label><Briefcase size={13} /> Department / Role</label>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">All Departments / Roles</option>
              {availableRoles.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label><Award size={13} /> Performance Tier</label>
            <select value={performanceFilter} onChange={(e) => setPerformanceFilter(e.target.value)}>
              <option value="all">All Performance Tiers</option>
              <option value="Elite Performer">Elite Performers (3x+ ROI)</option>
              <option value="Solid Contributor">Solid Contributors</option>
              <option value="Review Needed">Review Needed / Low ROI</option>
            </select>
          </div>

          <div className="filter-field">
            <label><Activity size={13} /> Workload Utilization</label>
            <select value={utilizationFilter} onChange={(e) => setUtilizationFilter(e.target.value)}>
              <option value="all">All Workload States</option>
              <option value="Overloaded">Overloaded (&gt; 4 Projects / High Queue)</option>
              <option value="Optimal">Optimal Workload</option>
              <option value="Underutilized">Underutilized (&lt;= 1 Project)</option>
            </select>
          </div>

          <div className="filter-field">
            <label><TrendingUp size={13} /> Sort Team By</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="contribution_desc">Highest Net Contribution (Profit)</option>
              <option value="revenue_desc">Highest Revenue Generated</option>
              <option value="roi_desc">Highest ROI Multiple</option>
              <option value="tasks_desc">Most Tasks Completed</option>
              <option value="projects_desc">Most Projects Delivered</option>
              <option value="cost_desc">Highest Cost to Company (CTC)</option>
              <option value="name_asc">Employee Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Analytics Visualizations */}
      <div className="team-charts-row">
        {/* Chart 1: Revenue vs Cost vs Net Contribution */}
        <div className="team-chart-card">
          <div className="chart-header">
            <h3><BarChart2 size={18} /> Workforce Economics: Revenue vs. Cost (CTC) vs. Net Value Add</h3>
            <p className="chart-subtitle">Direct comparison of billable revenue brought in vs payroll costs per employee</p>
          </div>
          <div className="chart-container-box" style={{ height: '300px' }}>
            {topContributors.length === 0 ? (
              <div className="empty-chart-state">No workforce economic data available.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topContributors} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    interval={0}
                    tickFormatter={(name) => name.length > 12 ? `${name.substring(0, 12)}...` : name}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(val) => `PKR ${val > 999 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip
                    formatter={(value, name) => [`PKR ${Number(value).toLocaleString()}`, name]}
                    contentStyle={{ background: '#0f172a', color: '#fff', borderRadius: '8px', border: 'none' }}
                  />
                  <Legend />
                  <Bar dataKey="billable_revenue_generated" name="Revenue Generated" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cost_to_company" name="Cost to Company (CTC)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="net_contribution" name="Net Contribution" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Department Revenue Concentration */}
        <div className="team-chart-card">
          <div className="chart-header">
            <h3><PieChartIcon size={18} /> Department Revenue Contribution</h3>
            <p className="chart-subtitle">Share of agency revenue generated by role / team</p>
          </div>
          <div className="donut-body">
            <div style={{ width: '100%', height: '190px' }}>
              {departmentBreakdown.length === 0 ? (
                <div className="empty-chart-state">No department breakdown.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={departmentBreakdown}
                      dataKey="revenue"
                      nameKey="role"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {departmentBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `PKR ${Number(value).toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="donut-legend-list">
              {departmentBreakdown.map((d, idx) => (
                <div key={idx} className="legend-row">
                  <span className="legend-label">
                    <span className="legend-dot" style={{ background: DONUT_COLORS[idx % DONUT_COLORS.length] }}></span>
                    {d.role} ({d.headcount} staff)
                  </span>
                  <span className="legend-value">{d.share}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Employee Performance Ledger Table */}
      <div className="team-ledger-card">
        <div className="ledger-header">
          <div>
            <h3>Employee Performance & Unit Economics Matrix</h3>
            <p className="ledger-subtext">Showing {filteredTeam.length} workforce members sorted by selected criteria</p>
          </div>

          <div className="search-bar-wrap">
            <Search size={16} color="#64748b" />
            <input
              type="text"
              placeholder="Search by name, role, email, phone..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>
        </div>

        {error && <div className="error-banner"><AlertTriangle size={18} /> {error}</div>}

        <div className="table-responsive-wrapper" style={{ overflowX: 'auto' }}>
          <table className="modern-team-table">
            <thead>
              <tr>
                <th>Employee / Role</th>
                <th style={{ textAlign: 'center' }}>Tasks (Done/Total)</th>
                <th style={{ textAlign: 'center' }}>Task Efficiency</th>
                <th style={{ textAlign: 'center' }}>Projects (Done/Total)</th>
                <th style={{ textAlign: 'right' }}>Revenue Generated</th>
                <th style={{ textAlign: 'right' }}>Cost to Co. (CTC)</th>
                <th style={{ textAlign: 'right' }}>Net Value Add</th>
                <th style={{ textAlign: 'center' }}>ROI Multiple</th>
                <th style={{ textAlign: 'center' }}>Performance</th>
                <th style={{ textAlign: 'center' }}>Workload</th>
                <th style={{ textAlign: 'center' }}>360° Profile</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" className="table-loading-cell">
                    <RefreshCw size={24} className="spinning" />
                    <p style={{ marginTop: '0.5rem' }}>Calculating employee unit economics & performance metrics...</p>
                  </td>
                </tr>
              ) : paginatedTeam.length === 0 ? (
                <tr>
                  <td colSpan="11" className="table-empty-cell">
                    No employees match the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedTeam.map((emp) => {
                  const isPositive = emp.net_contribution >= 0;
                  return (
                    <tr
                      key={emp.user_id}
                      className="team-table-row clickable-row"
                      onClick={() => openUser360(emp.user_id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Employee info */}
                      <td>
                        <div className="employee-cell-info">
                          <div className="employee-name-row">
                            <span className="emp-avatar">{emp.name.charAt(0).toUpperCase()}</span>
                            <div>
                              <span className="emp-main-name">{emp.name}</span>
                              <span className={`emp-role-tag role-${(emp.role || 'other').replace(/\s+/g, '-').toLowerCase()}`}>
                                {emp.role}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Tasks Throughput */}
                      <td style={{ textAlign: 'center' }}>
                        <span className="task-count-pill">
                          <strong>{emp.tasks_completed}</strong> / {emp.tasks_assigned}
                          {emp.tasks_overdue > 0 && (
                            <span className="overdue-tag" title={`${emp.tasks_overdue} tasks overdue`}>
                              ({emp.tasks_overdue} late)
                            </span>
                          )}
                        </span>
                      </td>

                      {/* Task Efficiency */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`efficiency-badge ${emp.task_efficiency >= 80 ? 'eff-high' : (emp.task_efficiency >= 50 ? 'eff-med' : 'eff-low')}`}>
                          {emp.task_efficiency}%
                        </span>
                      </td>

                      {/* Projects */}
                      <td style={{ textAlign: 'center' }}>
                        <span className="project-count-pill">
                          <FolderKanban size={12} /> {emp.projects_completed} / {emp.projects_assigned}
                        </span>
                      </td>

                      {/* Revenue Generated */}
                      <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 700 }}>
                        PKR {emp.billable_revenue_generated.toLocaleString()}
                      </td>

                      {/* Cost to Company */}
                      <td style={{ textAlign: 'right', color: '#f59e0b', fontWeight: 600 }}>
                        PKR {emp.cost_to_company.toLocaleString()}
                      </td>

                      {/* Net Contribution */}
                      <td style={{ textAlign: 'right', color: isPositive ? '#8b5cf6' : '#ef4444', fontWeight: 800 }}>
                        PKR {emp.net_contribution.toLocaleString()}
                      </td>

                      {/* ROI Multiple */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`roi-badge ${emp.roi_multiple >= 3.0 ? 'roi-high' : (emp.roi_multiple >= 1.5 ? 'roi-med' : 'roi-low')}`}>
                          {emp.roi_multiple}x
                        </span>
                      </td>

                      {/* Performance Tier */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`tier-badge tier-${emp.performance_tier.replace(/\s+/g, '-').toLowerCase()}`}>
                          {emp.performance_tier}
                        </span>
                      </td>

                      {/* Workload Utilization */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`workload-badge workload-${emp.utilization_status.replace(/\s+/g, '-').toLowerCase()}`}>
                          {emp.utilization_status}
                        </span>
                      </td>

                      {/* Action Button */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn-view-360"
                          onClick={(e) => { e.stopPropagation(); openUser360(emp.user_id); }}
                          title="View 360 Employee Scorecard"
                        >
                          View 360° <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Summary Footer */}
            {filteredTeam.length > 0 && !loading && (
              <tfoot>
                <tr className="table-summary-footer">
                  <td style={{ fontWeight: 800 }}>Workforce Filtered Totals ({filteredTeam.length} staff)</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{tableTotals.tasks_completed} / {tableTotals.tasks_assigned} ({tableTotals.tasks_overdue} late)</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>
                    {tableTotals.tasks_assigned > 0 ? ((tableTotals.tasks_completed / tableTotals.tasks_assigned) * 100).toFixed(1) : 100}%
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{tableTotals.projects_completed} / {tableTotals.projects_assigned}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#10b981' }}>PKR {tableTotals.revenue.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#f59e0b' }}>PKR {tableTotals.cost.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#8b5cf6' }}>PKR {tableTotals.contribution.toLocaleString()}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>
                    {tableTotals.cost > 0 ? (tableTotals.revenue / tableTotals.cost).toFixed(2) : 0}x
                  </td>
                  <td colSpan="3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Enterprise Pagination Bar */}
        <div className="ledger-pagination-bar">
          <div className="pagination-left-controls">
            <span className="pagination-showing-text">
              Showing <strong>{filteredTeam.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</strong> to <strong>{Math.min(currentPage * itemsPerPage, filteredTeam.length)}</strong> of <strong>{filteredTeam.length}</strong> employees
            </span>
            <div className="rows-per-page-selector">
              <label>Rows per page:</label>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="pagination-right-controls">
            <Pagination
              currentPage={currentPage}
              totalItems={filteredTeam.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      </div>

      {/* 6. 360° Deep Dive Employee Modal */}
      {selectedUserId && (
        <div className="team-360-modal-overlay" onClick={closeUser360}>
          <div className="team-360-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top-bar">
              <div className="modal-emp-header">
                <div className="modal-avatar">
                  {userDetail?.user?.name ? userDetail.user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <h2 className="modal-emp-name">{userDetail?.user?.name || 'Loading...'}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <span className="emp-role-tag">{userDetail?.user?.role || 'Team Member'}</span>
                    <span className="modal-sub-email">{userDetail?.user?.email}</span>
                  </div>
                </div>
              </div>

              <div className="modal-actions-right">
                {userDetail?.user?.whatsapp_number && (
                  <a
                    href={`https://wa.me/${userDetail.user.whatsapp_number.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="modal-btn-contact"
                  >
                    <Phone size={14} /> WhatsApp
                  </a>
                )}
                {userDetail?.user?.email && (
                  <a
                    href={`mailto:${userDetail.user.email}`}
                    className="modal-btn-contact"
                  >
                    <Mail size={14} /> Email
                  </a>
                )}
                <button className="btn-close-modal" onClick={closeUser360}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="modal-tabs-row">
              <button
                className={`modal-tab-btn ${detailTab === 'overview' ? 'active' : ''}`}
                onClick={() => setDetailTab('overview')}
              >
                <Activity size={15} /> Performance & Economics
              </button>
              <button
                className={`modal-tab-btn ${detailTab === 'projects' ? 'active' : ''}`}
                onClick={() => setDetailTab('projects')}
              >
                <FolderKanban size={15} /> Assigned Projects ({userDetail?.projects?.length || 0})
              </button>
              <button
                className={`modal-tab-btn ${detailTab === 'tasks' ? 'active' : ''}`}
                onClick={() => setDetailTab('tasks')}
              >
                <CheckSquare size={15} /> Tasks / Steps ({userDetail?.tasks?.length || 0})
              </button>
              <button
                className={`modal-tab-btn ${detailTab === 'invoices' ? 'active' : ''}`}
                onClick={() => setDetailTab('invoices')}
              >
                <FileText size={15} /> Deals & Invoices ({userDetail?.invoices?.length || 0})
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body-scrollable">
              {loadingDetail ? (
                <div className="modal-loading">
                  <RefreshCw size={30} className="spinning" />
                  <p>Loading 360° Employee Scorecard...</p>
                </div>
              ) : (
                <>
                  {detailTab === 'overview' && (() => {
                    const invoices = userDetail?.invoices || [];
                    const commissions = userDetail?.commissions || [];
                    const tasks = userDetail?.tasks || [];
                    const projects = userDetail?.projects || [];

                    const totalRev = invoices.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
                    const totalComm = commissions.reduce((s, c) => s + parseFloat(c.final_amount || 0), 0);
                    const baseSalary = parseFloat(userDetail?.user?.base_salary || 50000);
                    const ctc = baseSalary + totalComm;
                    const netProfit = totalRev - ctc;
                    const roi = ctc > 0 ? (totalRev / ctc).toFixed(2) : 0;
                    const doneTasks = tasks.filter(t => t.status === 'Completed').length;
                    const taskEff = tasks.length > 0 ? ((doneTasks / tasks.length) * 100).toFixed(1) : 100;

                    return (
                      <div className="overview-tab-content">
                        <div className="modal-kpi-grid">
                          <div className="modal-kpi-box">
                            <span className="kpi-label">Billable Revenue Generated</span>
                            <h3 className="kpi-val text-green">PKR {totalRev.toLocaleString()}</h3>
                          </div>
                          <div className="modal-kpi-box">
                            <span className="kpi-label">Cost to Company (CTC)</span>
                            <h3 className="kpi-val text-orange">PKR {ctc.toLocaleString()}</h3>
                          </div>
                          <div className="modal-kpi-box">
                            <span className="kpi-label">Net Value Contribution</span>
                            <h3 className="kpi-val text-purple">PKR {netProfit.toLocaleString()}</h3>
                          </div>
                          <div className="modal-kpi-box">
                            <span className="kpi-label">ROI Productivity Multiple</span>
                            <h3 className="kpi-val text-blue">{roi}x</h3>
                          </div>
                          <div className="modal-kpi-box">
                            <span className="kpi-label">Task Efficiency</span>
                            <h3 className="kpi-val">{taskEff}%</h3>
                          </div>
                          <div className="modal-kpi-box">
                            <span className="kpi-label">Projects Active / Done</span>
                            <h3 className="kpi-val">{projects.filter(p => p.status !== 'Completed').length} / {projects.filter(p => p.status === 'Completed').length}</h3>
                          </div>
                        </div>

                        <div className="employee-metadata-box">
                          <h4>Staff Profile & Compensation Parameters</h4>
                          <div className="profile-details-grid">
                            <div><strong>Employee ID:</strong> #{userDetail?.user?.id}</div>
                            <div><strong>Role:</strong> {userDetail?.user?.role}</div>
                            <div><strong>Base Monthly Salary:</strong> PKR {parseFloat(userDetail?.user?.base_salary || 0).toLocaleString()}</div>
                            <div><strong>Commission Rate:</strong> {userDetail?.user?.commission_percentage || 0}%</div>
                            <div><strong>Monthly Goal:</strong> PKR {parseFloat(userDetail?.user?.monthly_goal || 0).toLocaleString()}</div>
                            <div><strong>Date Joined:</strong> {userDetail?.user?.created_at ? new Date(userDetail.user.created_at).toLocaleDateString() : 'N/A'}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {detailTab === 'projects' && (() => {
                    const allProjects = userDetail?.projects || [];
                    const pStart = (modalProjPage - 1) * modalItemsPerPage;
                    const paginatedProjects = allProjects.slice(pStart, pStart + modalItemsPerPage);

                    return (
                      <div className="modal-table-wrap">
                        <table className="modal-inner-table">
                          <thead>
                            <tr>
                              <th>Project Title</th>
                              <th>Client</th>
                              <th>Status</th>
                              <th>Steps Progress</th>
                              <th>Created Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allProjects.length === 0 ? (
                              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No assigned projects.</td></tr>
                            ) : (
                              paginatedProjects.map(p => (
                                <tr key={p.id}>
                                  <td style={{ fontWeight: 600 }}>{p.title}</td>
                                  <td>{p.client_name || p.business_name || '-'}</td>
                                  <td>
                                    <span className={`status-badge status-${(p.status || 'unknown').replace(/\s+/g, '-').toLowerCase()}`}>
                                      {p.status}
                                    </span>
                                  </td>
                                  <td>{p.completed_steps || 0} / {p.total_steps || 0} steps</td>
                                  <td>{p.created_at ? new Date(p.created_at).toLocaleDateString() : '-'}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                        {allProjects.length > modalItemsPerPage && (
                          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <Pagination
                              currentPage={modalProjPage}
                              totalItems={allProjects.length}
                              itemsPerPage={modalItemsPerPage}
                              onPageChange={setModalProjPage}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {detailTab === 'tasks' && (() => {
                    const allTasks = userDetail?.tasks || [];
                    const tStart = (modalTaskPage - 1) * modalItemsPerPage;
                    const paginatedTasks = allTasks.slice(tStart, tStart + modalItemsPerPage);

                    return (
                      <div className="modal-table-wrap">
                        <table className="modal-inner-table">
                          <thead>
                            <tr>
                              <th>Task / Step Title</th>
                              <th>Linked Project</th>
                              <th>Status</th>
                              <th>Deadline</th>
                              <th>Completed Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allTasks.length === 0 ? (
                              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No tasks assigned.</td></tr>
                            ) : (
                              paginatedTasks.map(t => (
                                <tr key={t.id}>
                                  <td style={{ fontWeight: 600 }}>{t.title}</td>
                                  <td>{t.project_title || '-'}</td>
                                  <td>
                                    <span className={`status-badge status-${(t.status || 'unknown').replace(/\s+/g, '-').toLowerCase()}`}>
                                      {t.status}
                                    </span>
                                  </td>
                                  <td>
                                    {t.deadline ? new Date(t.deadline).toLocaleDateString() : '-'}
                                    {t.status !== 'Completed' && t.deadline && new Date(t.deadline) < new Date() && (
                                      <span className="overdue-tag"> (Overdue)</span>
                                    )}
                                  </td>
                                  <td>{t.completed_at ? new Date(t.completed_at).toLocaleDateString() : '-'}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                        {allTasks.length > modalItemsPerPage && (
                          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <Pagination
                              currentPage={modalTaskPage}
                              totalItems={allTasks.length}
                              itemsPerPage={modalItemsPerPage}
                              onPageChange={setModalTaskPage}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {detailTab === 'invoices' && (() => {
                    const allInvoices = userDetail?.invoices || [];
                    const iStart = (modalInvPage - 1) * modalItemsPerPage;
                    const paginatedInvoices = allInvoices.slice(iStart, iStart + modalItemsPerPage);

                    return (
                      <div className="modal-table-wrap">
                        <table className="modal-inner-table">
                          <thead>
                            <tr>
                              <th>Invoice #</th>
                              <th>Project / Client</th>
                              <th style={{ textAlign: 'right' }}>Billable Amount</th>
                              <th style={{ textAlign: 'right' }}>Commission</th>
                              <th>Status</th>
                              <th>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allInvoices.length === 0 ? (
                              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No deals or invoices linked.</td></tr>
                            ) : (
                              paginatedInvoices.map(inv => (
                                <tr key={inv.id}>
                                  <td style={{ fontWeight: 700, color: '#3b82f6' }}>{inv.invoice_number}</td>
                                  <td>{inv.project_title || inv.client_name || '-'}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#10b981' }}>
                                    PKR {parseFloat(inv.amount || 0).toLocaleString()}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#f59e0b' }}>
                                    PKR {parseFloat(inv.commission_amount || 0).toLocaleString()}
                                  </td>
                                  <td>
                                    <span className={`status-badge status-${(inv.status || 'unknown').replace(/\s+/g, '-').toLowerCase()}`}>
                                      {inv.status}
                                    </span>
                                  </td>
                                  <td>{inv.issue_date ? new Date(inv.issue_date).toLocaleDateString() : '-'}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                        {allInvoices.length > modalItemsPerPage && (
                          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <Pagination
                              currentPage={modalInvPage}
                              totalItems={allInvoices.length}
                              itemsPerPage={modalItemsPerPage}
                              onPageChange={setModalInvPage}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
