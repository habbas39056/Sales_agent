import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Download, Users, Shield, Loader, FileText, CheckCircle, Clock, X, Filter, DollarSign, TrendingUp, CreditCard } from 'lucide-react';
import './Reports.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function Reports() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('sales'); // 'sales', 'clients' or 'team'
  const [dashboardStats, setDashboardStats] = useState({ total_invoiced: 0, total_paid: 0, total_balance: 0 });
  const [salesReports, setSalesReports] = useState([]);
  const [salesStartDate, setSalesStartDate] = useState('');
  const [salesEndDate, setSalesEndDate] = useState('');
  const [clientReports, setClientReports] = useState([]);
  const [teamReports, setTeamReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Detailed Modal State
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientDetails, setClientDetails] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Team Modal State
  const [selectedTeamMember, setSelectedTeamMember] = useState(null);
  const [teamDetails, setTeamDetails] = useState([]);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [teamDetailsLoading, setTeamDetailsLoading] = useState(false);

  const setQuickFilter = (days) => {
    const end = new Date();
    const start = new Date();
    if (days === 'all') {
      setSalesStartDate('');
      setSalesEndDate('');
      return;
    }
    start.setDate(end.getDate() - days);
    setSalesStartDate(start.toISOString().split('T')[0]);
    setSalesEndDate(end.toISOString().split('T')[0]);
  };

  const getChartData = () => {
    if (salesReports.length === 0) return [];
    
    // Filter by date
    const filtered = salesReports.filter(inv => {
      if (!inv.issue_date) return false;
      const d = new Date(inv.issue_date);
      if (isNaN(d.getTime())) return false;
      
      if (salesStartDate && new Date(salesStartDate) > d) return false;
      if (salesEndDate && new Date(salesEndDate) < d) return false;
      return true;
    });

    // Aggregate by Month-Year (e.g., 'Jan 2026')
    const aggregated = {};
    filtered.forEach(inv => {
      if (!inv.issue_date) return;
      
      const d = new Date(inv.issue_date);
      if (isNaN(d.getTime())) return; // Skip invalid dates
      
      const key = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
      
      if (!aggregated[key]) {
        aggregated[key] = {
          name: key,
          timestamp: d.getTime(), // for sorting
          Invoiced: 0,
          Paid: 0,
          Balance: 0
        };
      }
      
      const amount = parseFloat(inv.amount || 0);
      const balance = parseFloat(inv.balance || 0);
      const paid = amount - balance;
      
      aggregated[key].Invoiced += amount;
      aggregated[key].Paid += paid;
      aggregated[key].Balance += balance;
    });
    
    return Object.values(aggregated).sort((a, b) => a.timestamp - b.timestamp);
  };

  const chartData = getChartData();

  // Calculate totals for the current filter
  const getFilteredTotals = () => {
    let invoiced = 0, paid = 0, balance = 0;
    const filtered = salesReports.filter(inv => {
      if (!inv.issue_date) return false;
      const d = new Date(inv.issue_date);
      if (isNaN(d.getTime())) return false;
      
      if (salesStartDate && new Date(salesStartDate) > d) return false;
      if (salesEndDate && new Date(salesEndDate) < d) return false;
      return true;
    });

    filtered.forEach(inv => {
      const amt = parseFloat(inv.amount || 0);
      const bal = parseFloat(inv.balance || 0);
      invoiced += amt;
      balance += bal;
      paid += (amt - bal);
    });

    return { invoiced, paid, balance };
  };

  const filteredTotals = getFilteredTotals();

  useEffect(() => {
    fetchReports();
  }, [activeTab]);

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      // Always fetch dashboard stats on tab change (or could do it once)
      const dashRes = await axios.get(`${API_URL}/reports/dashboard`);
      setDashboardStats(dashRes.data);

      if (activeTab === 'clients') {
        const res = await axios.get(`${API_URL}/reports/clients`);
        setClientReports(res.data);
      } else if (activeTab === 'team') {
        const res = await axios.get(`${API_URL}/reports/team`);
        setTeamReports(res.data);
      } else {
        const res = await axios.get(`${API_URL}/reports/sales`);
        setSalesReports(res.data);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
      setError('Failed to load reports data.');
    } finally {
      setLoading(false);
    }
  };

  const openClientDetails = async (client) => {
    setSelectedClient(client);
    setStatusFilter('All');
    setIsModalOpen(true);
    setDetailsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/reports/clients/${client.client_id}/details`);
      setClientDetails(res.data);
    } catch (err) {
      console.error('Error fetching client details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const openTeamDetails = async (member) => {
    setSelectedTeamMember(member);
    setIsTeamModalOpen(true);
    setTeamDetailsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/reports/team/${member.user_id}/details`);
      setTeamDetails(res.data);
    } catch (err) {
      console.error('Error fetching team details:', err);
    } finally {
      setTeamDetailsLoading(false);
    }
  };

  const filteredDetails = clientDetails.filter(d => {
    if (statusFilter === 'All') return true;
    if (statusFilter === 'Due Passed') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return new Date(d.due_date) < today && d.invoice_status !== 'Paid';
    }
    return d.invoice_status === statusFilter;
  });

  const downloadClientPDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('Client Reports (360 View)', 14, 22);
    
    // Subtitle
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableColumn = ["Client", "Invoices", "Invoiced (PKR)", "Paid (PKR)", "Balance (PKR)", "Next Due"];
    const tableRows = [];

    clientReports.forEach(client => {
      const rowData = [
        client.full_name || client.business_name || 'N/A',
        client.total_invoices.toString(),
        `PKR ${parseFloat(client.total_invoiced_amount).toFixed(2)}`,
        `PKR ${parseFloat(client.total_paid).toFixed(2)}`,
        `PKR ${parseFloat(client.total_balance).toFixed(2)}`,
        client.next_due_date ? new Date(client.next_due_date).toLocaleDateString() : 'N/A'
      ];
      tableRows.push(rowData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] }, // Blue primary color
      styles: { fontSize: 10, cellPadding: 3 },
    });

    doc.save('Client_Reports.pdf');
  };

  const downloadTeamPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('Team Member Reports', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableColumn = ["Name", "Role", "Projects", "Completed", "Active", "Total Comm.", "Pending Comm."];
    const tableRows = [];

    teamReports.forEach(member => {
      const rowData = [
        member.name,
        member.role,
        member.total_projects.toString(),
        member.completed_projects.toString(),
        member.active_projects.toString(),
        `PKR ${parseFloat(member.total_commissions).toFixed(2)}`,
        `PKR ${parseFloat(member.pending_commissions).toFixed(2)}`
      ];
      tableRows.push(rowData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }, // Emerald color for team
      styles: { fontSize: 10, cellPadding: 3 },
    });

    doc.save('Team_Reports.pdf');
  };

  return (
    <div className="reports-container">
      <div className="reports-header">
        <div>
          <h1>System Reports</h1>
          <p>360-degree view of clients and team performance</p>
        </div>
      </div>

      <div className="reports-dashboard-cards">
        <div className="dashboard-stat-card">
          <div className="stat-icon-wrapper blue">
            <FileText size={24} />
          </div>
          <div className="stat-content">
            <p className="stat-label">Total Invoiced</p>
            <h3 className="stat-value">PKR {parseFloat(dashboardStats.total_invoiced || 0).toFixed(2)}</h3>
          </div>
        </div>
        
        <div className="dashboard-stat-card">
          <div className="stat-icon-wrapper green">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <p className="stat-label">Total Paid</p>
            <h3 className="stat-value text-success">PKR {parseFloat(dashboardStats.total_paid || 0).toFixed(2)}</h3>
          </div>
        </div>

        <div className="dashboard-stat-card">
          <div className="stat-icon-wrapper orange">
            <CreditCard size={24} />
          </div>
          <div className="stat-content">
            <p className="stat-label">Balance Outstanding</p>
            <h3 className="stat-value text-danger">PKR {parseFloat(dashboardStats.total_balance || 0).toFixed(2)}</h3>
          </div>
        </div>
      </div>

      <div className="reports-tabs">
        <button 
          className={`tab-btn ${activeTab === 'sales' ? 'active' : ''}`}
          onClick={() => setActiveTab('sales')}
        >
          <DollarSign size={18} /> Sales Overview
        </button>
        <button 
          className={`tab-btn ${activeTab === 'clients' ? 'active' : ''}`}
          onClick={() => setActiveTab('clients')}
        >
          <Users size={18} /> Client Reports
        </button>
        <button 
          className={`tab-btn ${activeTab === 'team' ? 'active' : ''}`}
          onClick={() => setActiveTab('team')}
        >
          <Shield size={18} /> Team Reports
        </button>
      </div>

      <div className="reports-content">
        {error && <div className="error-message">{error}</div>}
        
        {loading ? (
          <div className="loading-state">
            <Loader className="spinner" size={40} />
            <p>Loading reports data...</p>
          </div>
        ) : activeTab === 'sales' ? (
          <div className="report-panel fade-in">
            <div className="panel-header" style={{flexDirection: 'column', alignItems: 'flex-start', gap: '1rem'}}>
              <h2>Sales & Revenue Trends</h2>
              <div className="sales-filters">
                <div className="date-inputs">
                  <div className="filter-group">
                    <label>Start Date:</label>
                    <input type="date" value={salesStartDate} onChange={(e) => setSalesStartDate(e.target.value)} />
                  </div>
                  <div className="filter-group">
                    <label>End Date:</label>
                    <input type="date" value={salesEndDate} onChange={(e) => setSalesEndDate(e.target.value)} />
                  </div>
                </div>
                <div className="quick-filters">
                  <button className="btn-secondary" onClick={() => setQuickFilter(30)}>Last 30 Days</button>
                  <button className="btn-secondary" onClick={() => setQuickFilter(365)}>This Year</button>
                  <button className="btn-secondary" onClick={() => setQuickFilter('all')}>All Time</button>
                </div>
              </div>
            </div>
            
            <div className="chart-container" style={{ width: '100%', height: '400px', marginTop: '2rem', position: 'relative' }}>
              <div className="chart-overlay-summary">
                <div className="summary-row">
                  <span className="summary-label">Invoiced:</span>
                  <span className="summary-val text-blue">PKR {filteredTotals.invoiced.toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Paid:</span>
                  <span className="summary-val text-success">PKR {filteredTotals.paid.toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Balance:</span>
                  <span className="summary-val text-danger">PKR {filteredTotals.balance.toFixed(2)}</span>
                </div>
              </div>

              {chartData.length === 0 ? (
                <div className="empty-state">No sales data found for this period.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorInvoiced" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(val) => `PKR ${val}`} />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <Tooltip formatter={(value) => `PKR ${parseFloat(value).toFixed(2)}`} />
                    <Legend />
                    <Area type="monotone" dataKey="Invoiced" stroke="#3b82f6" fillOpacity={1} fill="url(#colorInvoiced)" />
                    <Area type="monotone" dataKey="Paid" stroke="#10b981" fillOpacity={1} fill="url(#colorPaid)" />
                    <Area type="monotone" dataKey="Balance" stroke="#f59e0b" fillOpacity={1} fill="url(#colorBalance)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        ) : activeTab === 'clients' ? (
          <div className="report-panel fade-in">
            <div className="panel-header">
              <h2>Client Performance (360 View)</h2>
              <button className="download-btn btn-primary" onClick={downloadClientPDF}>
                <Download size={18} /> Export PDF
              </button>
            </div>
            
            <div className="table-responsive">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Client Name</th>
                    <th>Invoices</th>
                    <th>Total Invoiced</th>
                    <th>Total Paid</th>
                    <th>Balance Due</th>
                    <th>Next Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {clientReports.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="empty-state">No client data found.</td>
                    </tr>
                  ) : (
                    clientReports.map(client => (
                      <tr key={client.client_id} onClick={() => openClientDetails(client)} className="clickable-row">
                        <td className="fw-600">{client.full_name || client.business_name}</td>
                        <td>{client.total_invoices}</td>
                        <td className="text-blue">PKR {parseFloat(client.total_invoiced_amount).toFixed(2)}</td>
                        <td className="text-success">PKR {parseFloat(client.total_paid).toFixed(2)}</td>
                        <td className={parseFloat(client.total_balance) > 0 ? 'text-danger fw-600' : 'text-success'}>PKR {parseFloat(client.total_balance).toFixed(2)}
                        </td>
                        <td>
                          {client.next_due_date ? new Date(client.next_due_date).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="report-panel fade-in">
            <div className="panel-header">
              <h2>Team Performance & Commissions</h2>
              <button className="download-btn btn-emerald" onClick={downloadTeamPDF}>
                <Download size={18} /> Export PDF
              </button>
            </div>
            
            <div className="table-responsive">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Assigned Projects</th>
                    <th>Completed</th>
                    <th>Active</th>
                    <th>Total Comm.</th>
                    <th>Pending Comm.</th>
                  </tr>
                </thead>
                <tbody>
                  {teamReports.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty-state">No team data found.</td>
                    </tr>
                  ) : (
                    teamReports.map(member => (
                      <tr key={member.user_id} onClick={() => openTeamDetails(member)} className="clickable-row">
                        <td className="fw-600">
                          <div className="user-name-cell">
                            <div className="avatar-placeholder">{member.name.charAt(0)}</div>
                            {member.name}
                          </div>
                        </td>
                        <td><span className={`role-badge role-${member.role.replace(/\s+/g, '-').toLowerCase()}`}>{member.role}</span></td>
                        <td>{member.total_projects}</td>
                        <td className="text-success fw-600">{member.completed_projects}</td>
                        <td className="text-warning fw-600">{member.active_projects}</td>
                        <td className="text-blue">PKR {parseFloat(member.total_commissions).toFixed(2)}</td>
                        <td className={parseFloat(member.pending_commissions) > 0 ? 'text-warning fw-600' : ''}>PKR {parseFloat(member.pending_commissions).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && selectedClient && (
        <div className="reports-modal-overlay">
          <div className="reports-modal-content">
            <div className="modal-header">
              <h2>{selectedClient.full_name || selectedClient.business_name} - Detailed Report</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="modal-filters">
              <div className="filter-group">
                <Filter size={18} />
                <label>Filter by Invoice Status:</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="All">All Invoices</option>
                  <option value="Paid">Paid</option>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Due Passed">Due Passed</option>
                </select>
              </div>
            </div>

            {detailsLoading ? (
              <div className="loading-state">
                <Loader className="spinner" size={30} />
                <p>Loading details...</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Amount</th>
                      <th>Paid</th>
                      <th>Balance</th>
                      <th>Status</th>
                      <th>Due Date</th>
                      <th>Project Attached</th>
                      <th>Project Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDetails.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="empty-state">No invoices found for this status.</td>
                      </tr>
                    ) : (
                      filteredDetails.map(item => {
                        const progress = item.total_steps > 0 
                          ? Math.round((item.completed_steps / item.total_steps) * 100) 
                          : 0;
                        const amount = parseFloat(item.amount);
                        const balance = parseFloat(item.balance);
                        const paid = amount - balance;
                        
                        return (
                          <tr key={item.invoice_id} onClick={() => navigate(`/invoices/edit/${item.invoice_id}`)} className="clickable-row">
                            <td className="fw-600">{item.invoice_number}</td>
                            <td>PKR {amount.toFixed(2)}</td>
                            <td className="text-success">PKR {paid.toFixed(2)}</td>
                            <td className={balance > 0 ? "text-danger fw-600" : "text-success"}>PKR {balance.toFixed(2)}</td>
                            <td>
                              <span className={`status-badge status-${item.invoice_status.toLowerCase()}`}>
                                {item.invoice_status}
                              </span>
                            </td>
                            <td>{new Date(item.due_date).toLocaleDateString()}</td>
                            <td>{item.project_title || <span className="text-light">No Project</span>}</td>
                            <td>
                              {item.project_id ? (
                                <div className="progress-cell">
                                  <div className="progress-bar-bg">
                                    <div className="progress-bar-fill" style={{ width: `${progress}%`, backgroundColor: progress === 100 ? '#10b981' : '#3b82f6' }}></div>
                                  </div>
                                  <span className="progress-text">{progress}%</span>
                                </div>
                              ) : '-'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {isTeamModalOpen && selectedTeamMember && (
        <div className="reports-modal-overlay">
          <div className="reports-modal-content">
            <div className="modal-header">
              <h2>{selectedTeamMember.name} - Detailed Report</h2>
              <button className="btn-close" onClick={() => setIsTeamModalOpen(false)}>
                <X size={24} />
              </button>
            </div>

            {teamDetailsLoading ? (
              <div className="loading-state">
                <Loader className="spinner" size={30} />
                <p>Loading team details...</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Client</th>
                      <th>Project Status</th>
                      <th>Inv #</th>
                      <th>Inv Amount</th>
                      <th>Commission (PKR)</th>
                      <th>Comm Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamDetails.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="empty-state">No detailed records found.</td>
                      </tr>
                    ) : (
                      teamDetails.map((item, index) => {
                        const invAmount = parseFloat(item.invoice_amount || 0);
                        const commAmount = parseFloat(item.commission_amount || 0);
                        return (
                          <tr key={index} className="clickable-row" onClick={() => { if(item.project_id) navigate(`/projects/${item.project_id}`)}}>
                            <td className="fw-600">{item.project_title || '-'}</td>
                            <td>{item.client_name || item.business_name || '-'}</td>
                            <td>
                              {item.project_status ? (
                                <span className={`status-badge status-${item.project_status.replace(/\s+/g, '-').toLowerCase()}`}>
                                  {item.project_status}
                                </span>
                              ) : '-'}
                            </td>
                            <td>{item.invoice_number || '-'}</td>
                            <td className="text-blue">{invAmount > 0 ? `PKR ${invAmount.toFixed(2)}` : '-'}</td>
                            <td className="text-success fw-600">{commAmount > 0 ? `PKR ${commAmount.toFixed(2)}` : '-'}</td>
                            <td>
                              {item.commission_status ? (
                                <span className={`status-badge status-${item.commission_status.toLowerCase()}`}>
                                  {item.commission_status}
                                </span>
                              ) : '-'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
