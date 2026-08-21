import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Users, DollarSign, TrendingUp, AlertTriangle, CheckCircle, Clock,
  Download, Search, RefreshCw, BarChart2, PieChart as PieChartIcon,
  ChevronRight, X, Phone, Mail, FolderKanban, FileText, ArrowUpRight,
  Briefcase, Activity, Calendar, Award, MessageCircle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Pagination from '../../components/Pagination';
import './ClientReportView.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const DONUT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

export default function ClientReportView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Server data
  const [clientData, setClientData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [topProfitable, setTopProfitable] = useState([]);
  const [revenueConcentration, setRevenueConcentration] = useState([]);

  // Filter States
  const [activePreset, setActivePreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [profitabilityFilter, setProfitabilityFilter] = useState('all');
  const [healthFilter, setHealthFilter] = useState('all');
  const [sortBy, setSortBy] = useState('billed_desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal Sub-tab Pagination
  const [modalProjPage, setModalProjPage] = useState(1);
  const [modalInvPage, setModalInvPage] = useState(1);
  const [modalExpPage, setModalExpPage] = useState(1);
  const modalItemsPerPage = 6;

  // 360 Drilldown Modal State
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [clientDetail, setClientDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailTab, setDetailTab] = useState('overview'); // overview, projects, invoices, expenses

  const fetchClientReport = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const res = await axios.get(`${API_URL}/reports/clients?${params.toString()}`);
      setClientData(res.data.clients || []);
      setSummary(res.data.summary || null);
      setTopProfitable(res.data.top_profitable || []);
      setRevenueConcentration(res.data.revenue_concentration || []);
    } catch (err) {
      console.error('Error fetching client report:', err);
      setError(err.response?.data?.error || 'Failed to load client report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientReport();
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

  // Open 360 Modal
  const openClient360 = async (clientId) => {
    setSelectedClientId(clientId);
    setLoadingDetail(true);
    setDetailTab('overview');
    setModalProjPage(1);
    setModalInvPage(1);
    setModalExpPage(1);
    try {
      const res = await axios.get(`${API_URL}/reports/clients/${clientId}/details`);
      setClientDetail(res.data);
    } catch (err) {
      console.error('Failed to fetch client 360 view:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeClient360 = () => {
    setSelectedClientId(null);
    setClientDetail(null);
  };

  // Filtered & Sorted Clients
  const filteredClients = useMemo(() => {
    let result = [...clientData];

    // 1. Search Filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c =>
        (c.full_name && c.full_name.toLowerCase().includes(term)) ||
        (c.business_name && c.business_name.toLowerCase().includes(term)) ||
        (c.email && c.email.toLowerCase().includes(term)) ||
        (c.whatsapp_number && c.whatsapp_number.toLowerCase().includes(term))
      );
    }

    // 2. Profitability Tier Filter
    if (profitabilityFilter !== 'all') {
      result = result.filter(c => c.profitability_tier === profitabilityFilter);
    }

    // 3. Health Filter
    if (healthFilter !== 'all') {
      result = result.filter(c => c.health_status === healthFilter);
    }

    // 4. Sorting
    result.sort((a, b) => {
      if (sortBy === 'billed_desc') return b.total_billed - a.total_billed;
      if (sortBy === 'billed_asc') return a.total_billed - b.total_billed;
      if (sortBy === 'collected_desc') return b.total_collected - a.total_collected;
      if (sortBy === 'profit_desc') return b.gross_profit - a.gross_profit;
      if (sortBy === 'margin_desc') return b.profit_margin - a.profit_margin;
      if (sortBy === 'outstanding_desc') return b.total_outstanding - a.total_outstanding;
      if (sortBy === 'projects_desc') return b.total_projects - a.total_projects;
      if (sortBy === 'name_asc') return a.full_name.localeCompare(b.full_name);
      return 0;
    });

    return result;
  }, [clientData, searchTerm, profitabilityFilter, healthFilter, sortBy]);

  // Paginated Data
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredClients.slice(start, start + itemsPerPage);
  }, [filteredClients, currentPage, itemsPerPage]);

  // Table Totals for summary row
  const tableTotals = useMemo(() => {
    return filteredClients.reduce((acc, c) => ({
      billed: acc.billed + c.total_billed,
      collected: acc.collected + c.total_collected,
      outstanding: acc.outstanding + c.total_outstanding,
      expenses: acc.expenses + c.total_expenses,
      profit: acc.profit + c.gross_profit,
      projects: acc.projects + c.total_projects,
      invoices: acc.invoices + c.total_invoices
    }), { billed: 0, collected: 0, outstanding: 0, expenses: 0, profit: 0, projects: 0, invoices: 0 });
  }, [filteredClients]);

  // Export to Excel (Multi-Sheet)
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Executive Portfolio Summary
    const summaryRows = [
      ['Adwise Labs - Client Analytics & Profitability Report'],
      ['Generated On', new Date().toLocaleString()],
      ['Date Range', `${startDate || 'All Time'} to ${endDate || 'Present'}`],
      [''],
      ['Portfolio Metric', 'Value'],
      ['Total Active Accounts', summary?.active_clients || 0],
      ['Total Portfolio Billed (PKR)', summary?.portfolio_billed || 0],
      ['Total Realized Collected (PKR)', summary?.portfolio_collected || 0],
      ['Total Outstanding Receivables (PKR)', summary?.portfolio_outstanding || 0],
      ['Total Client Direct Costs (PKR)', summary?.portfolio_expenses || 0],
      ['Total Realized Gross Profit (PKR)', summary?.portfolio_gross_profit || 0],
      ['Portfolio Profit Margin (%)', `${summary?.portfolio_margin || 0}%`],
      ['Portfolio Collection Rate (%)', `${summary?.portfolio_collection_rate || 0}%`],
      ['Average Revenue Per Account (ARPU) (PKR)', summary?.arpu || 0]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

    // Sheet 2: Client Profitability Matrix
    const clientMatrix = filteredClients.map((c, idx) => ({
      '#': idx + 1,
      'Client Name': c.full_name,
      'Business / Company': c.business_name,
      'Contact Phone': c.whatsapp_number,
      'Email': c.email,
      'Total Billed (PKR)': c.total_billed,
      'Total Collected (PKR)': c.total_collected,
      'Outstanding Balance (PKR)': c.total_outstanding,
      'Total Expenses / Cost (PKR)': c.total_expenses,
      'Gross Profit (PKR)': c.gross_profit,
      'Profit Margin (%)': `${c.profit_margin}%`,
      'Collection Rate (%)': `${c.collection_rate}%`,
      'Total Projects': c.total_projects,
      'Active Projects': c.active_projects,
      'Completed Projects': c.completed_projects,
      'Total Invoices': c.total_invoices,
      'Avg Monthly Revenue (PKR)': c.avg_monthly_revenue,
      'Profitability Status': c.profitability_tier,
      'Account Health': c.health_status
    }));
    const wsClients = XLSX.utils.json_to_sheet(clientMatrix);
    XLSX.utils.book_append_sheet(wb, wsClients, 'Client Profitability');

    // Sheet 3: Top Accounts Concentration
    const topRevenueRows = (revenueConcentration || []).map(r => ({
      'Account Name': r.name,
      'Total Billed (PKR)': r.billed,
      'Total Collected (PKR)': r.collected,
      'Gross Profit (PKR)': r.profit,
      'Revenue Share (%)': `${r.share}%`
    }));
    const wsTop = XLSX.utils.json_to_sheet(topRevenueRows);
    XLSX.utils.book_append_sheet(wb, wsTop, 'Revenue Concentration');

    XLSX.writeFile(wb, `Client_Profitability_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF('landscape', 'pt', 'a4');

    // Header Title
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('Client Intelligence & Profitability Report', 40, 45);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleString()} | Period: ${startDate || 'All Time'} - ${endDate || 'Present'}`, 40, 62);

    // Summary Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(40, 75, 762, 45, 6, 6, 'F');

    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('PORTFOLIO BILLED', 55, 92);
    doc.text('COLLECTED', 190, 92);
    doc.text('OUTSTANDING A/R', 330, 92);
    doc.text('DIRECT EXPENSES', 470, 92);
    doc.text('GROSS PROFIT', 610, 92);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`PKR ${(summary?.portfolio_billed || 0).toLocaleString()}`, 55, 110);
    doc.setTextColor(16, 185, 129);
    doc.text(`PKR ${(summary?.portfolio_collected || 0).toLocaleString()}`, 190, 110);
    doc.setTextColor(239, 68, 68);
    doc.text(`PKR ${(summary?.portfolio_outstanding || 0).toLocaleString()}`, 330, 110);
    doc.setTextColor(245, 158, 11);
    doc.text(`PKR ${(summary?.portfolio_expenses || 0).toLocaleString()}`, 470, 110);
    doc.setTextColor(139, 92, 246);
    doc.text(`PKR ${(summary?.portfolio_gross_profit || 0).toLocaleString()} (${summary?.portfolio_margin || 0}%)`, 610, 110);

    // Table Data
    const tableBody = filteredClients.map(c => [
      c.full_name,
      c.business_name,
      `PKR ${c.total_billed.toLocaleString()}`,
      `PKR ${c.total_collected.toLocaleString()}`,
      `PKR ${c.total_outstanding.toLocaleString()}`,
      `PKR ${c.total_expenses.toLocaleString()}`,
      `PKR ${c.gross_profit.toLocaleString()}`,
      `${c.profit_margin}%`,
      c.total_projects,
      c.total_invoices,
      `PKR ${c.avg_monthly_revenue.toLocaleString()}`,
      c.profitability_tier
    ]);

    autoTable(doc, {
      startY: 135,
      head: [['Client Name', 'Business', 'Billed', 'Collected', 'Outstanding', 'Cost/Exp', 'Gross Profit', 'Margin %', 'Proj', 'Inv', 'Avg/Mo', 'Tier']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 40, right: 40 }
    });

    doc.save(`Client_Profitability_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="professional-client-report">
      {/* 1. Header Action Bar */}
      <div className="client-header-panel">
        <div className="header-info">
          <div className="header-badge">
            <Users size={15} /> Client Intelligence & Profitability
          </div>
          <h1>Enterprise Client Analytics</h1>
          <p className="header-subtext">
            Comprehensive account-level unit economics, project cost attribution, realized margins, billing volume, and revenue run-rates.
          </p>
        </div>

        <div className="header-action-group">
          <button className="btn-export btn-export-excel" onClick={exportToExcel} title="Export multi-sheet Excel report">
            <Download size={16} /> Export Excel (.xlsx)
          </button>
          <button className="btn-export btn-export-pdf" onClick={exportToPDF} title="Download corporate PDF statement">
            <Download size={16} /> Export PDF (.pdf)
          </button>
          <button className="btn-refresh" onClick={fetchClientReport} title="Refresh live data">
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Portfolio-Wide Financial KPI Grid (7 Macro Cards) */}
      <div className="client-kpi-grid">
        {/* Card 1: Active Accounts */}
        <div className="client-kpi-card card-blue">
          <div className="card-top">
            <span className="card-title">Total Active Accounts</span>
            <div className="card-icon"><Users size={20} /></div>
          </div>
          <h2 className="card-value">{summary?.total_clients || 0}</h2>
          <div className="card-meta">
            <span className="meta-pill blue">
              <Activity size={12} /> {summary?.active_clients || 0} Engaged Accounts
            </span>
          </div>
        </div>

        {/* Card 2: Total Billed */}
        <div className="client-kpi-card card-indigo">
          <div className="card-top">
            <span className="card-title">Total Billed Volume</span>
            <div className="card-icon"><DollarSign size={20} /></div>
          </div>
          <h2 className="card-value">PKR {(summary?.portfolio_billed || 0).toLocaleString()}</h2>
          <div className="card-meta">
            <span className="meta-pill blue">
              <ArrowUpRight size={12} /> Gross Invoice Value
            </span>
          </div>
        </div>

        {/* Card 3: Realized Collected */}
        <div className="client-kpi-card card-green">
          <div className="card-top">
            <span className="card-title">Realized Cash Inflow</span>
            <div className="card-icon"><TrendingUp size={20} /></div>
          </div>
          <h2 className="card-value text-green">PKR {(summary?.portfolio_collected || 0).toLocaleString()}</h2>
          <div className="card-meta">
            <span className="meta-pill green">
              <CheckCircle size={12} /> {summary?.portfolio_collection_rate || 0}% Collection Efficiency
            </span>
          </div>
        </div>

        {/* Card 4: Accounts Receivable */}
        <div className="client-kpi-card card-red">
          <div className="card-top">
            <span className="card-title">Outstanding Receivables</span>
            <div className="card-icon"><AlertTriangle size={20} /></div>
          </div>
          <h2 className="card-value text-red">PKR {(summary?.portfolio_outstanding || 0).toLocaleString()}</h2>
          <div className="card-meta">
            <span className="meta-pill red">
              <Clock size={12} /> Pending Balance
            </span>
          </div>
        </div>

        {/* Card 5: Attributed Costs */}
        <div className="client-kpi-card card-orange">
          <div className="card-top">
            <span className="card-title">Direct Client Costs</span>
            <div className="card-icon"><Briefcase size={20} /></div>
          </div>
          <h2 className="card-value text-orange">PKR {(summary?.portfolio_expenses || 0).toLocaleString()}</h2>
          <div className="card-meta">
            <span className="meta-pill orange">
              Project & Direct Expenses
            </span>
          </div>
        </div>

        {/* Card 6: Realized Gross Profit & Margin */}
        <div className="client-kpi-card card-purple">
          <div className="card-top">
            <span className="card-title">Portfolio Gross Profit</span>
            <div className="card-icon"><Award size={20} /></div>
          </div>
          <h2 className="card-value text-purple">PKR {(summary?.portfolio_gross_profit || 0).toLocaleString()}</h2>
          <div className="card-meta">
            <span className="meta-pill purple">
              {summary?.portfolio_margin || 0}% Profit Margin
            </span>
          </div>
        </div>

        {/* Card 7: ARPU */}
        <div className="client-kpi-card card-teal">
          <div className="card-top">
            <span className="card-title">Avg Revenue Per Client (ARPU)</span>
            <div className="card-icon"><BarChart2 size={20} /></div>
          </div>
          <h2 className="card-value text-teal">PKR {Math.round(summary?.arpu || 0).toLocaleString()}</h2>
          <div className="card-meta">
            <span className="meta-pill teal">
              Lifetime Value Benchmark
            </span>
          </div>
        </div>
      </div>

      {/* 3. Filter Toolbar */}
      <div className="client-filter-card">
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
            <label><TrendingUp size={13} /> Profitability Tier</label>
            <select value={profitabilityFilter} onChange={(e) => setProfitabilityFilter(e.target.value)}>
              <option value="all">All Profitability Tiers</option>
              <option value="High Margin">High Margin (&gt;= 50%)</option>
              <option value="Profitable">Profitable (&gt; 0%)</option>
              <option value="Loss">Loss / Negative Margin</option>
              <option value="Inactive">Inactive / Zero Billed</option>
            </select>
          </div>

          <div className="filter-field">
            <label><CheckCircle size={13} /> Account Health</label>
            <select value={healthFilter} onChange={(e) => setHealthFilter(e.target.value)}>
              <option value="all">All Health Statuses</option>
              <option value="Healthy">Healthy (Zero Balance)</option>
              <option value="Pending Dues">Pending Dues</option>
              <option value="Overdue Risk">Overdue Risk</option>
            </select>
          </div>

          <div className="filter-field">
            <label><BarChart2 size={13} /> Sort Accounts By</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="billed_desc">Highest Billed Volume</option>
              <option value="collected_desc">Highest Cash Collected</option>
              <option value="profit_desc">Highest Gross Profit</option>
              <option value="margin_desc">Highest Profit Margin %</option>
              <option value="outstanding_desc">Highest Outstanding Balance</option>
              <option value="projects_desc">Most Projects</option>
              <option value="name_asc">Client Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Visual Analytics Section */}
      <div className="client-charts-row">
        {/* Chart 1: Top Profitable Clients */}
        <div className="client-chart-card">
          <div className="chart-header">
            <h3><BarChart2 size={18} /> Top Profitable Accounts (Gross Profit & Realized Cash)</h3>
            <p className="chart-subtitle">Direct comparison of billed volume vs realized profit per key client</p>
          </div>
          <div className="chart-container-box" style={{ height: '300px' }}>
            {topProfitable.length === 0 ? (
              <div className="empty-chart-state">No client profitability data to display.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProfitable} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="full_name"
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
                  <Bar dataKey="total_billed" name="Total Billed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total_collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gross_profit" name="Gross Profit" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Revenue Concentration Donut */}
        <div className="client-chart-card">
          <div className="chart-header">
            <h3><PieChartIcon size={18} /> Revenue Concentration (Pareto Share)</h3>
            <p className="chart-subtitle">Top account share of total portfolio billing</p>
          </div>
          <div className="donut-body">
            <div style={{ width: '100%', height: '190px' }}>
              {revenueConcentration.length === 0 ? (
                <div className="empty-chart-state">No concentration data.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueConcentration}
                      dataKey="billed"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {revenueConcentration.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `PKR ${Number(value).toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="donut-legend-list">
              {revenueConcentration.map((c, idx) => (
                <div key={idx} className="legend-row">
                  <span className="legend-label">
                    <span className="legend-dot" style={{ background: DONUT_COLORS[idx % DONUT_COLORS.length] }}></span>
                    {c.name}
                  </span>
                  <span className="legend-value">{c.share}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Client Profitability Ledger Table */}
      <div className="client-ledger-card">
        <div className="ledger-header">
          <div>
            <h3>Client Profitability & Economics Matrix</h3>
            <p className="ledger-subtext">Showing {filteredClients.length} accounts sorted by selected criteria</p>
          </div>

          <div className="search-bar-wrap">
            <Search size={16} color="#64748b" />
            <input
              type="text"
              placeholder="Search by client, company, email, phone..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>
        </div>

        {error && <div className="error-banner"><AlertTriangle size={18} /> {error}</div>}

        <div className="table-responsive-wrapper" style={{ overflowX: 'auto' }}>
          <table className="modern-client-table">
            <thead>
              <tr>
                <th>Client / Business</th>
                <th style={{ textAlign: 'right' }}>Total Billed</th>
                <th style={{ textAlign: 'right' }}>Collected</th>
                <th style={{ textAlign: 'right' }}>Outstanding</th>
                <th style={{ textAlign: 'right' }}>Cost / Expenses</th>
                <th style={{ textAlign: 'right' }}>Gross Profit</th>
                <th style={{ textAlign: 'center' }}>Margin %</th>
                <th style={{ textAlign: 'center' }}>Projects</th>
                <th style={{ textAlign: 'center' }}>Invoices</th>
                <th style={{ textAlign: 'right' }}>Avg Monthly</th>
                <th style={{ textAlign: 'center' }}>Health</th>
                <th style={{ textAlign: 'center' }}>360° Profile</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="12" className="table-loading-cell">
                    <RefreshCw size={24} className="spinning" />
                    <p style={{ marginTop: '0.5rem' }}>Calculating client profitability metrics...</p>
                  </td>
                </tr>
              ) : paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan="12" className="table-empty-cell">
                    No clients match the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedClients.map((client) => {
                  const isProfitable = client.gross_profit >= 0;
                  return (
                    <tr
                      key={client.client_id}
                      className="client-table-row clickable-row"
                      onClick={() => openClient360(client.client_id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Client info */}
                      <td>
                        <div className="client-cell-info">
                          <span className="client-main-name">{client.full_name}</span>
                          <span className="client-sub-name">{client.business_name}</span>
                        </div>
                      </td>

                      {/* Total Billed */}
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        PKR {client.total_billed.toLocaleString()}
                      </td>

                      {/* Collected */}
                      <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                        PKR {client.total_collected.toLocaleString()}
                      </td>

                      {/* Outstanding */}
                      <td style={{ textAlign: 'right', color: client.total_outstanding > 0 ? '#ef4444' : '#64748b', fontWeight: 600 }}>
                        PKR {client.total_outstanding.toLocaleString()}
                      </td>

                      {/* Total Expenses / Cost */}
                      <td style={{ textAlign: 'right', color: '#f59e0b', fontWeight: 500 }}>
                        PKR {client.total_expenses.toLocaleString()}
                      </td>

                      {/* Gross Profit */}
                      <td style={{ textAlign: 'right', color: isProfitable ? '#8b5cf6' : '#ef4444', fontWeight: 700 }}>
                        PKR {client.gross_profit.toLocaleString()}
                      </td>

                      {/* Profit Margin */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`profit-margin-badge ${client.profit_margin >= 50 ? 'margin-high' : (client.profit_margin > 0 ? 'margin-med' : 'margin-low')}`}>
                          {client.profit_margin}%
                        </span>
                      </td>

                      {/* Projects */}
                      <td style={{ textAlign: 'center' }}>
                        <span className="project-badge">
                          <FolderKanban size={12} /> {client.total_projects}
                        </span>
                      </td>

                      {/* Invoices */}
                      <td style={{ textAlign: 'center' }}>
                        <span className="invoice-badge">
                          <FileText size={12} /> {client.total_invoices}
                        </span>
                      </td>

                      {/* Avg Monthly Revenue */}
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                        PKR {Math.round(client.avg_monthly_revenue).toLocaleString()}
                      </td>

                      {/* Health Status */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`client-health-badge health-${client.health_status.replace(/\s+/g, '-').toLowerCase()}`}>
                          {client.health_status}
                        </span>
                      </td>

                      {/* Action 360 Drilldown */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn-view-360"
                          onClick={() => openClient360(client.client_id)}
                          title="View 360 Client Intelligence"
                        >
                          View 360° <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Summary Footer */}
            {filteredClients.length > 0 && !loading && (
              <tfoot>
                <tr className="table-summary-footer">
                  <td style={{ fontWeight: 800 }}>Portfolio Filtered Totals ({filteredClients.length} accounts)</td>
                  <td style={{ textAlign: 'right', fontWeight: 800 }}>PKR {tableTotals.billed.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#10b981' }}>PKR {tableTotals.collected.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>PKR {tableTotals.outstanding.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#f59e0b' }}>PKR {tableTotals.expenses.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#8b5cf6' }}>PKR {tableTotals.profit.toLocaleString()}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>
                    {tableTotals.billed > 0 ? ((tableTotals.profit / tableTotals.billed) * 100).toFixed(1) : 0}%
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{tableTotals.projects}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{tableTotals.invoices}</td>
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
              Showing <strong>{filteredClients.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</strong> to <strong>{Math.min(currentPage * itemsPerPage, filteredClients.length)}</strong> of <strong>{filteredClients.length}</strong> accounts
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
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="pagination-right-controls">
            <Pagination
              currentPage={currentPage}
              totalItems={filteredClients.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      </div>

      {/* 6. 360° Deep Dive Client Modal */}
      {selectedClientId && (
        <div className="client-360-modal-overlay" onClick={closeClient360}>
          <div className="client-360-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top-bar">
              <div className="modal-client-header">
                <div className="modal-avatar">
                  {clientDetail?.client?.full_name ? clientDetail.client.full_name.charAt(0).toUpperCase() : 'C'}
                </div>
                <div>
                  <h2 className="modal-client-name">{clientDetail?.client?.full_name || 'Loading...'}</h2>
                  <p className="modal-client-biz">{clientDetail?.client?.business_name || 'Individual Account'}</p>
                </div>
              </div>

              <div className="modal-actions-right">
                {clientDetail?.client?.whatsapp_number && (
                  <a
                    href={`https://wa.me/${clientDetail.client.whatsapp_number.replace(/\D/g, '')}?text=${encodeURIComponent(
                      `*ACCOUNT STATEMENT - ADWISE LABS*\n\n` +
                      `Dear *${clientDetail.client.full_name}*,\n\n` +
                      `Here is your account statement summary with Adwise Labs:\n` +
                      `📌 *Total Billed:* Rs. ${Number(clientDetail.summary.total_billed || 0).toLocaleString()}\n` +
                      `✅ *Total Collected:* Rs. ${Number(clientDetail.summary.total_collected || 0).toLocaleString()}\n` +
                      `⚠️ *Outstanding Balance:* Rs. ${Number(clientDetail.summary.outstanding_balance || 0).toLocaleString()}\n` +
                      `📁 *Active Projects:* ${clientDetail.summary.total_projects || 0}\n\n` +
                      `Thank you for your business!\n*Adwise Labs Management*`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="modal-btn-contact"
                  >
                    <MessageCircle size={14} color="#10b981" /> WhatsApp
                  </a>
                )}
                {clientDetail?.client?.email && (
                  <a
                    href={`mailto:${clientDetail.client.email}`}
                    className="modal-btn-contact"
                  >
                    <Mail size={14} /> Email
                  </a>
                )}
                <button className="btn-close-modal" onClick={closeClient360}>
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
                <Activity size={15} /> Financial Overview
              </button>
              <button
                className={`modal-tab-btn ${detailTab === 'projects' ? 'active' : ''}`}
                onClick={() => setDetailTab('projects')}
              >
                <FolderKanban size={15} /> Projects ({clientDetail?.projects?.length || 0})
              </button>
              <button
                className={`modal-tab-btn ${detailTab === 'invoices' ? 'active' : ''}`}
                onClick={() => setDetailTab('invoices')}
              >
                <FileText size={15} /> Invoices ({clientDetail?.invoices?.length || 0})
              </button>
              <button
                className={`modal-tab-btn ${detailTab === 'expenses' ? 'active' : ''}`}
                onClick={() => setDetailTab('expenses')}
              >
                <Briefcase size={15} /> Expenses & Costs ({clientDetail?.expenses?.length || 0})
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body-scrollable">
              {loadingDetail ? (
                <div className="modal-loading">
                  <RefreshCw size={30} className="spinning" />
                  <p>Loading 360° Account Data...</p>
                </div>
              ) : (
                <>
                  {detailTab === 'overview' && (() => {
                    const invoices = clientDetail?.invoices || [];
                    const expenses = clientDetail?.expenses || [];
                    const totalBilled = invoices.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
                    const totalOut = invoices.reduce((s, i) => s + parseFloat(i.balance || 0), 0);
                    const totalPaid = totalBilled - totalOut;
                    const totalExp = expenses.reduce((s, e) => s + parseFloat(e.payment_amount || 0), 0);
                    const grossProfit = totalPaid - totalExp;
                    const margin = totalBilled > 0 ? ((grossProfit / totalBilled) * 100).toFixed(1) : 0;

                    return (
                      <div className="overview-tab-content">
                        <div className="modal-kpi-grid">
                          <div className="modal-kpi-box">
                            <span className="kpi-label">Lifetime Billed</span>
                            <h3 className="kpi-val">PKR {totalBilled.toLocaleString()}</h3>
                          </div>
                          <div className="modal-kpi-box">
                            <span className="kpi-label">Total Collected</span>
                            <h3 className="kpi-val text-green">PKR {totalPaid.toLocaleString()}</h3>
                          </div>
                          <div className="modal-kpi-box">
                            <span className="kpi-label">Outstanding Balance</span>
                            <h3 className="kpi-val text-red">PKR {totalOut.toLocaleString()}</h3>
                          </div>
                          <div className="modal-kpi-box">
                            <span className="kpi-label">Direct Expenses</span>
                            <h3 className="kpi-val text-orange">PKR {totalExp.toLocaleString()}</h3>
                          </div>
                          <div className="modal-kpi-box">
                            <span className="kpi-label">Realized Profit</span>
                            <h3 className="kpi-val text-purple">PKR {grossProfit.toLocaleString()}</h3>
                          </div>
                          <div className="modal-kpi-box">
                            <span className="kpi-label">Profit Margin</span>
                            <h3 className="kpi-val">{margin}%</h3>
                          </div>
                        </div>

                        <div className="client-contact-profile-box">
                          <h4>Account Metadata & Contact</h4>
                          <div className="profile-details-grid">
                            <div><strong>Client ID:</strong> #{clientDetail?.client?.id}</div>
                            <div><strong>Phone:</strong> {clientDetail?.client?.whatsapp_number || 'N/A'}</div>
                            <div><strong>Email:</strong> {clientDetail?.client?.email || 'N/A'}</div>
                            <div><strong>Address:</strong> {clientDetail?.client?.physical_address || 'N/A'}</div>
                            <div><strong>Account Created:</strong> {clientDetail?.client?.created_at ? new Date(clientDetail.client.created_at).toLocaleDateString() : 'N/A'}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {detailTab === 'projects' && (() => {
                    const allProjects = clientDetail?.projects || [];
                    const pStart = (modalProjPage - 1) * modalItemsPerPage;
                    const paginatedProjects = allProjects.slice(pStart, pStart + modalItemsPerPage);

                    return (
                      <div className="modal-table-wrap">
                        <table className="modal-inner-table">
                          <thead>
                            <tr>
                              <th>Project Title</th>
                              <th>Status</th>
                              <th>Project Manager</th>
                              <th>Created Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allProjects.length === 0 ? (
                              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>No projects registered.</td></tr>
                            ) : (
                              paginatedProjects.map(p => (
                                <tr key={p.id}>
                                  <td style={{ fontWeight: 600 }}>{p.title}</td>
                                  <td>
                                    <span className={`status-badge status-${(p.status || 'unknown').replace(/\s+/g, '-').toLowerCase()}`}>
                                      {p.status}
                                    </span>
                                  </td>
                                  <td>{p.pm_name || '-'}</td>
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

                  {detailTab === 'invoices' && (() => {
                    const allInvoices = clientDetail?.invoices || [];
                    const iStart = (modalInvPage - 1) * modalItemsPerPage;
                    const paginatedInvoices = allInvoices.slice(iStart, iStart + modalItemsPerPage);

                    return (
                      <div className="modal-table-wrap">
                        <table className="modal-inner-table">
                          <thead>
                            <tr>
                              <th>Invoice #</th>
                              <th>Issue Date</th>
                              <th>Due Date</th>
                              <th style={{ textAlign: 'right' }}>Amount</th>
                              <th style={{ textAlign: 'right' }}>Balance</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allInvoices.length === 0 ? (
                              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No invoices registered.</td></tr>
                            ) : (
                              paginatedInvoices.map(inv => (
                                <tr key={inv.id}>
                                  <td style={{ fontWeight: 700, color: '#3b82f6' }}>{inv.invoice_number}</td>
                                  <td>{inv.issue_date ? new Date(inv.issue_date).toLocaleDateString() : '-'}</td>
                                  <td>{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '-'}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 600 }}>PKR {parseFloat(inv.amount || 0).toLocaleString()}</td>
                                  <td style={{ textAlign: 'right', color: parseFloat(inv.balance || 0) > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                                    PKR {parseFloat(inv.balance || 0).toLocaleString()}
                                  </td>
                                  <td>
                                    <span className={`status-badge status-${(inv.status || 'unknown').replace(/\s+/g, '-').toLowerCase()}`}>
                                      {inv.status}
                                    </span>
                                  </td>
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

                  {detailTab === 'expenses' && (() => {
                    const allExpenses = clientDetail?.expenses || [];
                    const eStart = (modalExpPage - 1) * modalItemsPerPage;
                    const paginatedExpenses = allExpenses.slice(eStart, eStart + modalItemsPerPage);

                    return (
                      <div className="modal-table-wrap">
                        <table className="modal-inner-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Description</th>
                              <th>Mode / Bank</th>
                              <th style={{ textAlign: 'right' }}>Payment Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allExpenses.length === 0 ? (
                              <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>No attributed expenses found.</td></tr>
                            ) : (
                              paginatedExpenses.map(e => (
                                <tr key={e.id}>
                                  <td>{e.date ? new Date(e.date).toLocaleDateString() : '-'}</td>
                                  <td>{e.description || '-'}</td>
                                  <td>{e.mode || e.bank || '-'}</td>
                                  <td style={{ textAlign: 'right', color: '#f59e0b', fontWeight: 700 }}>
                                    PKR {parseFloat(e.payment_amount || 0).toLocaleString()}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                        {allExpenses.length > modalItemsPerPage && (
                          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <Pagination
                              currentPage={modalExpPage}
                              totalItems={allExpenses.length}
                              itemsPerPage={modalItemsPerPage}
                              onPageChange={setModalExpPage}
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
