import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, ShieldCheck, Clock } from 'lucide-react';

export default function CommissionTimelineModal({ isOpen, invoiceIdOrNumber, onClose }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && invoiceIdOrNumber) {
      fetchTimeline();
    }
  }, [isOpen, invoiceIdOrNumber]);

  const fetchTimeline = async () => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await axios.get(`/api/commissions/invoice-timeline/${invoiceIdOrNumber}`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load invoice timeline:', err);
      setError(err.response?.data?.error || 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999,
        padding: '1rem'
      }}
    >
      <div 
        onClick={e => e.stopPropagation()}
        style={{
          background: '#ffffff', borderRadius: '16px', maxWidth: '680px', width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden',
          border: '1px solid #e2e8f0', animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <Clock size={28} style={{ animation: 'spin 2s linear infinite', marginBottom: '0.75rem', color: '#3b82f6' }} />
            <div>Loading payment & commission timeline...</div>
          </div>
        ) : error ? (
          <div style={{ padding: '2.5rem', textAlign: 'center' }}>
            <div style={{ color: '#dc2626', fontWeight: 600, marginBottom: '1rem' }}>⚠ {error}</div>
            <button 
              onClick={onClose}
              style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem 1.25rem', cursor: 'pointer', fontWeight: 600 }}
            >
              Close
            </button>
          </div>
        ) : data ? (
          <div style={{ padding: '1.75rem' }}>
            {/* 1. Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                    Payment & Commission Release Timeline
                  </h3>
                  <span style={{ 
                    background: '#eff6ff', color: '#3b82f6', border: '1px solid #dbeafe', 
                    borderRadius: '6px', padding: '0.2rem 0.6rem', fontSize: '0.78rem', fontWeight: 700 
                  }}>
                    {data.invoice_number}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.35rem' }}>
                  Sales Rep: <strong style={{ color: '#1e293b' }}>{data.agent_name}</strong> • Client: <strong style={{ color: '#1e293b' }}>{data.client_name}</strong>
                </div>
              </div>
              <button 
                onClick={onClose}
                style={{ 
                  background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' 
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* 2. 4 Metric KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem 0.85rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>TOTAL INVOICED</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>
                  PKR {Number(data.total_invoiced || 0).toLocaleString()}
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem 0.85rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>TOTAL COLLECTED</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#2563eb', marginTop: '0.25rem' }}>
                  PKR {Number(data.total_collected || 0).toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>({data.paid_percentage}%)</span>
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem 0.85rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>EARNED RELEASED</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#16a34a', marginTop: '0.25rem' }}>
                  PKR {Number(data.total_commission_released || 0).toFixed(2)}
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem 0.85rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>PENDING BALANCE</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: data.pending_balance > 0 ? '#dc2626' : '#94a3b8', marginTop: '0.25rem' }}>
                  PKR {Number(data.pending_balance || 0).toFixed(2)}
                </div>
              </div>
            </div>

            {/* 3. Split Release Rule Banner */}
            <div style={{ 
              background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', 
              padding: '0.85rem 1rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1.25rem' 
            }}>
              <ShieldCheck size={20} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.82rem', color: '#1e3a8a', lineHeight: 1.45 }}>
                <strong>Split Release Rule:</strong> Each payment received releases commission in the corresponding month's salary. Partial payments received across multiple months are disbursed separately as cash is collected.
              </div>
            </div>

            {/* 4. Installment Table */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center', width: '35px' }}>#</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left' }}>PAYMENT DATE</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left' }}>MODE & NOTES</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>AMOUNT RECEIVED</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: '#166534' }}>COMMISSION RELEASED</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>PAYROLL MONTH</th>
                  </tr>
                </thead>
                <tbody>
                  {data.installments && data.installments.length > 0 ? (
                    data.installments.map((inst, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{inst.index}</td>
                        <td style={{ padding: '0.75rem 0.85rem', color: '#1e293b' }}>{inst.formatted_date}</td>
                        <td style={{ padding: '0.75rem 0.85rem', color: '#475569' }}>{inst.mode_and_notes}</td>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          PKR {Number(inst.amount).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                          PKR {Number(inst.commission_released).toFixed(2)}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>
                          <span style={{ 
                            background: '#e0e7ff', color: '#4338ca', padding: '0.25rem 0.65rem', 
                            borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 
                          }}>
                            {inst.payroll_month}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                        No payments recorded yet for this invoice.
                      </td>
                    </tr>
                  )}
                </tbody>
                {data.installments && data.installments.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0', fontWeight: 800 }}>
                      <td colSpan="3" style={{ padding: '0.75rem 0.85rem', color: '#334155', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                        TOTAL RELEASED TO DATE:
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', color: '#0f172a' }}>
                        PKR {Number(data.total_collected).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', color: '#16a34a' }}>
                        PKR {Number(data.total_commission_released).toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* 5. Footer Action Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={onClose}
                style={{ 
                  background: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px', 
                  padding: '0.65rem 1.4rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              >
                Close Timeline
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
