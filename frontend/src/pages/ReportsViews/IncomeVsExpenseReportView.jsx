import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  TrendingUp, TrendingDown, DollarSign, Calendar, Download, RefreshCw,
  FileSpreadsheet, ArrowUpRight, ArrowDownRight, ShieldCheck, Activity,
  CheckCircle, AlertTriangle, BarChart2, PieChart as PieChartIcon,
  Layers, Percent, Award, Sparkles, FileText, ChevronRight, HelpCircle
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, BarChart
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './IncomeVsExpenseReportView.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function IncomeVsExpenseReportView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected Year & Date Filters
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Server Data
  const [summary, setSummary] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [quarterlyData, setQuarterlyData] = useState([]);

  // Active Sub-view Tab (overview, monthly-matrix, quarterly)
  const [activeTab, setActiveTab] = useState('overview');

  const fetchIncomeVsExpense = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedYear) params.append('year', selectedYear);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const res = await axios.get(`${API_URL}/reports/income-vs-expense?${params.toString()}`);
      setSummary(res.data.summary || null);
      setMonthlyData(res.data.monthly_data || []);
      setQuarterlyData(res.data.quarterly_data || []);
    } catch (err) {
      console.error('Error fetching income vs expense report:', err);
      setError(err.response?.data?.error || 'Failed to load income vs expense analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncomeVsExpense();
  }, [selectedYear, startDate, endDate]);

  // Format Currency (PKR)
  const fmt = (val) => {
    const n = Number(val || 0);
    return `Rs ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Custom Chart Tooltip
  const CustomComposedTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-chart-tooltip">
          <p className="tooltip-title font-bold">{label} {selectedYear}</p>
          <div className="tooltip-divider" />
          {payload.map((entry, index) => (
            <div key={`item-${index}`} className="tooltip-row">
              <span className="tooltip-dot" style={{ backgroundColor: entry.color }} />
              <span className="tooltip-label">{entry.name}:</span>
              <span className="tooltip-val font-bold">{fmt(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Export to Multi-Sheet Excel Workbook
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Executive P&L Summary
    const summaryData = [
      [`Adwise Labs - Corporate Income vs Expense Report (${selectedYear})`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ['Metric', 'Value (PKR)'],
      ['Total Gross Income (Receipts / Inflow)', summary?.total_income || 0],
      ['Total Operational Expenses (Outflow)', summary?.total_expense || 0],
      ['Net Profit / Cash Surplus', summary?.net_profit_loss || 0],
      ['Overall Net Profit Margin (%)', `${summary?.overall_profit_margin || 0}%`],
      ['Expense Coverage Ratio', summary?.expense_coverage_ratio || 0],
      ['Average Monthly Revenue', summary?.avg_monthly_income || 0],
      ['Average Monthly Burn', summary?.avg_monthly_expense || 0],
      ['Highest Earning Month', summary?.highest_income_month || 'N/A'],
      ['Highest Spending Month', summary?.highest_expense_month || 'N/A']
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Financial Summary');

    // Sheet 2: 12-Month Comparative Ledger
    const monthlyHeaders = ['Month', 'Gross Income (PKR)', 'Total Expense (PKR)', 'Net Profit / (Deficit) (PKR)', 'Profit Margin (%)', 'Expense Ratio (%)', 'Cumulative Surplus (PKR)', 'Status'];
    const monthlyRows = monthlyData.map(m => [
      m.month_name,
      m.income,
      m.expense,
      m.net_profit,
      `${m.margin_percentage}%`,
      `${m.expense_ratio}%`,
      m.cumulative_surplus,
      m.status
    ]);

    monthlyRows.push([
      'ANNUAL TOTALS',
      summary?.total_income || 0,
      summary?.total_expense || 0,
      summary?.net_profit_loss || 0,
      `${summary?.overall_profit_margin || 0}%`,
      '-',
      summary?.net_profit_loss || 0,
      summary?.is_profitable ? 'NET SURPLUS' : 'NET DEFICIT'
    ]);

    const wsMonthly = XLSX.utils.aoa_to_sheet([
      [`12-Month Performance Audit (${selectedYear})`],
      [],
      monthlyHeaders,
      ...monthlyRows
    ]);
    XLSX.utils.book_append_sheet(wb, wsMonthly, 'Monthly Comparative Matrix');

    // Sheet 3: Quarterly Performance
    const qHeaders = ['Quarter', 'Gross Income (PKR)', 'Total Expense (PKR)', 'Net Profit (PKR)', 'Profit Margin (%)'];
    const qRows = quarterlyData.map(q => [
      q.quarter,
      q.income,
      q.expense,
      q.net_profit,
      `${q.margin_percentage}%`
    ]);
    const wsQ = XLSX.utils.aoa_to_sheet([
      [`Quarterly Performance Overview (${selectedYear})`],
      [],
      qHeaders,
      ...qRows
    ]);
    XLSX.utils.book_append_sheet(wb, wsQ, 'Quarterly Breakdown');

    XLSX.writeFile(wb, `Income_vs_Expense_${selectedYear}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export to Corporate PDF Statement
  const exportToPDF = () => {
    const doc = new jsPDF('landscape', 'pt', 'a4');

    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(`Corporate Income vs Expense Performance Statement (${selectedYear})`, 30, 40);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleString()} | Adwise Labs ERP`, 30, 56);

    const headers = ['Month', 'Gross Income', 'Total Expense', 'Net Profit / (Deficit)', 'Margin %', 'Cumulative Surplus', 'Status'];
    const body = monthlyData.map(m => [
      m.month_name,
      fmt(m.income),
      fmt(m.expense),
      fmt(m.net_profit),
      `${m.margin_percentage}%`,
      fmt(m.cumulative_surplus),
      m.status
    ]);

    body.push([
      'ANNUAL TOTALS',
      fmt(summary?.total_income || 0),
      fmt(summary?.total_expense || 0),
      fmt(summary?.net_profit_loss || 0),
      `${summary?.overall_profit_margin || 0}%`,
      fmt(summary?.net_profit_loss || 0),
      summary?.is_profitable ? 'SURPLUS' : 'DEFICIT'
    ]);

    autoTable(doc, {
      startY: 75,
      head: [headers],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 30, right: 30 }
    });

    doc.save(`Income_vs_Expense_Statement_${selectedYear}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="professional-income-expense-report">
      {/* 1. Header Panel */}
      <div className="income-expense-header-panel">
        <div className="header-info">
          <div className="header-badge">
            <TrendingUp size={15} /> Profitability & Cash Flow Intelligence
          </div>
          <h1>Income vs Expense Performance</h1>
          <p className="header-subtext">
            Month-by-month comparative financial analysis: gross revenue inflows, operational cash burn, net profitability margins, and cumulative surplus trajectory.
          </p>
        </div>

        <div className="header-action-group">
          {/* Year Selector */}
          <div className="year-picker-badge">
            <Calendar size={15} />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="year-picker-select"
            >
              <option value={2026}>2026 Fiscal Year</option>
              <option value={2025}>2025 Fiscal Year</option>
              <option value={2024}>2024 Fiscal Year</option>
              <option value={2023}>2023 Fiscal Year</option>
            </select>
          </div>

          <button className="btn-export btn-export-excel" onClick={exportToExcel} title="Export multi-sheet Excel workbook">
            <FileSpreadsheet size={16} /> Export Excel (.xlsx)
          </button>
          <button className="btn-export btn-export-pdf" onClick={exportToPDF} title="Download corporate PDF statement">
            <Download size={16} /> Export PDF (.pdf)
          </button>
          <button className="btn-refresh" onClick={fetchIncomeVsExpense} title="Refresh live analytics">
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {error && <div className="error-banner"><AlertTriangle size={18} /> {error}</div>}

      {/* 2. Macro Financial Health KPI Grid (6 Cards) */}
      <div className="income-expense-kpi-grid">
        {/* Card 1: Total Gross Income */}
        <div className="pnl-kpi-card card-green">
          <div className="card-top">
            <span className="card-title">Total Gross Income Inflow</span>
            <div className="card-icon"><ArrowUpRight size={20} /></div>
          </div>
          <h2 className="card-value text-green">{fmt(summary?.total_income || 0)}</h2>
          <div className="card-meta">
            <span className="meta-pill green">
              <TrendingUp size={12} /> Real Cash Inflow
            </span>
          </div>
        </div>

        {/* Card 2: Total Operational Expenses */}
        <div className="pnl-kpi-card card-red">
          <div className="card-top">
            <span className="card-title">Total Expense Outflow</span>
            <div className="card-icon"><ArrowDownRight size={20} /></div>
          </div>
          <h2 className="card-value text-red">{fmt(summary?.total_expense || 0)}</h2>
          <div className="card-meta">
            <span className="meta-pill red">
              <TrendingDown size={12} /> Operational Burn
            </span>
          </div>
        </div>

        {/* Card 3: Net Cash Surplus / Profit */}
        <div className={`pnl-kpi-card ${(summary?.net_profit_loss || 0) >= 0 ? 'card-emerald' : 'card-rose'}`}>
          <div className="card-top">
            <span className="card-title">Net Profit / Cash Surplus</span>
            <div className="card-icon">
              {(summary?.net_profit_loss || 0) >= 0 ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
            </div>
          </div>
          <h2 className={`card-value ${(summary?.net_profit_loss || 0) >= 0 ? 'text-emerald' : 'text-rose'}`}>
            {fmt(summary?.net_profit_loss || 0)}
          </h2>
          <div className="card-meta">
            <span className={`meta-pill ${(summary?.net_profit_loss || 0) >= 0 ? 'green' : 'red'}`}>
              {(summary?.net_profit_loss || 0) >= 0 ? 'Net Cash Positive' : 'Deficit / Over-Spend'}
            </span>
          </div>
        </div>

        {/* Card 4: Net Profit Margin */}
        <div className="pnl-kpi-card card-blue">
          <div className="card-top">
            <span className="card-title">Net Profit Margin</span>
            <div className="card-icon"><Percent size={20} /></div>
          </div>
          <h2 className="card-value text-blue">{summary?.overall_profit_margin || 0}%</h2>
          <div className="card-meta">
            <span className="meta-pill blue">
              Margin on Inflows
            </span>
          </div>
        </div>

        {/* Card 5: Monthly Average Run-Rate */}
        <div className="pnl-kpi-card card-purple">
          <div className="card-top">
            <span className="card-title">Avg Monthly Inflow / Burn</span>
            <div className="card-icon"><Activity size={20} /></div>
          </div>
          <h2 className="card-value" style={{ fontSize: '1.25rem' }}>
            <span className="text-green">{fmt(Math.round(summary?.avg_monthly_income || 0))}</span>
            <span style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0.35rem' }}>vs</span>
            <span className="text-red">{fmt(Math.round(summary?.avg_monthly_expense || 0))}</span>
          </h2>
          <div className="card-meta">
            <span className="meta-pill purple">
              12-Month Average Run-Rate
            </span>
          </div>
        </div>

        {/* Card 6: Expense Coverage Ratio */}
        <div className="pnl-kpi-card card-teal">
          <div className="card-top">
            <span className="card-title">Expense Coverage Viability</span>
            <div className="card-icon"><ShieldCheck size={20} /></div>
          </div>
          <h2 className="card-value text-teal">{summary?.expense_coverage_ratio || 0}x</h2>
          <div className="card-meta">
            <span className="meta-pill teal">
              Inflow / Outflow Multiple
            </span>
          </div>
        </div>
      </div>

      {/* 3. Visual Charts Suite */}
      <div className="income-expense-charts-grid">
        {/* Primary Chart: Month-by-Month Comparative Composed Bar & Profit Line */}
        <div className="income-expense-chart-card main-chart-card">
          <div className="chart-header">
            <div>
              <h3>
                <BarChart2 size={18} color="#0f172a" /> Month-wise Income vs Expense Comparison ({selectedYear})
              </h3>
              <p className="chart-sub">
                Green bars represent Gross Receipts, Red bars represent Operational Expenditures, and Blue curve traces Net Cash Profit
              </p>
            </div>

            <div className="chart-legend-pills">
              <span className="legend-pill green"><span className="dot green" /> Income Inflows</span>
              <span className="legend-pill red"><span className="dot red" /> Expense Outflows</span>
              <span className="legend-pill blue"><span className="dot blue" /> Net Cash Surplus</span>
            </div>
          </div>

          <div style={{ height: '360px', width: '100%', marginTop: '1rem' }}>
            {monthlyData.length === 0 ? (
              <div className="empty-chart-state">No monthly transaction data found for {selectedYear}.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyData} margin={{ top: 20, right: 25, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month_short" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(val) => `Rs ${(val / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomComposedTooltip />} />
                  <Bar dataKey="income" name="Gross Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="expense" name="Total Expense" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Line type="monotone" dataKey="net_profit" name="Net Profit" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Secondary Chart 1: Cumulative Cash Surplus Trajectory */}
        <div className="income-expense-chart-card">
          <div className="chart-header">
            <div>
              <h3>
                <TrendingUp size={18} color="#10b981" /> Cumulative Cash Growth Trajectory
              </h3>
              <p className="chart-sub">Fiscal year net retained capital growth across 12 months</p>
            </div>
          </div>

          <div style={{ height: '220px', width: '100%', marginTop: '0.75rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 15, right: 20, left: 5, bottom: 10 }}>
                <defs>
                  <linearGradient id="colorSurplus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month_short" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(val) => `Rs ${(val / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(val) => [`Rs ${Number(val).toLocaleString()}`, 'Cumulative Surplus']} />
                <Area type="monotone" dataKey="cumulative_surplus" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSurplus)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Secondary Chart 2: Quarterly Performance Comparison */}
        <div className="income-expense-chart-card">
          <div className="chart-header">
            <div>
              <h3>
                <Layers size={18} color="#6366f1" /> Quarterly Fiscal Performance
              </h3>
              <p className="chart-sub">Grouped quarterly comparative revenue vs burn</p>
            </div>
          </div>

          <div style={{ height: '220px', width: '100%', marginTop: '0.75rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quarterlyData} margin={{ top: 15, right: 20, left: 5, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="quarter" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(val) => `Rs ${(val / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(val, name) => [`Rs ${Number(val).toLocaleString()}`, name]} />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. Monthly Performance Audit Ledger Table */}
      <div className="monthly-performance-ledger-card">
        <div className="ledger-header">
          <div>
            <h3>Month-wise Financial Audit Ledger ({selectedYear})</h3>
            <p className="ledger-subtext">Detailed monthly breakdown of gross receipts, operational payments, net margins, and variance</p>
          </div>
        </div>

        <div className="table-responsive-wrapper" style={{ overflowX: 'auto' }}>
          <table className="modern-pnl-table">
            <thead>
              <tr>
                <th style={{ width: '140px' }}>Month</th>
                <th style={{ textAlign: 'right' }}>Gross Income Inflow</th>
                <th style={{ textAlign: 'right' }}>Total Expense Outflow</th>
                <th style={{ textAlign: 'right' }}>Net Profit / (Deficit)</th>
                <th style={{ textAlign: 'center' }}>Profit Margin %</th>
                <th style={{ textAlign: 'center' }}>Expense Ratio %</th>
                <th style={{ textAlign: 'right' }}>Cumulative Surplus</th>
                <th style={{ textAlign: 'center' }}>Financial Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="table-loading-cell">
                    <RefreshCw size={24} className="spinning" />
                    <p style={{ marginTop: '0.5rem' }}>Analyzing month-by-month financial data...</p>
                  </td>
                </tr>
              ) : monthlyData.length === 0 ? (
                <tr>
                  <td colSpan="8" className="table-empty-cell">No financial data for {selectedYear}.</td>
                </tr>
              ) : (
                monthlyData.map((m, idx) => (
                  <tr key={idx} className="pnl-table-row">
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{m.month_name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{fmt(m.income)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{fmt(m.expense)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: m.net_profit >= 0 ? '#10b981' : '#ef4444' }}>
                      {fmt(m.net_profit)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`margin-badge ${m.margin_percentage >= 0 ? 'margin-pos' : 'margin-neg'}`}>
                        {m.margin_percentage}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                      {m.expense_ratio}%
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: m.cumulative_surplus >= 0 ? '#0f172a' : '#ef4444' }}>
                      {fmt(m.cumulative_surplus)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`status-pill status-${m.status.toLowerCase()}`}>
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {!loading && (
              <tfoot>
                <tr className="table-summary-totals-row">
                  <td style={{ fontWeight: 800, fontSize: '0.9rem' }}>ANNUAL TOTALS ({selectedYear})</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#10b981', fontSize: '0.95rem' }}>
                    {fmt(summary?.total_income || 0)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#ef4444', fontSize: '0.95rem' }}>
                    {fmt(summary?.total_expense || 0)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: (summary?.net_profit_loss || 0) >= 0 ? '#10b981' : '#ef4444', fontSize: '1rem' }}>
                    {fmt(summary?.net_profit_loss || 0)}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>
                    <span className="margin-badge margin-pos" style={{ fontSize: '0.85rem' }}>
                      {summary?.overall_profit_margin || 0}%
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 700 }}>-</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                    {fmt(summary?.net_profit_loss || 0)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`status-pill status-${summary?.is_profitable ? 'surplus' : 'deficit'}`} style={{ fontWeight: 800 }}>
                      {summary?.is_profitable ? 'NET SURPLUS' : 'NET DEFICIT'}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
