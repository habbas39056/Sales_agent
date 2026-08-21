import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  FileSpreadsheet, Download, RefreshCw, AlertTriangle, CheckCircle,
  TrendingUp, TrendingDown, DollarSign, Award, Target, Layers,
  BarChart2, PieChart as PieChartIcon, Search, Filter, ChevronRight,
  Eye, X, ShoppingBag, Briefcase, Users, FileText, ArrowUpRight,
  ArrowDownRight, HelpCircle, MessageCircle, Mail, Calendar
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Pagination from '../../components/Pagination';
import './ProductReportView.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const PIE_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#6366f1', '#14b8a6', '#f97316', '#64748b'];

export default function ProductReportView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data from backend
  const [summary, setSummary] = useState(null);
  const [services, setServices] = useState([]);
  const [mostProfitable, setMostProfitable] = useState([]);
  const [leastProfitable, setLeastProfitable] = useState([]);
  const [highestMargin, setHighestMargin] = useState([]);

  // Year & Date Range Filters
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [datePreset, setDatePreset] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // 360° Service Detail Modal
  const [selectedService, setSelectedService] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [serviceDetails, setServiceDetails] = useState(null);

  // Handle Date Preset change
  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
      setSelectedYear('ALL');
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(y, m, 1).toISOString().slice(0, 10);
      const lastDay = new Date(y, m + 1, 0).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
      setSelectedYear('ALL');
    } else if (preset === 'LAST_MONTH') {
      const firstDay = new Date(y, m - 1, 1).toISOString().slice(0, 10);
      const lastDay = new Date(y, m, 0).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
      setSelectedYear('ALL');
    } else if (preset === 'THIS_QUARTER') {
      const qMonth = Math.floor(m / 3) * 3;
      const firstDay = new Date(y, qMonth, 1).toISOString().slice(0, 10);
      const lastDay = new Date(y, qMonth + 3, 0).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
      setSelectedYear('ALL');
    } else if (preset === 'THIS_YEAR') {
      const firstDay = new Date(y, 0, 1).toISOString().slice(0, 10);
      const lastDay = new Date(y, 11, 31).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
      setSelectedYear(y.toString());
    }
  };

  const fetchServiceReports = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/reports/products`, {
        params: {
          year: selectedYear !== 'ALL' ? selectedYear : undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined
        }
      });
      setSummary(res.data.summary || null);
      setServices(res.data.services || []);
      setMostProfitable(res.data.most_profitable || []);
      setLeastProfitable(res.data.least_profitable || []);
      setHighestMargin(res.data.highest_margin || []);
    } catch (err) {
      console.error('Error fetching service product reports:', err);
      setError(err.response?.data?.error || 'Failed to load service reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceReports();
  }, [selectedYear, startDate, endDate]);

  // Open 360° Drilldown
  const openService360 = async (service) => {
    setSelectedService(service);
    setModalLoading(true);
    try {
      const res = await axios.get(`${API_URL}/reports/products/details/${encodeURIComponent(service.service_name)}`);
      setServiceDetails(res.data);
    } catch (err) {
      console.error('Error fetching service details:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const closeService360 = () => {
    setSelectedService(null);
    setServiceDetails(null);
  };

  // Format Currency PKR
  const fmt = (val) => {
    const n = Number(val || 0);
    return `Rs ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Filtered Services List
  const filteredServices = useMemo(() => {
    return services.filter(s => {
      const matchesSearch = s.service_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTier = tierFilter === 'ALL' || s.performance_tier.includes(tierFilter);
      return matchesSearch && matchesTier;
    });
  }, [services, searchTerm, tierFilter]);

  // Paginated Services
  const paginatedServices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredServices.slice(start, start + itemsPerPage);
  }, [filteredServices, currentPage, itemsPerPage]);

  // Chart Data: Revenue vs Cost vs Profit (Top 6 Active Services)
  const groupedBarChartData = useMemo(() => {
    return services
      .filter(s => s.revenue_billed > 0)
      .slice(0, 7)
      .map(s => ({
        name: s.service_name.length > 15 ? s.service_name.slice(0, 14) + '…' : s.service_name,
        Revenue: s.revenue_billed,
        Cost: s.direct_expenses,
        Profit: s.gross_profit
      }));
  }, [services]);

  // Chart Data: Revenue Share Donut
  const revenueShareChartData = useMemo(() => {
    return services
      .filter(s => s.revenue_billed > 0)
      .map(s => ({
        name: s.service_name,
        value: s.revenue_billed
      }));
  }, [services]);

  // Chart Data: Profit Margin Pareto
  const marginParetoChartData = useMemo(() => {
    return services
      .filter(s => s.revenue_billed > 0)
      .sort((a, b) => b.profit_margin_pct - a.profit_margin_pct)
      .map(s => ({
        name: s.service_name.length > 16 ? s.service_name.slice(0, 15) + '…' : s.service_name,
        margin: s.profit_margin_pct
      }));
  }, [services]);

  // Multi-Sheet Excel Export
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Service Profitability Matrix
    const matrixHeaders = [
      'Service Name', 'Times Sold', 'Quantity Delivered', 'Revenue Billed (PKR)',
      'Revenue Collected (PKR)', 'Direct Costs (PKR)', 'Gross Profit (PKR)',
      'Profit Margin %', 'Clients Count', 'Projects Count', 'Average Selling Price (ASP)',
      'Average Delivery Cost (ADC)', 'Revenue Share %', 'Performance Tier'
    ];

    const matrixRows = services.map(s => [
      s.service_name, s.times_sold, s.quantity_sold, s.revenue_billed,
      s.revenue_collected, s.direct_expenses, s.gross_profit,
      `${s.profit_margin_pct}%`, s.client_count, s.project_count,
      s.asp, s.adc, `${s.revenue_share_pct}%`, s.performance_tier
    ]);

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Adwise Labs - Service & Product Unit Economics Report'],
      [`Year: ${selectedYear} | Generated: ${new Date().toLocaleString()}`],
      [],
      matrixHeaders,
      ...matrixRows
    ]), 'Service Economics');

    // Sheet 2: Executive Summary
    const summaryRows = [
      ['Service Portfolio Executive Metrics'],
      [],
      ['Metric', 'Value'],
      ['Total Service Revenue', summary?.total_service_revenue || 0],
      ['Total Direct Delivery Costs', summary?.total_direct_costs || 0],
      ['Total Gross Profit', summary?.total_gross_profit || 0],
      ['Blended Portfolio Margin', `${summary?.blended_service_margin || 0}%`],
      ['Average Ticket Size (ASP)', summary?.avg_service_ticket || 0],
      ['Top Revenue Service', summary?.top_revenue_service || '-'],
      ['Most Profitable Service', summary?.most_profitable_service || '-'],
      ['Highest Margin Offering', summary?.highest_margin_service || '-']
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Portfolio Summary');

    XLSX.writeFile(wb, `Service_Product_Profitability_Report_${selectedYear}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // PDF Export
  const exportToPDF = () => {
    const doc = new jsPDF('landscape', 'pt', 'a4');

    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('Adwise Labs - Service & Product Profitability Report', 30, 40);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Year: ${selectedYear} | Generated: ${new Date().toLocaleString()} | Unit Economics & Margin Audit`, 30, 56);

    const headers = ['Service Name', 'Sold', 'Revenue Billed', 'Direct Costs', 'Gross Profit', 'Margin %', 'Clients', 'ASP', 'Tier'];
    const body = services.map(s => [
      s.service_name,
      s.times_sold,
      fmt(s.revenue_billed),
      fmt(s.direct_expenses),
      fmt(s.gross_profit),
      `${s.profit_margin_pct}%`,
      s.client_count,
      fmt(s.asp),
      s.performance_tier.replace(/[⭐💎🚀⚠️🌱]/g, '').trim()
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

    doc.save(`Service_Profitability_Report_${selectedYear}.pdf`);
  };

  return (
    <div className="product-reports-view">
      {/* 1. Header & Controls */}
      <div className="product-header-panel">
        <div className="header-info">
          <div className="header-badge">
            <ShoppingBag size={15} /> Unit Economics & Service Profitability
          </div>
          <h1>Service & Product Reports</h1>
          <p className="header-subtext">
            Analyze agency revenue, direct delivery expenses, gross margins, and client volume across all core service offerings.
          </p>
        </div>

        <div className="header-action-group">
          {/* Start and End Date Filter Controls */}
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

          <button className="btn-export btn-export-excel" onClick={exportToExcel} title="Export full economics workbook">
            <FileSpreadsheet size={16} /> Export Excel
          </button>
          <button className="btn-export btn-export-pdf" onClick={exportToPDF} title="Download corporate PDF statement">
            <Download size={16} /> Export PDF
          </button>
          <button className="btn-refresh" onClick={fetchServiceReports} title="Refresh service analytics">
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {error && <div className="error-banner"><AlertTriangle size={18} /> {error}</div>}

      {/* 2. Macro Unit Economics KPI Grid (7 Cards) */}
      <div className="product-kpi-grid">
        {/* Card 1: Total Service Revenue */}
        <div className="prod-kpi-card card-blue">
          <div className="card-top">
            <span className="card-title">Total Service Revenue</span>
            <div className="card-icon"><DollarSign size={20} /></div>
          </div>
          <h2 className="card-value text-blue">{fmt(summary?.total_service_revenue)}</h2>
          <div className="card-meta">
            <span className="meta-pill blue">{summary?.total_orders_sold || 0} Orders Billed</span>
          </div>
        </div>

        {/* Card 2: Direct Delivery Costs */}
        <div className="prod-kpi-card card-red">
          <div className="card-top">
            <span className="card-title">Direct Delivery Costs</span>
            <div className="card-icon"><ArrowDownRight size={20} /></div>
          </div>
          <h2 className="card-value text-red">{fmt(summary?.total_direct_costs)}</h2>
          <div className="card-meta">
            <span className="meta-pill red">Project & Contractor Spend</span>
          </div>
        </div>

        {/* Card 3: Gross Service Profit */}
        <div className="prod-kpi-card card-green">
          <div className="card-top">
            <span className="card-title">Gross Service Profit</span>
            <div className="card-icon"><TrendingUp size={20} /></div>
          </div>
          <h2 className="card-value text-green">{fmt(summary?.total_gross_profit)}</h2>
          <div className="card-meta">
            <span className="meta-pill green">Revenue minus Direct Outlay</span>
          </div>
        </div>

        {/* Card 4: Blended Margin % */}
        <div className="prod-kpi-card card-purple">
          <div className="card-top">
            <span className="card-title">Blended Service Margin</span>
            <div className="card-icon"><Award size={20} /></div>
          </div>
          <h2 className="card-value text-purple">{summary?.blended_service_margin || 0}%</h2>
          <div className="card-meta">
            <span className="meta-pill purple">Portfolio Profitability</span>
          </div>
        </div>

        {/* Card 5: Average Ticket Size (ASP) */}
        <div className="prod-kpi-card card-teal">
          <div className="card-top">
            <span className="card-title">Average Selling Price (ASP)</span>
            <div className="card-icon"><Target size={20} /></div>
          </div>
          <h2 className="card-value text-teal">{fmt(summary?.avg_service_ticket)}</h2>
          <div className="card-meta">
            <span className="meta-pill teal">Avg Ticket / Order</span>
          </div>
        </div>

        {/* Card 6: Top Grossing Service */}
        <div className="prod-kpi-card card-orange">
          <div className="card-top">
            <span className="card-title">Top Revenue Engine</span>
            <div className="card-icon"><ArrowUpRight size={20} /></div>
          </div>
          <h2 className="card-value text-orange" style={{ fontSize: '1.15rem' }}>{summary?.top_revenue_service}</h2>
          <div className="card-meta">
            <span className="meta-pill orange">Highest Total Volume</span>
          </div>
        </div>

        {/* Card 7: Most Profitable Offering */}
        <div className="prod-kpi-card card-gold">
          <div className="card-top">
            <span className="card-title">Most Profitable Service</span>
            <div className="card-icon"><Award size={20} /></div>
          </div>
          <h2 className="card-value text-gold" style={{ fontSize: '1.15rem' }}>{summary?.most_profitable_service}</h2>
          <div className="card-meta">
            <span className="meta-pill gold">Highest Net Contribution</span>
          </div>
        </div>
      </div>

      {/* 3. Interactive Visual Analytics Row */}
      <div className="analytics-dual-charts-grid">
        {/* Left Chart: Revenue vs Cost vs Profit */}
        <div className="chart-container-card">
          <div className="chart-card-header">
            <h4>
              <BarChart2 size={18} color="#2563eb" /> Revenue vs Cost vs Profit by Service (PKR)
            </h4>
          </div>
          <div style={{ height: '270px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={groupedBarChartData} margin={{ top: 15, right: 20, left: 10, bottom: 20 }}>
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

        {/* Right Chart: Service Revenue Share Donut */}
        <div className="chart-container-card">
          <div className="chart-card-header">
            <h4>
              <PieChartIcon size={18} color="#8b5cf6" /> Service Revenue Portfolio Share
            </h4>
          </div>
          <div style={{ height: '270px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={revenueShareChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {revenueShareChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => [`Rs ${Number(val).toLocaleString()}`, 'Revenue']} />
                <Legend wrapperStyle={{ fontSize: '10px' }} layout="horizontal" align="center" verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. Profitability Rankings Highlights Row */}
      <div className="rankings-highlight-grid">
        {/* Most Profitable Services */}
        <div className="rankings-card rank-card-green">
          <div className="rankings-card-header">
            <TrendingUp size={18} color="#10b981" />
            <h4>Most Profitable Services (High Net Contribution)</h4>
          </div>
          <div className="rankings-list">
            {mostProfitable.length === 0 ? (
              <div className="rankings-empty">No active sales recorded yet.</div>
            ) : (
              mostProfitable.map((s, idx) => (
                <div key={idx} className="ranking-item-row" onClick={() => openService360(s)}>
                  <div className="rank-badge green-rank">#{idx + 1}</div>
                  <div className="rank-info">
                    <span className="rank-name">{s.service_name}</span>
                    <span className="rank-meta">{s.times_sold} orders • {s.client_count} clients</span>
                  </div>
                  <div className="rank-numbers">
                    <span className="rank-profit text-green">{fmt(s.gross_profit)}</span>
                    <span className="rank-margin">{s.profit_margin_pct}% margin</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Highest Margin % Services */}
        <div className="rankings-card rank-card-purple">
          <div className="rankings-card-header">
            <Award size={18} color="#8b5cf6" />
            <h4>Highest Margin Drivers (%)</h4>
          </div>
          <div className="rankings-list">
            {highestMargin.length === 0 ? (
              <div className="rankings-empty">No active sales recorded yet.</div>
            ) : (
              highestMargin.map((s, idx) => (
                <div key={idx} className="ranking-item-row" onClick={() => openService360(s)}>
                  <div className="rank-badge purple-rank">#{idx + 1}</div>
                  <div className="rank-info">
                    <span className="rank-name">{s.service_name}</span>
                    <span className="rank-meta">ASP: {fmt(s.asp)}</span>
                  </div>
                  <div className="rank-numbers">
                    <span className="rank-profit text-purple">{s.profit_margin_pct}%</span>
                    <span className="rank-margin">{fmt(s.revenue_billed)} billed</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 5. Comprehensive Service Unit Economics Matrix Table */}
      <div className="service-matrix-card">
        <div className="matrix-header-bar">
          <div>
            <h4>Service & Product Unit Economics Matrix</h4>
            <p>Showing {filteredServices.length} offerings across standard agency service lines</p>
          </div>

          <div className="matrix-filters-row">
            <div className="search-input-wrap">
              <Search size={15} color="#64748b" />
              <input
                type="text"
                placeholder="Search service name..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>

            <select
              className="tier-filter-dropdown"
              value={tierFilter}
              onChange={(e) => { setTierFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="ALL">All Performance Tiers</option>
              <option value="Star Performer">⭐ Star Performer</option>
              <option value="High Margin Engine">💎 High Margin Engine</option>
              <option value="Volume Driver">🚀 Volume Driver</option>
              <option value="Low Margin Risk">⚠️ Low Margin Risk</option>
              <option value="Pipeline Offering">🌱 Pipeline Offering</option>
            </select>
          </div>
        </div>

        <div className="table-responsive-wrapper" style={{ overflowX: 'auto' }}>
          <table className="modern-service-table">
            <thead>
              <tr>
                <th>Service / Product Name</th>
                <th style={{ textAlign: 'right' }}>Revenue Billed</th>
                <th style={{ textAlign: 'right' }}>Collected</th>
                <th style={{ textAlign: 'right' }}>Direct Cost</th>
                <th style={{ textAlign: 'right' }}>Gross Profit</th>
                <th style={{ textAlign: 'center' }}>Margin %</th>
                <th style={{ textAlign: 'center' }}>Clients</th>
                <th style={{ textAlign: 'center' }}>Orders</th>
                <th style={{ textAlign: 'right' }}>Avg Price (ASP)</th>
                <th style={{ textAlign: 'center' }}>Performance Tier</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedServices.length === 0 ? (
                <tr><td colSpan="11" className="table-empty-cell">No matching service records found.</td></tr>
              ) : (
                paginatedServices.map((s, idx) => (
                  <tr key={idx} className="service-row-hover">
                    <td>
                      <div className="service-name-cell">
                        <ShoppingBag size={15} color="#2563eb" />
                        <strong>{s.service_name}</strong>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{fmt(s.revenue_billed)}</td>
                    <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{fmt(s.revenue_collected)}</td>
                    <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{fmt(s.direct_expenses)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: s.gross_profit >= 0 ? '#10b981' : '#ef4444' }}>
                      {fmt(s.gross_profit)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`margin-pill ${s.profit_margin_pct >= 70 ? 'margin-high' : (s.profit_margin_pct >= 40 ? 'margin-mid' : 'margin-low')}`}>
                        {s.profit_margin_pct}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{s.client_count}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{s.times_sold}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#475569' }}>{fmt(s.asp)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="performance-tier-badge">
                        {s.performance_tier}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn-view-360"
                        onClick={() => openService360(s)}
                        title="View 360° Service Intelligence"
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
              Showing <strong>{filteredServices.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</strong> to <strong>{Math.min(currentPage * itemsPerPage, filteredServices.length)}</strong> of <strong>{filteredServices.length}</strong> services
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
            totalItems={filteredServices.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* 6. 360° Service Intelligence Modal */}
      {selectedService && (
        <div className="service-modal-overlay" onClick={closeService360}>
          <div className="service-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="service-modal-header">
              <div className="modal-title-group">
                <div className="service-icon-box"><ShoppingBag size={24} color="#2563eb" /></div>
                <div>
                  <h3>{selectedService.service_name} - 360° Service Intelligence</h3>
                  <p>{selectedService.performance_tier} • Unit Economics & Transaction Audit</p>
                </div>
              </div>
              <button className="btn-close-modal" onClick={closeService360}>
                <X size={20} />
              </button>
            </div>

            <div className="service-modal-body">
              {/* Modal KPIs */}
              <div className="modal-kpi-row">
                <div className="modal-kpi-box">
                  <span className="mkpi-label">Total Revenue</span>
                  <span className="mkpi-val text-blue">{fmt(selectedService.revenue_billed)}</span>
                </div>
                <div className="modal-kpi-box">
                  <span className="mkpi-label">Gross Profit</span>
                  <span className="mkpi-val text-green">{fmt(selectedService.gross_profit)}</span>
                </div>
                <div className="modal-kpi-box">
                  <span className="mkpi-label">Profit Margin</span>
                  <span className="mkpi-val text-purple">{selectedService.profit_margin_pct}%</span>
                </div>
                <div className="modal-kpi-box">
                  <span className="mkpi-label">Average Ticket (ASP)</span>
                  <span className="mkpi-val text-teal">{fmt(selectedService.asp)}</span>
                </div>
                <div className="modal-kpi-box">
                  <span className="mkpi-label">Unique Clients</span>
                  <span className="mkpi-val text-orange">{selectedService.client_count} Clients</span>
                </div>
              </div>

              {/* Transactions Ledger in Modal */}
              <div className="modal-transactions-section">
                <h4>Sold Invoice Line Items & Client Buyers</h4>
                {modalLoading ? (
                  <div className="modal-loading-state"><RefreshCw size={24} className="spinning" /> Loading transactions...</div>
                ) : (
                  <div className="table-responsive-wrapper" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                    <table className="modern-service-table">
                      <thead>
                        <tr>
                          <th>Invoice #</th>
                          <th>Client Name</th>
                          <th>Line Item Description</th>
                          <th>Quantity</th>
                          <th style={{ textAlign: 'right' }}>Unit Price</th>
                          <th style={{ textAlign: 'right' }}>Line Total</th>
                          <th>Date</th>
                          <th style={{ textAlign: 'center' }}>Contact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!serviceDetails || serviceDetails.items.length === 0 ? (
                          <tr><td colSpan="8" className="table-empty-cell">No transaction items found.</td></tr>
                        ) : (
                          serviceDetails.items.map((item, i) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 700, color: '#2563eb' }}>{item.invoice_number || `INV-${item.id}`}</td>
                              <td>
                                <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.client_name}</div>
                                {item.business_name && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.business_name}</div>}
                              </td>
                              <td>{item.description}</td>
                              <td style={{ fontWeight: 600 }}>{item.quantity} {item.unit || ''}</td>
                              <td style={{ textAlign: 'right' }}>{fmt(item.unit_price)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>{fmt(item.total)}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>{item.issue_date?.slice(0, 10) || '-'}</td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                                  {item.client_phone && (
                                    <a
                                      href={`https://wa.me/${item.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                        `Hello *${item.client_name}*, thank you for partnering with Adwise Labs on *${selectedService.service_name}*!`
                                      )}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="icon-contact-btn icon-whatsapp-btn"
                                      title="WhatsApp Notification"
                                    >
                                      <MessageCircle size={14} color="#10b981" />
                                    </a>
                                  )}
                                  {item.client_email && (
                                    <a
                                      href={`mailto:${item.client_email}?subject=Regarding%20${encodeURIComponent(selectedService.service_name)}`}
                                      className="icon-contact-btn"
                                      title="Email Client"
                                    >
                                      <Mail size={14} color="#2563eb" />
                                    </a>
                                  )}
                                </div>
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
