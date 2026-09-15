import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Users, UserCheck, TrendingUp, DollarSign, FileText, Download, 
  Search, RefreshCw, Calendar, CheckCircle2, Clock, X, Filter, 
  FileSpreadsheet, Award, Eye, PhoneCall, AlertCircle, ArrowUpRight, 
  BarChart2, PieChart as PieChartIcon, CheckSquare, Target
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Pagination from '../../components/Pagination';
import './SalespersonLeadReportView.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function SalespersonLeadReportView() {
  // Filter States
  const [quickPreset, setQuickPreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Data States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState({
    summary: {
      total_salespeople: 0,
      total_leads_added: 0,
      total_leads_won: 0,
      total_leads_lost: 0,
      total_leads_interested: 0,
      overall_conversion_rate: 0,
      total_followups: 0,
      total_quotations_count: 0,
      total_quotations_val: 0,
      total_invoices_count: 0,
      total_invoices_val: 0,
      total_paid_val: 0
    },
    salespeople: [],
    recent_leads: []
  });

  // Modal State
  const [selectedRep, setSelectedRep] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (quickPreset) params.append('quick_preset', quickPreset);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (selectedAgent && selectedAgent !== 'all') params.append('agent_id', selectedAgent);

      const res = await axios.get(`${API_URL}/reports/salesperson-leads?${params.toString()}`);
      setReportData(res.data);
    } catch (err) {
      console.error('Error fetching salesperson lead report:', err);
      setError(err.response?.data?.error || 'Failed to fetch sales performance report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [quickPreset, startDate, endDate, selectedAgent]);

  const handleQuickPresetChange = (preset) => {
    setQuickPreset(preset);
    setStartDate('');
    setEndDate('');
  };

  // Filtered salespeople
  const filteredSalespeople = useMemo(() => {
    const list = reportData.salespeople || [];
    if (!searchTerm.trim()) return list;
    const term = searchTerm.trim().toLowerCase();
    return list.filter(sp => 
      sp.name.toLowerCase().includes(term) || 
      sp.email.toLowerCase().includes(term) || 
      sp.role.toLowerCase().includes(term)
    );
  }, [reportData.salespeople, searchTerm]);

  // Paginated salespeople
  const paginatedSalespeople = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSalespeople.slice(start, start + itemsPerPage);
  }, [filteredSalespeople, currentPage, itemsPerPage]);

  // Leaderboard Rankings
  const topConverters = useMemo(() => {
    return [...(reportData.salespeople || [])].sort((a, b) => b.leads_won - a.leads_won).slice(0, 3);
  }, [reportData.salespeople]);

  const topRevenue = useMemo(() => {
    return [...(reportData.salespeople || [])].sort((a, b) => b.invoices_amount - a.invoices_amount).slice(0, 3);
  }, [reportData.salespeople]);

  // Export to Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows = (reportData.salespeople || []).map(sp => ({
      'Salesperson Name': sp.name,
      'Role': sp.role,
      'Leads Added': sp.leads_added,
      'Leads Won/Converted': sp.leads_won,
      'Leads Interested': sp.leads_interested,
      'Leads Lost': sp.leads_lost,
      'Win Rate (%)': `${sp.conversion_rate}%`,
      'Follow-ups Taken': sp.followups_count,
      'Quotations Count': sp.quotations_count,
      'Quotations Amount (PKR)': sp.quotations_amount,
      'Invoices Count': sp.invoices_count,
      'Invoices Amount (PKR)': sp.invoices_amount,
      'Revenue Collected (PKR)': sp.paid_amount
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Salesperson Performance');
    XLSX.writeFile(wb, `Salesperson_Leads_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export to PDF
  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('Salesperson Lead & Performance Report', 14, 18);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleDateString()} | Filter: ${quickPreset || 'Custom Range'}`, 14, 25);

    const summary = reportData.summary || {};
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Total Leads: ${summary.total_leads_added || 0} | Won: ${summary.total_leads_won || 0} (${summary.overall_conversion_rate || 0}%) | Follow-ups: ${summary.total_followups || 0} | Quotes: PKR ${Number(summary.total_quotations_val || 0).toLocaleString()} | Invoices: PKR ${Number(summary.total_invoices_val || 0).toLocaleString()}`, 14, 32);

    const tableColumns = ["Salesperson", "Role", "Leads Added", "Won", "Interested", "Win %", "Followups", "Quotations", "Invoiced (PKR)", "Collected (PKR)"];
    const tableRows = (reportData.salespeople || []).map(sp => [
      sp.name,
      sp.role,
      sp.leads_added,
      sp.leads_won,
      sp.leads_interested,
      `${sp.conversion_rate}%`,
      sp.followups_count,
      `${sp.quotations_count} (PKR ${sp.quotations_amount.toLocaleString()})`,
      `PKR ${sp.invoices_amount.toLocaleString()}`,
      `PKR ${sp.paid_amount.toLocaleString()}`
    ]);

    autoTable(doc, {
      head: [tableColumns],
      body: tableRows,
      startY: 38,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8.5, cellPadding: 4 }
    });

    doc.save(`Salesperson_Performance_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const openRepModal = (rep) => {
    setSelectedRep(rep);
    setIsModalOpen(true);
  };

  const summary = reportData.summary || {};

  return (
    <div className="sp-report-container fade-in">
      
      {/* 1. TOP HEADER & FILTERS BAR */}
      <div className="sp-header-card">
        <div className="sp-header-title">
          <div className="sp-icon-wrapper">
            <Target size={24} color="#6366f1" />
          </div>
          <div>
            <h2>Salesperson Lead & Conversion Analytics</h2>
            <p>Track leads created, follow-ups logged, quotations generated & revenue converted per employee</p>
          </div>
        </div>

        <div className="sp-header-actions">
          <button className="sp-btn-excel" onClick={handleExportExcel}>
            <FileSpreadsheet size={16} /> Export Excel
          </button>
          <button className="sp-btn-pdf" onClick={handleExportPDF}>
            <Download size={16} /> Export PDF
          </button>
          <button className={`sp-btn-refresh ${loading ? 'spinning' : ''}`} onClick={fetchReport} title="Refresh Report">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* 2. FILTER CONTROLS */}
      <div className="sp-filters-panel">
        <div className="sp-preset-group">
          <span className="sp-filter-label"><Calendar size={14} /> Preset:</span>
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'this_week', label: 'This Week' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
            { id: 'this_year', label: 'This Year' },
            { id: '', label: 'All Time' }
          ].map(p => (
            <button
              key={p.id}
              className={`sp-preset-btn ${quickPreset === p.id && !startDate ? 'active' : ''}`}
              onClick={() => handleQuickPresetChange(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="sp-date-pickers">
          <div className="sp-agent-field" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginRight: '0.5rem' }}>
            <span className="sp-filter-label" style={{ margin: 0 }}><Users size={14} /> Salesperson:</span>
            <select 
              value={selectedAgent} 
              onChange={(e) => { setSelectedAgent(e.target.value); setCurrentPage(1); }}
              style={{
                padding: '0.38rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.8rem',
                fontWeight: '700',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">👥 All Salespeople ({reportData.all_salespeople_list?.length || 0})</option>
              {(reportData.all_salespeople_list || []).map(sp => (
                <option key={sp.id} value={sp.id}>
                  👤 {sp.name} ({sp.role || 'Sales'})
                </option>
              ))}
            </select>
          </div>

          <div className="sp-date-field">
            <label>From:</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => { setStartDate(e.target.value); setQuickPreset(''); }} 
            />
          </div>
          <div className="sp-date-field">
            <label>To:</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => { setEndDate(e.target.value); setQuickPreset(''); }} 
            />
          </div>
          {(startDate || endDate || selectedAgent !== 'all') && (
            <button className="sp-clear-btn" onClick={() => { setStartDate(''); setEndDate(''); setSelectedAgent('all'); setQuickPreset('all'); }}>
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 3. EXECUTIVE KPI CARDS */}
      <div className="sp-kpi-grid">
        <div className="sp-kpi-card purple">
          <div className="sp-kpi-header">
            <span className="sp-kpi-title">Leads Added</span>
            <div className="sp-kpi-badge">Total Created</div>
          </div>
          <div className="sp-kpi-value">{summary.total_leads_added || 0}</div>
          <div className="sp-kpi-sub">Across {summary.total_salespeople || 0} active sales reps</div>
        </div>

        <div className="sp-kpi-card green">
          <div className="sp-kpi-header">
            <span className="sp-kpi-title">Leads Converted (Won)</span>
            <div className="sp-kpi-badge green-badge">{summary.overall_conversion_rate || 0}% Rate</div>
          </div>
          <div className="sp-kpi-value text-emerald">{summary.total_leads_won || 0}</div>
          <div className="sp-kpi-sub">{summary.total_leads_interested || 0} currently interested/active</div>
        </div>

        <div className="sp-kpi-card blue">
          <div className="sp-kpi-header">
            <span className="sp-kpi-title">Follow-ups Logged</span>
            <div className="sp-kpi-badge blue-badge">Activity Touches</div>
          </div>
          <div className="sp-kpi-value text-blue">{summary.total_followups || 0}</div>
          <div className="sp-kpi-sub">Calls & client interactions</div>
        </div>

        <div className="sp-kpi-card amber">
          <div className="sp-kpi-header">
            <span className="sp-kpi-title">Quotations Created</span>
            <div className="sp-kpi-badge amber-badge">{summary.total_quotations_count || 0} Quotes</div>
          </div>
          <div className="sp-kpi-value text-amber">PKR {Number(summary.total_quotations_val || 0).toLocaleString()}</div>
          <div className="sp-kpi-sub">Total quote pipeline value</div>
        </div>

        <div className="sp-kpi-card indigo">
          <div className="sp-kpi-header">
            <span className="sp-kpi-title">Invoices & Collected</span>
            <div className="sp-kpi-badge indigo-badge">{summary.total_invoices_count || 0} Invoices</div>
          </div>
          <div className="sp-kpi-value text-indigo">PKR {Number(summary.total_paid_val || 0).toLocaleString()}</div>
          <div className="sp-kpi-sub">Invoiced: PKR {Number(summary.total_invoices_val || 0).toLocaleString()}</div>
        </div>
      </div>

      {/* 4. LEADERBOARD CARDS */}
      <div className="sp-leaderboard-section">
        <h3 className="sp-section-heading">🏆 Top Performers Leaderboard</h3>
        <div className="sp-leaderboard-grid">
          
          {/* Top Converters */}
          <div className="sp-leaderboard-card">
            <h4>🎯 Top Lead Converters</h4>
            <div className="sp-leader-list">
              {topConverters.slice(0, 3).map((sp, idx) => (
                <div key={sp.id} className="sp-leader-row">
                  <div className={`sp-rank-badge rank-${idx + 1}`}>#{idx + 1}</div>
                  <div className="sp-leader-info">
                    <div className="sp-leader-name">{sp.name}</div>
                    <div className="sp-leader-role">{sp.role}</div>
                  </div>
                  <div className="sp-leader-metric">
                    <strong>{sp.leads_won} Won</strong>
                    <span>({sp.conversion_rate}% rate)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Revenue */}
          <div className="sp-leaderboard-card">
            <h4>💰 Top Revenue Generators</h4>
            <div className="sp-leader-list">
              {topRevenue.slice(0, 3).map((sp, idx) => (
                <div key={sp.id} className="sp-leader-row">
                  <div className={`sp-rank-badge rank-${idx + 1}`}>#{idx + 1}</div>
                  <div className="sp-leader-info">
                    <div className="sp-leader-name">{sp.name}</div>
                    <div className="sp-leader-role">{sp.role}</div>
                  </div>
                  <div className="sp-leader-metric">
                    <strong>PKR {Number(sp.invoices_amount).toLocaleString()}</strong>
                    <span>({sp.invoices_count} invoices)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* 5. VISUAL ANALYTICS CHARTS */}
      <div className="sp-charts-grid">
        <div className="sp-chart-card">
          <div className="sp-chart-header">
            <h4><BarChart2 size={18} /> Leads Added vs. Converted (Won) per Sales Representative</h4>
          </div>
          <div className="sp-chart-body" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportData.salespeople || []} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '8px', border: 'none' }} 
                />
                <Legend />
                <Bar dataKey="leads_added" name="Leads Added" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="leads_won" name="Won / Converted" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="sp-chart-card">
          <div className="sp-chart-header">
            <h4><PieChartIcon size={18} /> Invoiced Revenue (PKR) per Salesperson</h4>
          </div>
          <div className="sp-chart-body" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={(reportData.salespeople || []).filter(s => s.invoices_amount > 0)}
                  dataKey="invoices_amount"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={45}
                  paddingAngle={4}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {(reportData.salespeople || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => `PKR ${Number(value).toLocaleString()}`}
                  contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '8px' }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 6. DETAILED SALESPERSON BREAKDOWN TABLE */}
      <div className="sp-table-card">
        <div className="sp-table-header">
          <div className="sp-table-title">
            <h3>Sales Representatives Performance Table</h3>
            <span className="sp-badge-count">{filteredSalespeople.length} Employees</span>
          </div>

          <div className="sp-table-search">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Search employee by name..." 
              value={searchTerm} 
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="sp-modern-table">
            <thead>
              <tr>
                <th>Salesperson</th>
                <th>Role</th>
                <th style={{ textAlign: 'center' }}>Leads Added</th>
                <th style={{ textAlign: 'center' }}>Won (Converted)</th>
                <th style={{ textAlign: 'center' }}>Win Rate %</th>
                <th style={{ textAlign: 'center' }}>Interested</th>
                <th style={{ textAlign: 'center' }}>Follow-ups</th>
                <th style={{ textAlign: 'right' }}>Quotations (PKR)</th>
                <th style={{ textAlign: 'right' }}>Invoiced (PKR)</th>
                <th style={{ textAlign: 'right' }}>Collected (PKR)</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="sp-loading-spinner">Loading sales analytics...</div>
                  </td>
                </tr>
              ) : paginatedSalespeople.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                    No salesperson performance records found.
                  </td>
                </tr>
              ) : (
                paginatedSalespeople.map((sp) => (
                  <tr key={sp.id} className="sp-table-row">
                    <td>
                      <div className="sp-user-cell">
                        <div className="sp-avatar">
                          {sp.avatar ? (
                            <img src={sp.avatar} alt={sp.name} />
                          ) : (
                            sp.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="sp-user-name">{sp.name}</div>
                          <div className="sp-user-email">{sp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="sp-role-pill">{sp.role}</span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: '700', color: '#1e293b' }}>
                      {sp.leads_added}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="sp-won-pill">
                        {sp.leads_won} Won
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="sp-rate-wrapper">
                        <div className="sp-rate-bar-bg">
                          <div 
                            className="sp-rate-bar-fill" 
                            style={{ width: `${Math.min(100, sp.conversion_rate)}%` }} 
                          />
                        </div>
                        <span className="sp-rate-text">{sp.conversion_rate}%</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: '600', color: '#0284c7' }}>
                      {sp.leads_interested}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: '700', color: '#6366f1' }}>
                      {sp.followups_count}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '600', color: '#d97706' }}>
                      {sp.quotations_count > 0 ? (
                        <div>
                          <div>PKR {sp.quotations_amount.toLocaleString()}</div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>({sp.quotations_count} quotes)</div>
                        </div>
                      ) : '-'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                      {sp.invoices_count > 0 ? (
                        <div>
                          <div>PKR {sp.invoices_amount.toLocaleString()}</div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>({sp.invoices_count} invoices)</div>
                        </div>
                      ) : '-'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '800', color: '#10b981' }}>
                      PKR {sp.paid_amount.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        type="button" 
                        className="sp-btn-view"
                        onClick={() => openRepModal(sp)}
                        title="View 360 Salesperson Breakdown"
                      >
                        <Eye size={15} /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination 
          currentPage={currentPage}
          totalItems={filteredSalespeople.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* 7. INDIVIDUAL SALESPERSON 360 MODAL */}
      {isModalOpen && selectedRep && (
        <div className="sp-modal-overlay">
          <div className="sp-modal-card">
            <div className="sp-modal-header">
              <div className="sp-user-cell">
                <div className="sp-avatar large">
                  {selectedRep.avatar ? (
                    <img src={selectedRep.avatar} alt={selectedRep.name} />
                  ) : (
                    selectedRep.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: '#0f172a' }}>{selectedRep.name}</h3>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>{selectedRep.role} • {selectedRep.email}</p>
                </div>
              </div>
              <button type="button" className="sp-modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="sp-modal-body">
              {/* Metric Highlights */}
              <div className="sp-modal-stats">
                <div className="sp-mstat">
                  <span>Leads Added</span>
                  <strong>{selectedRep.leads_added}</strong>
                </div>
                <div className="sp-mstat green">
                  <span>Leads Won</span>
                  <strong>{selectedRep.leads_won}</strong>
                </div>
                <div className="sp-mstat blue">
                  <span>Conversion Rate</span>
                  <strong>{selectedRep.conversion_rate}%</strong>
                </div>
                <div className="sp-mstat amber">
                  <span>Follow-ups Logged</span>
                  <strong>{selectedRep.followups_count}</strong>
                </div>
                <div className="sp-mstat indigo">
                  <span>Total Invoiced</span>
                  <strong>PKR {selectedRep.invoices_amount.toLocaleString()}</strong>
                </div>
              </div>

              {/* Status Breakdown Chips */}
              <div style={{ margin: '1.5rem 0 1rem 0' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#334155', marginBottom: '0.5rem' }}>Lead Status Distribution</h4>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {Object.keys(selectedRep.status_breakdown || {}).length === 0 ? (
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No lead status data available</span>
                  ) : (
                    Object.entries(selectedRep.status_breakdown).map(([st, cnt]) => (
                      <span key={st} style={{ background: '#f1f5f9', color: '#334155', padding: '0.35rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600' }}>
                        {st}: <strong>{cnt}</strong>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Assigned Leads Table */}
              <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', marginTop: '1.5rem', marginBottom: '0.75rem' }}>Assigned Leads List</h4>
              <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table className="sp-modern-table" style={{ fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th>Lead Name / Title</th>
                      <th>Company / Contact</th>
                      <th>Status</th>
                      <th>Value</th>
                      <th>Date Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reportData.recent_leads || []).filter(l => Number(l.assigned_to) === Number(selectedRep.id) || Number(l.created_by) === Number(selectedRep.id)).length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>No leads assigned in this period.</td>
                      </tr>
                    ) : (
                      (reportData.recent_leads || [])
                        .filter(l => Number(l.assigned_to) === Number(selectedRep.id) || Number(l.created_by) === Number(selectedRep.id))
                        .map(lead => (
                          <tr key={lead.id}>
                            <td style={{ fontWeight: '700', color: '#1e293b' }}>
                              {lead.title || lead.lead_number}
                            </td>
                            <td>{lead.company_name || lead.contact_name || '-'}</td>
                            <td>
                              <span className={`sp-status-badge st-${(lead.status || '').toLowerCase().replace(/\s+/g, '-')}`}>
                                {lead.status || 'New Lead'}
                              </span>
                            </td>
                            <td style={{ fontWeight: '600' }}>PKR {Number(lead.estimated_value || 0).toLocaleString()}</td>
                            <td style={{ color: '#64748b' }}>{lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '-'}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
