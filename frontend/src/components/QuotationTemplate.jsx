import React from 'react';
import './InvoiceTemplate.css';

export default function QuotationTemplate({ quotation = {}, companyDetails = {}, includeTerms = null }) {
  if (!quotation) return null;

  // Format currency helper matching exact invoice style (Rs. 8,600.00)
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

  // Extract Quotation Info
  const quotationNumber = quotation.quotation_number || quotation.number || 'QUO-0001';
  
  // Status calculation
  const rawStatus = (quotation.status || 'DRAFT').toUpperCase();
  const isAccepted = rawStatus === 'ACCEPTED' || rawStatus === 'PAID';
  const isPending = rawStatus === 'PENDING' || rawStatus === 'SENT';
  const isRejected = rawStatus === 'REJECTED' || rawStatus === 'DECLINED' || rawStatus === 'CANCELLED';
  const isExpired = rawStatus === 'EXPIRED';
  
  let statusClass = 'draft';
  if (isAccepted) statusClass = 'paid';
  else if (isPending) statusClass = 'partial';
  else if (isRejected || isExpired) statusClass = 'unpaid';

  const statusText = rawStatus;

  // Client Info
  const clientName = quotation.client_name || quotation.clientName || quotation.manual_client_name || 'Valued Client';
  const clientCompany = quotation.business_name || quotation.businessName || quotation.manual_client_business || quotation.company || '';
  const clientAddress = quotation.physical_address || quotation.address || quotation.manual_client_address || quotation.client_address || '';
  const clientEmail = quotation.client_email || quotation.email || quotation.manual_client_email || '';
  const clientPhone = quotation.client_phone || quotation.phone || quotation.whatsapp_number || quotation.manual_client_phone || '';

  // Company / Seller Details (Default to system info)
  const companyLogo = companyDetails.logo || '/logo.webp';
  const companyName = companyDetails.name || quotation.company_name || 'Adwise Labs';
  const companyAddress = companyDetails.address || 'A-205/II Saba Ave, DHA Karachi Phase VIII Zone A';
  const companyCountry = companyDetails.country || 'Pakistan';
  const companyPhone = companyDetails.phone || '+92 329 2371279';
  const companyEmail = companyDetails.email || 'info@adwiselabs.com';

  // Bank / Remittance Details
  const bankTitle = companyDetails.bankTitle || quotation.bank_title || companyName;
  const bankName = companyDetails.bankName || quotation.bank_name || 'Bank Al Falah';
  const bankAccount = companyDetails.bankAccount || quotation.bank_account || '56395002519988';
  const bankIban = companyDetails.bankIban || quotation.bank_iban || '';

  // Items
  const items = quotation.items || [];

  // Financial Calculations
  const calculatedItemsTotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 1;
    const price = parseFloat(item.unit_price !== undefined ? item.unit_price : (item.rate || 0)) || 0;
    const total = item.total !== undefined && item.total !== null ? parseFloat(item.total) : (qty * price);
    return sum + (isNaN(total) ? 0 : total);
  }, 0);

  const totalAmount = quotation.amount !== undefined && quotation.amount !== null
    ? parseFloat(quotation.amount)
    : (quotation.total !== undefined ? parseFloat(quotation.total) : calculatedItemsTotal);

  // Discount calculation
  const rawDiscount = parseFloat(quotation.discount) || 0;
  const inferredDiscount = (!rawDiscount && calculatedItemsTotal > (totalAmount + 0.01))
    ? (calculatedItemsTotal - totalAmount)
    : 0;
  const discount = rawDiscount > 0 ? rawDiscount : inferredDiscount;

  // Subtotal before discount
  const subtotal = quotation.subtotal !== undefined && quotation.subtotal !== null && parseFloat(quotation.subtotal) > totalAmount
    ? parseFloat(quotation.subtotal)
    : (calculatedItemsTotal > 0 ? calculatedItemsTotal : (totalAmount + discount));

  const issueDate = formatDate(quotation.issue_date || quotation.created_at || new Date());
  const validUntilDate = formatDate(quotation.valid_until || quotation.due_date || quotation.expiry_date || quotation.issue_date);

  // Terms and conditions handling
  const rawTerms = quotation.terms_and_conditions || quotation.terms;
  const hasValidTerms = typeof rawTerms === 'string' && rawTerms.trim().length > 0;
  const termsContent = hasValidTerms ? rawTerms.trim() : null;

  // If includeTerms is specified as boolean, strictly obey it; otherwise only show if terms exist
  const showTermsPage = includeTerms !== null 
    ? (includeTerms === true && (termsContent !== null || quotation.show_default_terms === true))
    : !!termsContent;

  return (
    <div className={`inv-tpl-container ${showTermsPage ? 'has-terms' : 'no-terms'}`} id="printable-quotation">
      {/* PAGE 1: QUOTATION MAIN BODY */}
      <div className="inv-tpl-page-1">
        {/* HEADER ROW */}
        <div className="inv-tpl-header">
          <div>
            <h1 className="inv-tpl-title">QUOTATION</h1>
            <div className="inv-tpl-number">{quotationNumber}</div>
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

        {/* CLIENT & QUOTATION DETAILS GRID */}
        <div className="inv-tpl-meta-grid">
          <div className="inv-tpl-meta-col">
            <div className="inv-tpl-section-label">QUOTATION TO:</div>
            <div className="inv-tpl-client-name">{clientName}</div>
            {clientCompany && <div className="inv-tpl-client-business">{clientCompany}</div>}
            {clientAddress && <div className="inv-tpl-client-detail">{clientAddress}</div>}
            {clientEmail && <div className="inv-tpl-client-detail">Email: {clientEmail}</div>}
            {clientPhone && <div className="inv-tpl-client-detail">Phone: {clientPhone}</div>}
          </div>

          <div className="inv-tpl-meta-col" style={{ textAlign: 'right' }}>
            <div className="inv-tpl-section-label" style={{ textAlign: 'right' }}>QUOTATION DETAILS:</div>
            <table className="inv-tpl-details-table">
              <tbody>
                <tr>
                  <td className="label">Quote Date:</td>
                  <td className="value">{issueDate}</td>
                </tr>
                <tr>
                  <td className="label">Valid Until:</td>
                  <td className="value">{validUntilDate}</td>
                </tr>
                <tr className="amount-due-row">
                  <td className="label">Quote Total:</td>
                  <td className="value" style={{ color: '#0f172a', fontWeight: 800 }}>
                    Rs. {totalAmount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              <th className="col-unit">UNIT</th>
              <th className="col-price">UNIT PRICE</th>
              <th className="col-total">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((item, idx) => {
                const qty = parseFloat(item.quantity) || 1;
                const unitPrice = parseFloat(item.unit_price !== undefined ? item.unit_price : (item.rate || 0)) || 0;
                const lineTotal = item.total !== undefined && item.total !== null ? parseFloat(item.total) : (qty * unitPrice);
                const formattedLineTotal = lineTotal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const unit = item.unit || item.unit_name || item.uom || '';

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
                    <td style={{ textAlign: 'center' }}>
                      <span className="inv-tpl-unit-text">{unit || '—'}</span>
                    </td>
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
                <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>
                  No line items available
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <hr className="inv-tpl-divider" style={{ margin: '1.25rem 0' }} />

        {/* FOOTER GRID: BANK DETAILS & QUOTATION SUMMARY */}
        <div className="inv-tpl-footer-grid">
          {/* BANK / REMITTANCE DETAILS */}
          <div style={{ flex: 1 }}>
            <div className="inv-tpl-section-label">BANK / REMITTANCE DETAILS:</div>
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

          {/* QUOTATION SUMMARY */}
          <div style={{ flex: 1 }}>
            <div className="inv-tpl-section-label" style={{ textAlign: 'right' }}>QUOTATION SUMMARY:</div>
            <table className="inv-tpl-summary-table">
              <tbody>
                <tr className="subtotal-row">
                  <td className="label">Subtotal:</td>
                  <td className="value">{formatMoney(subtotal)}</td>
                </tr>
                {discount > 0 && (
                  <tr className="discount-row">
                    <td className="label">Discount:</td>
                    <td className="value discount-value">- {formatMoney(discount)}</td>
                  </tr>
                )}
                <tr className="total-row">
                  <td className="label">Quotation Total:</td>
                  <td className="value" style={{ color: '#0f172a', fontWeight: 800 }}>
                    {formatMoney(totalAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FOOTER NOTE / SOFTWARE CREDITS */}
        <div className="inv-tpl-credits-box">
          <hr className="inv-tpl-divider" style={{ margin: '1.5rem 0 0.85rem 0' }} />
          <div>Thank you for considering our proposal! If you have questions about this quotation, please contact {companyEmail}</div>
          <div className="inv-tpl-credits-author">Software Powered by Adwise Labs</div>
        </div>
      </div>

      {/* TERMS & CONDITIONS (PAGE 2 - FORCED SEPARATE PAGE) */}
      {showTermsPage && (
        <div className="inv-tpl-terms-page terms-page-break">
          {/* TERMS TOP HEADER BAR */}
          <div className="inv-tpl-terms-top-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              {companyLogo && (
                <img src={companyLogo} alt={companyName} className="inv-tpl-terms-logo" />
              )}
              <div>
                <div className="inv-tpl-terms-company">{companyName}</div>
                <div className="inv-tpl-terms-subtitle">Terms of Service & Quotation Agreement</div>
              </div>
            </div>

            <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#64748b' }}>
              <div>Quotation: <strong style={{ color: '#0f172a' }}>{quotationNumber}</strong></div>
              <div>Date: <strong style={{ color: '#0f172a' }}>{issueDate}</strong></div>
            </div>
          </div>

          <hr className="inv-tpl-divider" style={{ margin: '1rem 0 1.5rem 0' }} />

          {/* MAIN TITLE & INTRO */}
          <h2 className="inv-tpl-terms-main-title">TERMS & CONDITIONS OF QUOTATION</h2>
          <div className="inv-tpl-terms-intro">
            The following standard terms and conditions govern this quotation and the agreed scope of work.
          </div>

          {/* TERMS CONTENT */}
          <div className="inv-tpl-terms-body">
            {termsContent ? (
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.75' }}>{termsContent}</div>
            ) : (
              <div style={{ lineHeight: '1.75' }}>
                <p style={{ margin: '0 0 0.85rem 0' }}>1. <strong>VALIDITY OF QUOTATION:</strong> This quotation remains valid for thirty (30) calendar days from the date of issuance, unless otherwise explicitly noted in writing.</p>
                <p style={{ margin: '0 0 0.85rem 0' }}>2. <strong>PAYMENT MILESTONES:</strong> Commencement of deliverables requires confirmation and agreement on payment milestones as outlined in the proposal.</p>
                <p style={{ margin: '0 0 0.85rem 0' }}>3. <strong>SCOPE ADJUSTMENTS:</strong> Any scope extensions, additional revision cycles, or supplementary requirements requested beyond this document will be quoted separately.</p>
                <p style={{ margin: '0 0 0.85rem 0' }}>4. <strong>INTELLECTUAL PROPERTY:</strong> Final deliverables and ownership will transfer to the client upon full settlement of all associated invoices.</p>
                <p style={{ margin: '0 0 0.85rem 0' }}>5. <strong>CONFIDENTIALITY:</strong> Both parties agree to safeguard confidential information shared in connection with this quotation.</p>
                <p style={{ margin: '0 0 0.85rem 0' }}>6. <strong>ACCEPTANCE:</strong> Signing or issuing formal written approval of this quotation confirms mutual agreement to proceed.</p>
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
              <div className="inv-tpl-sig-title">Client Acceptance / Confirmed By</div>
              <div className="inv-tpl-sig-name">{clientName}</div>
            </div>
          </div>

          {/* PAGE 2 FOOTER */}
          <div className="inv-tpl-terms-footer">
            <hr className="inv-tpl-divider" style={{ margin: '1.5rem 0 0.85rem 0' }} />
            <div>{quotationNumber}</div>
            <div className="inv-tpl-credits-author" style={{ marginTop: '0.2rem' }}>
              Software Powered by Adwise Labs
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
