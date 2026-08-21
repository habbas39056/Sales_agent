import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  FileSpreadsheet, Download, RefreshCw, AlertTriangle, CheckCircle,
  TrendingUp, TrendingDown, DollarSign, Award, Target, Layers,
  BarChart2, PieChart as PieChartIcon, Search, Filter, ChevronRight,
  Eye, X, ShoppingBag, Briefcase, Users, FileText, ArrowUpRight,
  ArrowDownRight, HelpCircle, MessageCircle, Mail, Calendar, Clock,
  FolderKanban, CheckSquare, AlertCircle, ShieldAlert, Sparkles,
  CreditCard, Activity, Send, Landmark, ShieldCheck, Zap, PieChart as PieIcon
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Pagination from '../../components/Pagination';
import './RevenueConcentrationReportView.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const CLIENT_PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

export default function RevenueConcentrationReportView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data from backend
  const [summary, setSummary] = useState(null);
  const [clientsConcentration, setClientsConcentration] = useState([]);
  const [servicesConcentration, setServicesConcentration] = useState([]);
  const [salespeopleConcentration, setSalespeopleConcentration] = useState([]);

  // Sub-navigation: 'clients-matrix' | 'services-matrix' | 'salespeople-matrix'
  const [activeSubTab, setActiveSubTab] = useState('clients-matrix');

  // Date Range Filters
  const [datePreset, setDatePreset] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Search Filter
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  const fetchConcentrationReports = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/reports/revenue-concentration`, {
        params: {
          start_date: startDate || undefined,
          end_date: endDate || undefined
        }
      });
      setSummary(res.data.summary || null);
      setClientsConcentration(res.data.clients_concentration || []);
      setServicesConcentration(res.data.services_concentration || []);
      setSalespeopleConcentration(res.data.salespeople_concentration || []);
    } catch (err) {
      console.error('Error fetching concentration reports:', err);
      setError(err.response?.data?.error || 'Failed to load revenue concentration reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConcentrationReports();
  }, [startDate, endDate]);

  // Format Currency PKR
  const fmt = (val) => {
    const n = Number(val || 0);
    return `Rs ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Filtered Clients
  const filteredClients = useMemo(() => {
    return clientsConcentration.filter(c => {
      return (c.client_name && c.client_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.business_name && c.business_name.toLowerCase().includes(searchTerm.toLowerCase()));
    });
  }, [clientsConcentration, searchTerm]);

  // Paginated Clients
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredClients.slice(start, start + itemsPerPage);
  }, [filteredClients, currentPage, itemsPerPage]);

  // Chart Data: Clients Donut
  const clientsDonutData = useMemo(() => {
    return clientsConcentration.slice(0, 5).map(c => ({
      name: c.client_name,
      value: c.revenue
    }));
  }, [clientsConcentration]);

  // Chart Data: Cumulative Lorenz Curve
  const lorenzCurveData = useMemo(() => {
    return clientsConcentration.map(c => ({
      rank: `#${c.rank} ${c.client_name}`,
      'Cumulative Share %': c.cumulative_share_pct,
      'Pareto 80% Benchmark': 80
    }));
  }, [clientsConcentration]);

  // Multi-Sheet Excel Export
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Client Concentration
    const clientHeaders = ['Rank', 'Client Name', 'Business Name', 'Revenue (PKR)', 'Share %', 'Cumulative Share %', 'Risk Tier', 'Invoices Count'];
    const clientRows = clientsConcentration.map(c => [
      c.rank, c.client_name, c.business_name, c.revenue, `${c.share_pct}%`, `${c.cumulative_share_pct}%`, c.risk_tier, c.invoices_count
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Adwise Labs - Revenue Concentration & Risk Exposure Report'],
      [`Generated: ${new Date().toLocaleString()} | Top 1: ${summary?.top_1_client_pct}% | Top 5: ${summary?.top_5_clients_pct}%`],
      [],
      clientHeaders,
      ...clientRows
    ]), 'Client Concentration');

    // Sheet 2: Service Concentration
    const srvHeaders = ['Rank', 'Service Line', 'Revenue (PKR)', 'Share %', 'Cumulative Share %', 'Deliverables Count'];
    const srvRows = servicesConcentration.map(s => [
      s.rank, s.service, s.revenue, `${s.share_pct}%`, `${s.cumulative_share_pct}%`, s.count
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Service Concentration Matrix'], [], srvHeaders, ...srvRows]), 'Service Concentration');

    // Sheet 3: Salesperson Concentration
    const spHeaders = ['Rank', 'Salesperson', 'Revenue Generated (PKR)', 'Share %', 'Cumulative Share %', 'Deals Closed'];
    const spRows = salespeopleConcentration.map(sp => [
      sp.rank, sp.salesperson, sp.revenue, `${sp.share_pct}%`, `${sp.cumulative_share_pct}%`, sp.deals_count
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Salesperson Concentration Matrix'], [], spHeaders, ...spRows]), 'Salesperson Concentration');

    XLSX.writeFile(wb, `Revenue_Concentration_Risk_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Corporate PDF Export
  const exportToPDF = () => {
    const doc = new jsPDF('landscape', 'pt', 'a4');

    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('Adwise Labs - Revenue Concentration & Client Risk Exposure Audit', 30, 40);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleString()} | Top 1: ${summary?.top_1_client_pct}% | Top 5: ${summary?.top_5_clients_pct}% | HHI: ${summary?.hhi_score} (${summary?.risk_level})`, 30, 56);

    const headers = ['Rank', 'Client Name', 'Business Name', 'Revenue', 'Share %', 'Cumulative %', 'Risk Tier'];
    const body = clientsConcentration.map(c => [
      `#${c.rank}`,
      c.client_name,
      c.business_name || '-',
      fmt(c.revenue),
      `${c.share_pct}%`,
      `${c.cumulative_share_pct}%`,
      c.risk_tier
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

    doc.save(`Revenue_Concentration_Audit_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="concentration-reports-view">
      {/* 1. Header & Controls */}
      <div className="concentration-header-panel">
        <div className="header-info">
          <div className="header-badge">
            <ShieldAlert size={15} /> Client Dependency & Portfolio Risk Exposure
          </div>
          <h1>Revenue Concentration Reports</h1>
          <p className="header-subtext">
            Audit single-client dependency, Top 1 / Top 5 / Top 10 account exposure, and service/salesperson revenue concentration to safeguard business continuity.
          </p>
        </div>

        <div className="header-action-group">
          {/* Start and End Date Pickers */}
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

          <button className="btn-export btn-export-excel" onClick={exportToExcel} title="Export full concentration workbook">
            <FileSpreadsheet size={16} /> Export Excel
          </button>
          <button className="btn-export btn-export-pdf" onClick={exportToPDF} title="Download certified PDF statement">
            <Download size={16} /> Export PDF
          </button>
          <button className="btn-refresh" onClick={fetchConcentrationReports} title="Refresh concentration analytics">
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {error && <div className="error-banner"><AlertTriangle size={18} /> {error}</div>}

      {/* 2. Macro Concentration & Risk KPI Cards (6 Cards) */}
      <div className="concentration-kpi-grid">
        {/* Card 1: Top 1 Client Share */}
        <div className="conc-kpi-card card-red">
          <div className="card-top">
            <span className="card-title">Top 1 Client Share</span>
            <div className="card-icon"><ShieldAlert size={20} /></div>
          </div>
          <h2 className="card-value text-red">{summary?.top_1_client_pct || 0}%</h2>
          <div className="card-meta">
            <span className="meta-pill red">Single Account Dependency</span>
          </div>
        </div>

        {/* Card 2: Top 5 Clients Share */}
        <div className="conc-kpi-card card-orange">
          <div className="card-top">
            <span className="card-title">Top 5 Clients Share</span>
            <div className="card-icon"><Users size={20} /></div>
          </div>
          <h2 className="card-value text-orange">{summary?.top_5_clients_pct || 0}%</h2>
          <div className="card-meta">
            <span className="meta-pill orange">Top 5 Accounts Exposure</span>
          </div>
        </div>

        {/* Card 3: Top 10 Clients Share */}
        <div className="conc-kpi-card card-purple">
          <div className="card-top">
            <span className="card-title">Top 10 Clients Share</span>
            <div className="card-icon"><Target size={20} /></div>
          </div>
          <h2 className="card-value text-purple">{summary?.top_10_clients_pct || 0}%</h2>
          <div className="card-meta">
            <span className="meta-pill purple">Cumulative Top 10 Share</span>
          </div>
        </div>

        {/* Card 4: HHI Score */}
        <div className="conc-kpi-card card-blue">
          <div className="card-top">
            <span className="card-title">HHI Risk Score</span>
            <div className="card-icon"><Activity size={20} /></div>
          </div>
          <h2 className="card-value text-blue">{summary?.hhi_score || 0}</h2>
          <div className="card-meta">
            <span className="meta-pill blue">{summary?.risk_level}</span>
          </div>
        </div>

        {/* Card 5: Top Service Concentration */}
        <div className="conc-kpi-card card-gold">
          <div className="card-top">
            <span className="card-title">Top Service Dependency</span>
            <div className="card-icon"><Layers size={20} /></div>
          </div>
          <h2 className="card-value text-gold">{summary?.top_service_pct || 0}%</h2>
          <div className="card-meta">
            <span className="meta-pill gold">{summary?.top_service_name}</span>
          </div>
        </div>

        {/* Card 6: Top Salesperson Concentration */}
        <div className="conc-kpi-card card-green">
          <div className="card-top">
            <span className="card-title">Top Salesperson Share</span>
            <div className="card-icon"><Award size={20} /></div>
          </div>
          <h2 className="card-value text-green">{summary?.top_salesperson_pct || 0}%</h2>
          <div className="card-meta">
            <span className="meta-pill green">{summary?.top_salesperson_name}</span>
          </div>
        </div>
      </div>

      {/* 3. Executive Concentration Risk Advisory Banner */}
      <div className={`risk-advisory-banner risk-level-${summary?.risk_color || 'red'}`}>
        <div className="risk-advisory-icon">
          <AlertCircle size={28} />
        </div>
        <div className="risk-advisory-content">
          <h4>Executive Risk Alert: {summary?.risk_level}</h4>
          <p>
            {summary?.top_1_client_pct >= 25 ? (
              <>
                <strong>High Revenue Concentration Detected!</strong> Your top client accounts for <strong>{summary?.top_1_client_pct}%</strong> of total agency revenue, and your Top 5 clients account for <strong>{summary?.top_5_clients_pct}%</strong>. If a single primary account pauses retainers, monthly cash flow will experience severe strain. Diversification of client acquisition is strongly recommended.
              </>
            ) : (
              <>
                <strong>Healthy Revenue Distribution:</strong> Your top account represents <strong>{summary?.top_1_client_pct}%</strong> of total agency revenue. Client portfolio exposure is evenly balanced across accounts.
              </>
            )}
          </p>
        </div>
      </div>

      {/* 4. Visual Analytics Grid */}
      <div className="analytics-dual-charts-grid">
        {/* Left Chart: Pareto Lorenz Cumulative Concentration Curve */}
        <div className="chart-container-card">
          <div className="chart-card-header">
            <h4>
              <TrendingUp size={18} color="#2563eb" /> Pareto Cumulative Concentration Curve (%)
            </h4>
          </div>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lorenzCurveData} margin={{ top: 15, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="rank" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(val) => [`${val}%`, '']} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="Cumulative Share %" stroke="#2563eb" strokeWidth={3} dot={{ r: 5, fill: '#2563eb' }} />
                <Line type="monotone" dataKey="Pareto 80% Benchmark" stroke="#ef4444" strokeDasharray="5 5" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Chart: Top Clients Revenue Share Donut */}
        <div className="chart-container-card">
          <div className="chart-card-header">
            <h4>
              <PieIcon size={18} color="#8b5cf6" /> Top Clients Revenue Share (PKR)
            </h4>
          </div>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={clientsDonutData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {clientsDonutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CLIENT_PIE_COLORS[index % CLIENT_PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => [`Rs ${Number(val).toLocaleString()}`, 'Revenue']} />
                <Legend wrapperStyle={{ fontSize: '11px' }} layout="horizontal" align="center" verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. Sub-Navigation Tabs */}
      <div className="acct-view-tabs-bar">
        <button
          className={`acct-view-tab ${activeSubTab === 'clients-matrix' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('clients-matrix')}
        >
          <Users size={16} /> Client Concentration Matrix ({clientsConcentration.length})
        </button>
        <button
          className={`acct-view-tab ${activeSubTab === 'services-matrix' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('services-matrix')}
        >
          <Layers size={16} /> Service Concentration Matrix ({servicesConcentration.length})
        </button>
        <button
          className={`acct-view-tab ${activeSubTab === 'salespeople-matrix' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('salespeople-matrix')}
        >
          <Award size={16} /> Salesperson Dependency Matrix ({salespeopleConcentration.length})
        </button>
      </div>

      {/* 6. TAB 1: Client Concentration Matrix */}
      {activeSubTab === 'clients-matrix' && (
        <div className="service-matrix-card">
          <div className="matrix-header-bar">
            <div>
              <h4>Comprehensive Client Revenue Concentration Matrix</h4>
              <p>Ranked account share %, cumulative portfolio %, and dependency risk tiers</p>
            </div>

            <div className="matrix-filters-row">
              <div className="search-input-wrap">
                <Search size={15} color="#64748b" />
                <input
                  type="text"
                  placeholder="Search client or business..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
              </div>
            </div>
          </div>

          <div className="table-responsive-wrapper" style={{ overflowX: 'auto' }}>
            <table className="modern-service-table">
              <thead>
                <tr>
                  <th style={{ width: '60px', textAlign: 'center' }}>Rank</th>
                  <th>Client / Business Name</th>
                  <th style={{ textAlign: 'right' }}>Revenue Billed</th>
                  <th style={{ textAlign: 'center' }}>Share %</th>
                  <th style={{ textAlign: 'center' }}>Cumulative Share %</th>
                  <th style={{ textAlign: 'center' }}>Invoices</th>
                  <th style={{ textAlign: 'center' }}>Dependency Risk Tier</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedClients.length === 0 ? (
                  <tr><td colSpan="8" className="table-empty-cell">No matching client concentration records found.</td></tr>
                ) : (
                  paginatedClients.map((c, idx) => (
                    <tr key={idx} className="service-row-hover">
                      <td style={{ textAlign: 'center', fontWeight: 800, color: '#2563eb' }}>#{c.rank}</td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{c.client_name}</div>
                        {c.business_name && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.business_name}</div>}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{fmt(c.revenue)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`share-pill ${c.share_pct >= 25 ? 'share-high' : (c.share_pct >= 10 ? 'share-mid' : 'share-low')}`}>
                          {c.share_pct}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#475569' }}>{c.cumulative_share_pct}%</td>
                      <td style={{ textAlign: 'center', color: '#64748b' }}>{c.invoices_count}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`risk-tier-pill risk-${c.risk_tier.toLowerCase().replace(/[^a-z]/g, '-')}`}>
                          {c.risk_tier}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {c.whatsapp_number && (
                          <a
                            href={`https://wa.me/${c.whatsapp_number.replace(/\D/g, '')}?text=${encodeURIComponent(
                              `*ADWISE LABS - ACCOUNT STATEMENT*\n\n` +
                              `Dear *${c.client_name}*,\n\n` +
                              `Thank you for your ongoing partnership with Adwise Labs. Your total account billing stands at *${fmt(c.revenue)}*.\n\n` +
                              `Best regards,\n*Adwise Labs Executive Management*`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-whatsapp-action"
                            title="Send Account Appreciation Message"
                          >
                            <MessageCircle size={14} color="#10b981" /> Message
                          </a>
                        )}
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
                Showing <strong>{filteredClients.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</strong> to <strong>{Math.min(currentPage * itemsPerPage, filteredClients.length)}</strong> of <strong>{filteredClients.length}</strong> clients
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
              totalItems={filteredClients.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}

      {/* 7. TAB 2: Service Concentration Matrix */}
      {activeSubTab === 'services-matrix' && (
        <div className="statement-sheet-card">
          <div className="statement-sheet-header">
            <h3>Service Line Revenue Concentration Matrix</h3>
            <p>Percentage of total agency billing dependent on specific core service offerings.</p>
          </div>

          <table className="financial-statement-table">
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ width: '60px', padding: '0.85rem 1.5rem', textAlign: 'center' }}>Rank</th>
                <th style={{ textAlign: 'left' }}>Service Line</th>
                <th style={{ textAlign: 'right' }}>Revenue Billed</th>
                <th style={{ textAlign: 'center' }}>Revenue Share %</th>
                <th style={{ textAlign: 'center' }}>Cumulative Share %</th>
                <th style={{ textAlign: 'center', paddingRight: '1.5rem' }}>Deliverables Volume</th>
              </tr>
            </thead>
            <tbody>
              {servicesConcentration.map((s, idx) => (
                <tr key={idx}>
                  <td style={{ textAlign: 'center', fontWeight: 800, color: '#2563eb', paddingLeft: '1.5rem' }}>#{s.rank}</td>
                  <td style={{ fontWeight: 700, color: '#0f172a' }}>{s.service}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{fmt(s.revenue)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="share-pill share-mid">{s.share_pct}%</span>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#475569' }}>{s.cumulative_share_pct}%</td>
                  <td style={{ textAlign: 'center', paddingRight: '1.5rem', color: '#64748b' }}>{s.count} Items</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 8. TAB 3: Salesperson Dependency Matrix */}
      {activeSubTab === 'salespeople-matrix' && (
        <div className="statement-sheet-card">
          <div className="statement-sheet-header">
            <h3>Salesperson & Agent Dependency Matrix</h3>
            <p>Assess sales representative concentration and individual revenue contribution.</p>
          </div>

          <table className="financial-statement-table">
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ width: '60px', padding: '0.85rem 1.5rem', textAlign: 'center' }}>Rank</th>
                <th style={{ textAlign: 'left' }}>Salesperson / Representative</th>
                <th style={{ textAlign: 'right' }}>Revenue Closed</th>
                <th style={{ textAlign: 'center' }}>Share %</th>
                <th style={{ textAlign: 'center' }}>Cumulative Share %</th>
                <th style={{ textAlign: 'center', paddingRight: '1.5rem' }}>Deals Closed</th>
              </tr>
            </thead>
            <tbody>
              {salespeopleConcentration.map((sp, idx) => (
                <tr key={idx}>
                  <td style={{ textAlign: 'center', fontWeight: 800, color: '#2563eb', paddingLeft: '1.5rem' }}>#{sp.rank}</td>
                  <td style={{ fontWeight: 700, color: '#0f172a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <Award size={15} color="#2563eb" />
                      {sp.salesperson}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{fmt(sp.revenue)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="share-pill share-mid">{sp.share_pct}%</span>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#475569' }}>{sp.cumulative_share_pct}%</td>
                  <td style={{ textAlign: 'center', paddingRight: '1.5rem', color: '#64748b' }}>{sp.deals_count} Deals</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
