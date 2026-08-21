import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { Loader, Download, TrendingUp, AlertCircle, Package } from 'lucide-react';
import * as XLSX from 'xlsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ffc658'];

export default function NewReports({ activeTab }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      let endpoint = '';
      switch(activeTab) {
        case 'expenses': endpoint = '/reports/expenses'; break;
        case 'products': endpoint = '/reports/products'; break;
        case 'projects-health': endpoint = '/reports/projects-health'; break;
        case 'accounting': endpoint = '/reports/accounting'; break;
        case 'invoices-aging': endpoint = '/reports/invoices-aging'; break;
        case 'cash-flow': endpoint = '/reports/cash-flow'; break;
        case 'revenue-concentration': endpoint = '/reports/revenue-concentration'; break;
        default: return;
      }
      
      const res = await axios.get(`${API_URL}${endpoint}`);
      setData(res.data);
    } catch (err) {
      console.error('Error fetching new report:', err);
      setError('Failed to load report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const exportExcel = (filename, sheetName, exportData) => {
    const safeData = Array.isArray(exportData) ? exportData : [exportData];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(safeData);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (loading) return <div className="loading-state"><Loader className="spinner" /> Loading report...</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!data) return null;

  const items = Array.isArray(data) ? data : [];

  switch(activeTab) {
    case 'expenses':
      return (
        <div className="report-panel">
          <div className="panel-header">
            <h2>Expense Reports</h2>
            <button className="btn-secondary" onClick={() => exportExcel('Expense_Report', 'Expenses', data)}>
              <Download size={16} /> Export CSV
            </button>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Amount (PKR)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td>{new Date(item.date).toLocaleDateString()}</td>
                    <td><span className="status-badge status-active">{item.category_name || 'Uncategorized'}</span></td>
                    <td>{item.description}</td>
                    <td className="text-danger font-medium">{Number(item.payment_amount).toLocaleString()}</td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan="4" className="text-center">No expenses found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      );
      
    case 'products':
      return (
        <div className="report-panel">
          <div className="panel-header">
            <h2>Service / Product Reports</h2>
            <button className="btn-secondary" onClick={() => exportExcel('Service_Report', 'Services', data)}>
              <Download size={16} /> Export CSV
            </button>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Service/Product Name</th>
                  <th>Times Sold</th>
                  <th>Total Quantity</th>
                  <th>Total Revenue (PKR)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="font-medium">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Package size={16} className="text-primary" /> {item.product_name}
                      </div>
                    </td>
                    <td>{item.times_sold}</td>
                    <td>{item.total_quantity}</td>
                    <td className="text-success font-bold">{Number(item.total_revenue).toLocaleString()}</td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan="4" className="text-center">No products found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      );

    case 'projects-health': {
      const pieData = items.map(d => ({ name: d.status || 'Unknown', value: Number(d.count || 0) }));
      return (
        <div className="report-panel">
          <div className="panel-header">
            <h2>Project Management Reports</h2>
            <button className="btn-secondary" onClick={() => exportExcel('Projects_Health', 'Health', items)}>
              <Download size={16} /> Export CSV
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1rem' }}>
            <div className="chart-container" style={{ height: '350px' }}>
              <h3 className="chart-title" style={{textAlign: 'center', marginBottom: '1rem'}}>Project Status Distribution</h3>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Count</th>
                    <th>Avg Completion %</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td><span className={`status-badge status-${(item.status || 'unknown').toLowerCase().replace(/\s+/g, '-')}`}>{item.status || 'Unknown'}</span></td>
                      <td>{item.count}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${item.avg_completion_pct || 0}%`, height: '100%', background: 'var(--primary-color)' }}></div>
                          </div>
                          <span>{Number(item.avg_completion_pct || 0).toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    case 'accounting':
      return (
        <div className="report-panel">
          <div className="panel-header">
            <h2>Finance & Accounting Overview</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="dashboard-stat-card">
              <div className="stat-content">
                <p className="stat-label">Total Billed Revenue</p>
                <h3 className="stat-value text-primary">PKR {Number(data.revenue).toLocaleString()}</h3>
              </div>
            </div>
            <div className="dashboard-stat-card">
              <div className="stat-content">
                <p className="stat-label">Total Received</p>
                <h3 className="stat-value text-success">PKR {Number(data.paid_revenue).toLocaleString()}</h3>
              </div>
            </div>
            <div className="dashboard-stat-card">
              <div className="stat-content">
                <p className="stat-label">Accounts Receivable (Pending)</p>
                <h3 className="stat-value text-warning">PKR {Number(data.receivables).toLocaleString()}</h3>
              </div>
            </div>
            <div className="dashboard-stat-card">
              <div className="stat-content">
                <p className="stat-label">Total Expenses</p>
                <h3 className="stat-value text-danger">PKR {Number(data.expenses).toLocaleString()}</h3>
              </div>
            </div>
          </div>
          <div className="dashboard-stat-card" style={{ background: data.net_position >= 0 ? '#ecfdf5' : '#fef2f2', border: `1px solid ${data.net_position >= 0 ? '#10b981' : '#ef4444'}` }}>
            <div className="stat-icon-wrapper" style={{ background: data.net_position >= 0 ? '#10b981' : '#ef4444' }}>
              {data.net_position >= 0 ? <TrendingUp size={24} /> : <AlertCircle size={24} />}
            </div>
            <div className="stat-content">
              <p className="stat-label">Net Cash Position</p>
              <h3 className="stat-value" style={{ color: data.net_position >= 0 ? '#047857' : '#b91c1c' }}>
                PKR {Number(data.net_position).toLocaleString()}
              </h3>
            </div>
          </div>
        </div>
      );

    case 'invoices-aging': {
      const agingData = [
        { name: 'Current', amount: Number(data?.current || 0) },
        { name: '1-30 Days', amount: Number(data?.overdue_1_30 || 0) },
        { name: '31-60 Days', amount: Number(data?.overdue_31_60 || 0) },
        { name: '61-90 Days', amount: Number(data?.overdue_61_90 || 0) },
        { name: '90+ Days', amount: Number(data?.overdue_90_plus || 0) }
      ];
      return (
        <div className="report-panel">
          <div className="panel-header">
            <h2>Invoicing Aging Report</h2>
            <button className="btn-secondary" onClick={() => exportExcel('Invoice_Aging', 'Aging', agingData)}>
              <Download size={16} /> Export CSV
            </button>
          </div>
          <div className="chart-container" style={{ height: '400px', marginTop: '2rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(val) => `Rs ${val / 1000}k`} />
                <Tooltip formatter={(value) => `PKR ${value.toLocaleString()}`} />
                <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                  {agingData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : index === 4 ? '#ef4444' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    case 'cash-flow':
      return (
        <div className="report-panel">
          <div className="panel-header">
            <h2>Cash Flow & Business Health</h2>
            <button className="btn-secondary" onClick={() => exportExcel('Cash_Flow', 'CashFlow', items)}>
              <Download size={16} /> Export CSV
            </button>
          </div>
          <div className="chart-container" style={{ height: '450px', marginTop: '2rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={items} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tickMargin={10} />
                <YAxis tickFormatter={(val) => `Rs ${val / 1000}k`} />
                <Tooltip formatter={(value) => `PKR ${Number(value).toLocaleString()}`} />
                <Legend />
                <Area type="monotone" dataKey="inflow" stroke="#10b981" fillOpacity={1} fill="url(#colorIn)" name="Cash Inflow (Income)" />
                <Area type="monotone" dataKey="outflow" stroke="#ef4444" fillOpacity={1} fill="url(#colorOut)" name="Cash Outflow (Expenses)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      );

    case 'revenue-concentration':
      return (
        <div className="report-panel">
          <div className="panel-header">
            <h2>Revenue Concentration (Top 10 Clients)</h2>
            <button className="btn-secondary" onClick={() => exportExcel('Revenue_Concentration', 'Revenue', data)}>
              <Download size={16} /> Export CSV
            </button>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Client Name</th>
                  <th>Business Name</th>
                  <th>Total Invoices</th>
                  <th>Total Revenue (PKR)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <span style={{ 
                        background: idx < 3 ? '#fef3c7' : '#f1f5f9', 
                        color: idx < 3 ? '#d97706' : '#64748b',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontWeight: 'bold'
                      }}>#{idx + 1}</span>
                    </td>
                    <td className="font-medium">{item.client_name}</td>
                    <td>{item.business_name || '-'}</td>
                    <td>{item.total_invoices}</td>
                    <td className="text-primary font-bold">{Number(item.total_revenue).toLocaleString()}</td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan="5" className="text-center">No data found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      );

    default:
      return null;
  }
}
