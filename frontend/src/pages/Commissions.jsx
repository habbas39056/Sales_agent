import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DollarSign, User } from 'lucide-react';
import './InvoiceManagement.css'; // Reuse styles

export default function Commissions() {
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommissions();
  }, []);

  const fetchCommissions = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/commissions');
      setCommissions(res.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch commissions:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="invoice-management-container"><div className="page-header"><h2>Loading...</h2></div></div>;
  }

  return (
    <div className="invoice-management-container modern-ui">
      <div className="recent-orders-panel" style={{ marginTop: '2rem' }}>
        <div className="panel-header-ref">
          <div>
            <h2 style={{ fontSize: '1.25rem', color: '#1e293b', margin: 0 }}>Commissions Dashboard</h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>Track agent performance and commission payouts</p>
          </div>
        </div>

        <div className="table-responsive-ref">
          <table className="ref-table">
            <thead>
              <tr>
                <th>AGENT NAME</th>
                <th>COMMISSION %</th>
                <th>TOTAL INVOICES</th>
                <th>TOTAL EARNED</th>
                <th>PAID OUT</th>
                <th>PENDING PAYOUT</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((agent) => (
                <tr key={agent.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <User size={16} style={{ color: 'var(--text-light)' }} />
                      <strong>{agent.name}</strong>
                    </div>
                  </td>
                  <td>{agent.commission_percentage || 0}%</td>
                  <td>{agent.total_invoices}</td>
                  <td style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>PKR {Number(agent.total_earned || 0).toFixed(2)}
                  </td>
                  <td style={{ color: '#16a34a', fontWeight: 'bold' }}>PKR {Number(agent.total_paid_out || 0).toFixed(2)}
                  </td>
                  <td style={{ color: '#dc2626', fontWeight: 'bold' }}>PKR {(Number(agent.total_earned || 0) - Number(agent.total_paid_out || 0)).toFixed(2)}
                  </td>
                </tr>
              ))}
              {commissions.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-state">No agents found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
