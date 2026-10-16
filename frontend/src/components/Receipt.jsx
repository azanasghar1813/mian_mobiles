import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export default function Receipt({ sale, isPreview = false }) {
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (barcodeRef.current && sale?.bill_no) {
      try {
        JsBarcode(barcodeRef.current, sale.bill_no, {
          format: 'CODE128',
          width: 1.8,
          height: 42,
          displayValue: true,
          fontSize: 12,
          font: 'JetBrains Mono',
          textMargin: 3,
          margin: 0
        });
      } catch (e) {
        console.error('Barcode render error:', e);
      }
    }
  }, [sale]);

  if (!sale) return null;

  // Format currency helper
  const fmt = (num) => {
    const val = parseFloat(num) || 0;
    return val.toLocaleString('en-PK', {
      minimumFractionDigits: val % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    });
  };

  // Format date helper (e.g. 14/10/2026 and 10:00 AM)
  const createdAt = sale.created_at ? new Date(sale.created_at) : new Date();
  const day = String(createdAt.getDate()).padStart(2, '0');
  const month = String(createdAt.getMonth() + 1).padStart(2, '0');
  const year = createdAt.getFullYear();
  const dateStr = `${day}/${month}/${year}`;

  let hours = createdAt.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutes = String(createdAt.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes} ${ampm}`;
  const fullDateTimeStr = `${dateStr} ${timeStr}`;

  const shopName = sale.settings?.shop_name || 'MIAN MOBILES';
  const shopTagline = sale.settings?.shop_tagline || 'Mobile Phones & Accessories';
  const shopAddress = sale.settings?.shop_address || 'Goal Market, Layyah Road,\nWard No. 1, Chowk Azam 31450, Pakistan';
  const shopPhone = sale.settings?.shop_phone || '+92 302 8764613';
  const currency = sale.settings?.currency || 'Rs.';

  return (
    <div
      id={isPreview ? undefined : 'thermal-receipt-printable'}
      className={isPreview ? 'receipt-paper' : ''}
      style={{
        width: '74mm',
        maxWidth: '74mm',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontFamily: "'JetBrains Mono', 'Courier New', Courier, monospace",
        fontSize: '11px',
        lineHeight: 1.25,
        padding: '14px 10px',
        boxSizing: 'border-box'
      }}
    >
      {/* 1. Header: Logo & Shop Details */}
      <div style={{ textAlign: 'center', marginBottom: '8px', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '3px' }}>
          {/* Logo Silhouette SVG */}
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="2" width="12" height="20" rx="2" ry="2" />
            <path d="M11 18h2" />
            <path d="M2 13a10 10 0 0 0 10 9" />
            <path d="M22 11a10 10 0 0 0-10-9" />
          </svg>
          <span style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '0.5px' }}>
            {shopName}
          </span>
        </div>
        <div style={{ fontSize: '11px', fontWeight: '700', marginBottom: '3px' }}>
          {shopTagline}
        </div>
        <div style={{ fontSize: '9.5px', whiteSpace: 'pre-line', lineHeight: 1.25, color: '#222' }}>
          {shopAddress}
        </div>
        <div style={{ fontSize: '10.5px', fontWeight: '700', marginTop: '3px' }}>
          Phone: {shopPhone}
        </div>
      </div>

      {/* Dashed Line */}
      <div style={{ borderTop: '1px dashed #000', width: '100%', margin: '6px 0' }} />

      {/* 2. Invoice Meta */}
      <div style={{ fontSize: '10.5px', lineHeight: 1.35, width: '100%' }}>
        <div style={{ display: 'flex' }}>
          <span style={{ width: '85px' }}>Invoice #</span>
          <span style={{ width: '12px' }}>:</span>
          <span style={{ fontWeight: '700' }}>{sale.bill_no}</span>
        </div>
        <div style={{ display: 'flex' }}>
          <span style={{ width: '85px' }}>Date</span>
          <span style={{ width: '12px' }}>:</span>
          <span>{dateStr}</span>
        </div>
        <div style={{ display: 'flex' }}>
          <span style={{ width: '85px' }}>Time</span>
          <span style={{ width: '12px' }}>:</span>
          <span>{timeStr}</span>
        </div>
      </div>

      {/* Dashed Line */}
      <div style={{ borderTop: '1px dashed #000', width: '100%', margin: '6px 0' }} />

      {/* 3. Customer Meta */}
      <div style={{ fontSize: '10.5px', lineHeight: 1.35, width: '100%' }}>
        <div style={{ display: 'flex' }}>
          <span style={{ width: '85px' }}>Customer</span>
          <span style={{ width: '12px' }}>:</span>
          <span>{sale.customer_name || 'Walk-in Customer'}</span>
        </div>
        <div style={{ display: 'flex' }}>
          <span style={{ width: '85px' }}>Phone</span>
          <span style={{ width: '12px' }}>:</span>
          <span>{sale.customer_phone || '--------------'}</span>
        </div>
      </div>

      {/* Dashed Line */}
      <div style={{ borderTop: '1px dashed #000', width: '100%', margin: '6px 0' }} />

      {/* 4. Boxed Items Table (Exact Full Width 100%) */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1.5px solid #000',
          fontSize: '10px',
          margin: '6px 0',
          tableLayout: 'fixed'
        }}
      >
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={{ border: '1.5px solid #000', padding: '4px 5px', textAlign: 'left', width: '56%' }}>Item</th>
            <th style={{ border: '1.5px solid #000', padding: '4px 2px', textAlign: 'center', width: '14%' }}>Qty</th>
            <th style={{ border: '1.5px solid #000', padding: '4px 5px', textAlign: 'right', width: '30%' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items && sale.items.map((item, idx) => (
            <tr key={idx}>
              <td style={{ border: '1px solid #000', padding: '4px 5px', wordBreak: 'break-word' }}>
                <div style={{ fontWeight: '600' }}>{item.product_name}</div>
                {item.imei1 && (
                  <div style={{ fontSize: '8.5px', color: '#111', marginTop: '2px' }}>
                    IMEI: {item.imei1}
                    {item.warranty_until && ` | War: ${item.warranty_until}`}
                  </div>
                )}
              </td>
              <td style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'center', verticalAlign: 'top' }}>
                {item.qty}
              </td>
              <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                {currency} {fmt(item.price * item.qty - (item.discount || 0))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 5. Subtotals & Totals Block (Right Aligned Flush with Table) */}
      <div style={{ fontSize: '10.5px', lineHeight: 1.35, marginTop: '4px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '160px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal</span>
            <span style={{ width: '10px', textAlign: 'center' }}>:</span>
            <span style={{ width: '90px', textAlign: 'right' }}>{currency} {fmt(sale.subtotal)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '160px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Discount</span>
            <span style={{ width: '10px', textAlign: 'center' }}>:</span>
            <span style={{ width: '90px', textAlign: 'right' }}>{currency} {fmt(sale.discount)}</span>
          </div>
        </div>

        {/* Total Dashed Divider */}
        <div style={{ borderTop: '1px dashed #000', width: '100%', margin: '5px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '12px', fontWeight: '900' }}>
          <div style={{ width: '180px', display: 'flex', justifyContent: 'space-between' }}>
            <span>TOTAL</span>
            <span style={{ width: '10px', textAlign: 'center' }}>:</span>
            <span style={{ width: '105px', textAlign: 'right' }}>{currency} {fmt(sale.total)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
          <div style={{ width: '160px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Paid</span>
            <span style={{ width: '10px', textAlign: 'center' }}>:</span>
            <span style={{ width: '90px', textAlign: 'right' }}>{currency} {fmt(sale.paid)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '160px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Balance</span>
            <span style={{ width: '10px', textAlign: 'center' }}>:</span>
            <span style={{ width: '90px', textAlign: 'right' }}>{currency} {fmt(sale.balance)}</span>
          </div>
        </div>
      </div>

      {/* Dashed Line */}
      <div style={{ borderTop: '1px dashed #000', width: '100%', margin: '6px 0' }} />

      {/* 6. Payment & Status */}
      <div style={{ fontSize: '10px', lineHeight: 1.35, width: '100%' }}>
        <div style={{ display: 'flex' }}>
          <span style={{ width: '105px' }}>Payment Method</span>
          <span style={{ width: '10px' }}>:</span>
          <span>{sale.payment_method || 'Cash'}</span>
        </div>
        <div style={{ display: 'flex' }}>
          <span style={{ width: '105px' }}>Invoice Opened</span>
          <span style={{ width: '10px' }}>:</span>
          <span>{fullDateTimeStr}</span>
        </div>
        <div style={{ display: 'flex' }}>
          <span style={{ width: '105px' }}>Status</span>
          <span style={{ width: '10px' }}>:</span>
          <span style={{ fontWeight: '700' }}>{sale.status || 'PAID'}</span>
        </div>
      </div>

      {/* Dashed Line */}
      <div style={{ borderTop: '1px dashed #000', width: '100%', margin: '6px 0' }} />

      {/* 7. Footer Thank You */}
      <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '10.5px', width: '100%' }}>
        <div>Thank You for Shopping with</div>
        <div style={{ fontWeight: '900', fontSize: '13px', margin: '2px 0' }}>{shopName}!</div>
        <div style={{ fontSize: '9.5px', marginTop: '2px' }}>— Your Trust Is Our Priority —</div>
        <div style={{ fontSize: '8.5px', color: '#444', marginTop: '4px' }}>— Powered by Mian Mobiles —</div>
      </div>

      {/* 8. Barcode (Centered) */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', marginTop: '6px' }}>
        <svg ref={barcodeRef} style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }}></svg>
      </div>
    </div>
  );
}
