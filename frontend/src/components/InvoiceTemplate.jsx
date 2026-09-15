import React from 'react';
import './InvoiceTemplate.css';

export default function InvoiceTemplate({ invoice = {}, companyDetails = {} }) {
  if (!invoice) return null;

  // Format currency helper matching exact screenshot style (Rs. 8,600.00)
  const formatMoney = (val) => {
    const num = parseFloat(val) || 0;
    return `Rs. ${num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format date helper (e.g. 14-Sep-2026)
  const formatDate = (dateVal) => {
    if (!dateVal) return '-';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      const day = String(d.getDate()).padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (e) {
      return String(dateVal);
    }
  };

  // Extract Invoice Info
  const invoiceNumber = invoice.invoice_number || 'INV-0004';
  
  // Status calculation
  const rawStatus = (invoice.status || 'UNPAID').toUpperCase();
  const isPaid = rawStatus === 'PAID';
  const isOverdue = rawStatus === 'OVERDUE';
  const isPartial = rawStatus === 'PARTIAL';
  
  const statusClass = isPaid ? 'paid' : (isPartial ? 'partial' : 'unpaid');
  const statusText = rawStatus;

  // Client Info
  const clientName = invoice.client_name || invoice.clientName || 'Walk-In Customer';
  const businessName = invoice.business_name || invoice.businessName || '';
  const address = invoice.physical_address || invoice.address || invoice.client_address || '';
  const email = invoice.client_email || invoice.email || '';
  const phone = invoice.client_phone || invoice.phone || invoice.whatsapp_number || '';

  // Company / Seller Details (Default to screenshot specs or system info)
  const companyLogo = companyDetails.logo || '/logo.webp';
  const companyName = companyDetails.name || invoice.company_name || 'Adwise Labs';
  const companyAddress = companyDetails.address || 'A-205/II Saba Ave, DHA Karachi Phase VIII Zone A';
  const companyCountry = companyDetails.country || 'Pakistan';
  const companyPhone = companyDetails.phone || '+92 329 2371279';
  const companyEmail = companyDetails.email || 'info@adwiselabs.com';

  // Bank Details
  const bankTitle = companyDetails.bankTitle || invoice.bank_title || companyName;
  const bankName = companyDetails.bankName || invoice.bank_name || 'Bank Al Falah';
  const bankAccount = companyDetails.bankAccount || invoice.bank_account || '56395002519988';
  const bankIban = companyDetails.bankIban || invoice.bank_iban || '';

  // Items
  const items = invoice.items || [];
  const payments = invoice.payments || [];

  // Financial Calculations
  const subtotal = invoice.subtotal !== undefined && invoice.subtotal !== null
    ? parseFloat(invoice.subtotal)
    : items.reduce((sum, item) => sum + (parseFloat(item.total || (parseFloat(item.quantity || 1) * parseFloat(item.unit_price || 0))) || 0), 0);

  const totalAmount = invoice.amount !== undefined && invoice.amount !== null
    ? parseFloat(invoice.amount)
    : (invoice.total !== undefined ? parseFloat(invoice.total) : subtotal);

  let totalPaid = 0;
  if (payments && Array.isArray(payments) && payments.length > 0) {
    totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  } else if (invoice.totalPaid !== undefined && invoice.totalPaid !== null) {
    totalPaid = parseFloat(invoice.totalPaid);
  } else if (isPaid) {
    totalPaid = totalAmount;
  }

  const balanceDue = invoice.balance !== undefined && invoice.balance !== null
    ? parseFloat(invoice.balance)
    : Math.max(0, totalAmount - totalPaid);

  const issueDate = formatDate(invoice.issue_date || invoice.created_at || new Date());
  const dueDate = formatDate(invoice.due_date || invoice.issue_date);

  return (
    <div className="inv-tpl-container" id="printable-invoice">
      {/* HEADER ROW */}
      <div className="inv-tpl-header">
        <div>
          <h1 className="inv-tpl-title">INVOICE</h1>
          <div className="inv-tpl-number">{invoiceNumber}</div>
          <div className={`inv-tpl-status ${statusClass}`}>
            STATUS: {statusText}
          </div>
        </div>

        <div className="inv-tpl-company-info">
          {companyLogo && (
            <img src={companyLogo} alt={companyName} className="inv-tpl-logo" />
          )}
          <div className="inv-tpl-company-name">{companyName}</div>
          {companyAddress && <div className="inv-tpl-company-address">{companyAddress}</div>}
          {companyCountry && <div className="inv-tpl-company-address">{companyCountry}</div>}
          {companyPhone && <div className="inv-tpl-company-address">Phone: {companyPhone}</div>}
          {companyEmail && <div className="inv-tpl-company-address">Email: {companyEmail}</div>}
        </div>
      </div>

      <hr className="inv-tpl-divider" />

      {/* BILLED TO & INVOICE DETAILS ROW */}
      <div className="inv-tpl-meta-grid">
        {/* BILLED TO */}
        <div className="inv-tpl-meta-col">
          <div className="inv-tpl-section-label">BILLED TO:</div>
          <div className="inv-tpl-client-name">{clientName}</div>
          {businessName && <div className="inv-tpl-client-business">{businessName}</div>}
          {address && <div className="inv-tpl-client-detail">{address}</div>}
          {phone && <div className="inv-tpl-client-detail">Phone: {phone}</div>}
          {email && <div className="inv-tpl-client-detail">Email: {email}</div>}
        </div>

        {/* INVOICE DETAILS */}
        <div className="inv-tpl-meta-col" style={{ textAlign: 'right' }}>
          <div className="inv-tpl-section-label" style={{ textAlign: 'right' }}>INVOICE DETAILS:</div>
          <table className="inv-tpl-details-table">
            <tbody>
              <tr>
                <td className="label">Invoice Date:</td>
                <td className="value">{issueDate}</td>
              </tr>
              <tr>
                <td className="label">Payment Due:</td>
                <td className="value" style={{ color: balanceDue > 0 ? '#dc2626' : '#1e293b' }}>{dueDate}</td>
              </tr>
              <tr className="amount-due-row">
                <td className="label">Amount Due:</td>
                <td className="value">{formatMoney(balanceDue)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ITEMS TABLE */}
      <table className="inv-tpl-table">
        <thead>
          <tr>
            <th className="col-desc">ITEM / DESCRIPTION</th>
            <th className="col-qty">QTY</th>
            <th className="col-price">UNIT PRICE</th>
            <th className="col-disc">DISC %</th>
            <th className="col-tax">TAX %</th>
            <th className="col-total">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {items.length > 0 ? (
            items.map((item, idx) => {
              const qty = parseFloat(item.quantity) || 1;
              const unitPrice = parseFloat(item.unit_price || item.rate) || 0;
              const disc = item.discount ? `${item.discount}%` : '-';
              const tax = item.tax ? `${item.tax}%` : '-';
              const lineTotal = item.total !== undefined && item.total !== null ? parseFloat(item.total) : (qty * unitPrice);
              const formattedLineTotal = lineTotal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

              return (
                <tr key={idx}>
                  <td>
                    <div className="inv-tpl-item-title">{item.description || item.title || 'Item Description'}</div>
                    {(item.details || item.sku) && (
                      <div className="inv-tpl-item-sku">
                        {item.sku ? `SKU: ${item.sku}` : item.details}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>{qty.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(unitPrice)}</td>
                  <td style={{ textAlign: 'center' }}>{disc}</td>
                  <td style={{ textAlign: 'center' }}>{tax}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="inv-tpl-currency-tag">Rs.</div>
                    <div className="inv-tpl-line-total">{formattedLineTotal}</div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="6" style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>
                No line items available
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <hr className="inv-tpl-divider" style={{ margin: '1.25rem 0' }} />

      {/* FOOTER GRID: BANK DETAILS & PAYMENT SUMMARY */}
      <div className="inv-tpl-footer-grid">
        {/* BANK DETAILS */}
        <div style={{ flex: 1 }}>
          <div className="inv-tpl-section-label">BANK / PAYMENT DETAILS:</div>
          {bankTitle || bankName || bankAccount ? (
            <div className="inv-tpl-client-detail" style={{ lineHeight: '1.65' }}>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', marginBottom: '2px' }}>
                {bankName}
              </div>
              <div>Account Title: <strong>{bankTitle}</strong></div>
              <div>Account #: <strong>{bankAccount}</strong></div>
              {bankIban && <div>IBAN: <strong>{bankIban}</strong></div>}
            </div>
          ) : (
            <div className="inv-tpl-client-detail" style={{ color: '#94a3b8' }}>
              Bank transfer details not configured.
            </div>
          )}
        </div>

        {/* PAYMENT SUMMARY */}
        <div style={{ flex: 1 }}>
          <div className="inv-tpl-section-label" style={{ textAlign: 'right' }}>PAYMENT SUMMARY:</div>
          <table className="inv-tpl-summary-table">
            <tbody>
              <tr>
                <td className="label">Subtotal:</td>
                <td className="value">{formatMoney(subtotal)}</td>
              </tr>
              <tr className="total-row">
                <td className="label">Invoice Total:</td>
                <td className="value">{formatMoney(totalAmount)}</td>
              </tr>
              <tr className="paid-row">
                <td className="label">Amount Paid:</td>
                <td className="value" style={{ color: '#16a34a' }}>{formatMoney(totalPaid)}</td>
              </tr>
              <tr className={`balance-row ${balanceDue <= 0 ? 'zero' : 'due'}`}>
                <td className="label">Balance Due:</td>
                <td className="value" style={{ color: balanceDue <= 0 ? '#16a34a' : '#dc2626' }}>
                  {formatMoney(balanceDue)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* PAYMENTS RECEIVED TABLE (IF ANY PAYMENTS MADE) */}
      {payments && payments.length > 0 && (
        <div className="inv-tpl-payments-section">
          <hr className="inv-tpl-divider" style={{ margin: '1.25rem 0' }} />
          <div className="inv-tpl-section-label">PAYMENTS RECEIVED:</div>
          <table className="inv-tpl-payments-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>ACCOUNT / METHOD</th>
                <th>REFERENCE</th>
                <th style={{ textAlign: 'right' }}>AMOUNT PAID</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, idx) => (
                <tr key={idx}>
                  <td>{formatDate(p.payment_date || p.created_at)}</td>
                  <td>{p.bank_name || p.payment_method || 'Bank Transfer / Vault'}</td>
                  <td>{p.transaction_id || p.reference || `REF-${p.id || (idx + 1001)}`}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                    {formatMoney(p.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* FOOTER NOTE / SOFTWARE CREDITS */}
      <div className="inv-tpl-credits-box">
        <hr className="inv-tpl-divider" style={{ margin: '1.5rem 0 0.85rem 0' }} />
        <div>Thank you for your business! If you have questions about this invoice, please contact {companyEmail}</div>
        <div className="inv-tpl-credits-author">Software Powered by Adwise Labs</div>
      </div>

      {/* TERMS & CONDITIONS (IF PRESENT) */}
      {invoice.terms_and_conditions && (
        <div className="inv-tpl-terms-container terms-page-break">
          <div className="inv-tpl-terms-header">
            {companyLogo && <img src={companyLogo} alt="Logo" style={{ maxWidth: '140px', height: 'auto' }} />}
            <h2 className="inv-tpl-terms-title">Terms & Conditions</h2>
          </div>
          <div className="inv-tpl-terms-content">
            {invoice.terms_and_conditions}
          </div>
        </div>
      )}
    </div>
  );
}
