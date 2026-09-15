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
  const clientCompany = invoice.business_name || invoice.businessName || invoice.company || '';
  const clientAddress = invoice.physical_address || invoice.address || invoice.client_address || '';
  const clientEmail = invoice.client_email || invoice.email || '';
  const clientPhone = invoice.client_phone || invoice.phone || invoice.whatsapp_number || '';

  // Company / Seller Details (Default to system info)
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

  const termsContent = invoice.terms_and_conditions || invoice.terms || true;

  return (
    <div className="inv-tpl-container" id="printable-invoice">
      {/* PAGE 1: INVOICE MAIN BODY */}
      <div className="inv-tpl-page-1">
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

        {/* CLIENT & INVOICE DETAILS GRID */}
        <div className="inv-tpl-meta-grid">
          <div className="inv-tpl-meta-col">
            <div className="inv-tpl-section-label">BILLED TO:</div>
            <div className="inv-tpl-client-name">{clientName}</div>
            {clientCompany && <div className="inv-tpl-client-business">{clientCompany}</div>}
            {clientAddress && <div className="inv-tpl-client-detail">{clientAddress}</div>}
            {clientEmail && <div className="inv-tpl-client-detail">Email: {clientEmail}</div>}
            {clientPhone && <div className="inv-tpl-client-detail">Phone: {clientPhone}</div>}
          </div>

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
                  <td className="value" style={{ color: '#0f172a', fontWeight: 800 }}>
                    Rs. {balanceDue.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
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
              <th className="col-total">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((item, idx) => {
                const qty = parseFloat(item.quantity) || 1;
                const unitPrice = parseFloat(item.unit_price || item.rate) || 0;
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
                    <td style={{ textAlign: 'right' }}>
                      <div className="inv-tpl-currency-tag">Rs.</div>
                      <div className="inv-tpl-line-total">{formattedLineTotal}</div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>
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
                <tr className="subtotal-row">
                  <td className="label">Subtotal:</td>
                  <td className="value">{formatMoney(subtotal)}</td>
                </tr>
                <tr className="total-row">
                  <td className="label">Invoice Total:</td>
                  <td className="value">{formatMoney(totalAmount)}</td>
                </tr>
                <tr className="paid-row">
                  <td className="label">Amount Paid:</td>
                  <td className="value">{formatMoney(totalPaid)}</td>
                </tr>
                <tr className={`balance-row ${balanceDue <= 0 ? 'zero' : 'due'}`}>
                  <td className="label">Balance Due:</td>
                  <td className="value">
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
      </div>

      {/* TERMS & CONDITIONS (PAGE 2 - FORCED SEPARATE PAGE) */}
      {termsContent && (
        <div className="inv-tpl-terms-page terms-page-break">
          {/* TERMS TOP HEADER BAR */}
          <div className="inv-tpl-terms-top-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              {companyLogo && (
                <img src={companyLogo} alt={companyName} className="inv-tpl-terms-logo" />
              )}
              <div>
                <div className="inv-tpl-terms-company">{companyName}</div>
                <div className="inv-tpl-terms-subtitle">Terms of Service & Invoicing Agreement</div>
              </div>
            </div>

            <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#64748b' }}>
              <div>Invoice: <strong style={{ color: '#0f172a' }}>{invoiceNumber}</strong></div>
              <div>Date: <strong style={{ color: '#0f172a' }}>{issueDate}</strong></div>
            </div>
          </div>

          <hr className="inv-tpl-divider" style={{ margin: '1rem 0 1.5rem 0' }} />

          {/* MAIN TITLE & INTRO */}
          <h2 className="inv-tpl-terms-main-title">TERMS & CONDITIONS OF SALE</h2>
          <div className="inv-tpl-terms-intro">
            The following standard terms and conditions govern this invoice and the supply of products or services.
          </div>

          {/* TERMS CONTENT */}
          <div className="inv-tpl-terms-body">
            {typeof termsContent === 'string' ? termsContent : (
              <div style={{ lineHeight: '1.75' }}>
                <p style={{ margin: '0 0 0.85rem 0' }}>1. <strong>PAYMENT TERMS:</strong> Payment is strictly due according to the agreed payment terms specified on Page 1. Late payments may be subject to a finance charge of 1.5% per month on overdue balances.</p>
                <p style={{ margin: '0 0 0.85rem 0' }}>2. <strong>REMITTANCE:</strong> All wire and bank remittances must be directed to the official company bank account listed on Page 1. Please include the Invoice Number as the transaction reference.</p>
                <p style={{ margin: '0 0 0.85rem 0' }}>3. <strong>CLAIMS & INSPECTION:</strong> Any discrepancy, damaged item, or shortage in delivery must be reported in writing within three (3) business days from the delivery date.</p>
                <p style={{ margin: '0 0 0.85rem 0' }}>4. <strong>RETENTION OF TITLE:</strong> All delivered goods remain the sole property of the vendor until the entire invoice amount has been paid in full.</p>
                <p style={{ margin: '0 0 0.85rem 0' }}>5. <strong>RETURN POLICY:</strong> Goods returned without prior written authorization will not be accepted. Custom or clearance items are non-returnable.</p>
                <p style={{ margin: '0 0 0.85rem 0' }}>6. <strong>GOVERNING LAW & JURISDICTION:</strong> This invoice agreement is governed by and construed in accordance with the applicable laws of the jurisdiction in which the vendor operates.</p>
              </div>
            )}
          </div>

          {/* SIGNATURES BLOCK */}
          <div className="inv-tpl-signatures-grid">
            <div className="inv-tpl-sig-box">
              <div className="inv-tpl-sig-line"></div>
              <div className="inv-tpl-sig-title">Authorized Signature & Stamp</div>
              <div className="inv-tpl-sig-name">{companyName}</div>
            </div>

            <div className="inv-tpl-sig-box">
              <div className="inv-tpl-sig-line"></div>
              <div className="inv-tpl-sig-title">Client Acceptance / Received By</div>
              <div className="inv-tpl-sig-name">{clientName}</div>
            </div>
          </div>

          {/* PAGE 2 FOOTER */}
          <div className="inv-tpl-terms-footer">
            <hr className="inv-tpl-divider" style={{ margin: '1.5rem 0 0.85rem 0' }} />
            <div>Page 2 of 2 • {invoiceNumber}</div>
            <div className="inv-tpl-credits-author" style={{ marginTop: '0.2rem' }}>
              Software Powered by Adwise Labs
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
