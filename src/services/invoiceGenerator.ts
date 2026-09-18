import { jsPDF } from 'jspdf';
import { Invoice, UserRole } from '../types';
import { logActivity } from './activityLogger';

export async function generateAndDownloadInvoicePDF(
  invoice: Invoice,
  userRole: UserRole = 'customer'
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 18;

  // Primary palette (Deep Burgundy #5B0E14 & Aqua Mist #789A99)
  doc.setFillColor(91, 14, 20); // #5B0E14
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('CHARMS HUB AI', margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Handcrafted Jewelry & Aesthetic Accessories | Authentic Catalog Store', margin, 20);

  // INVOICE label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('INVOICE', pageWidth - margin - 35, 14);
  doc.setFontSize(8);
  doc.text('ELECTRONICALLY GENERATED', pageWidth - margin - 48, 20);

  y = 38;

  // Invoice & Order Meta
  doc.setTextColor(43, 24, 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Invoice No: ${invoice.invoice_number}`, margin, y);
  doc.text(`Order No: ${invoice.order_number}`, margin, y + 6);
  doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, margin, y + 12);
  doc.text(`Status: ${invoice.status.toUpperCase()}`, margin, y + 18);

  // Sold By
  const rightColX = pageWidth / 2 + 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Sold By / Merchant:', rightColX, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Charms Hub Official', rightColX, y + 5);
  doc.text('Online Store: charmshub.mart-24.com', rightColX, y + 10);
  doc.text('Customer Support: WhatsApp Helpdesk Available', rightColX, y + 15);

  y += 28;

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Customer & Shipping Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Billed & Shipped To:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  y += 5;
  doc.text(`Customer Name: ${invoice.customer_name}`, margin, y);
  y += 4.5;
  doc.text(`Email: ${invoice.customer_email}`, margin, y);
  y += 4.5;
  if (invoice.shipping_details.phone) {
    doc.text(`Phone: ${invoice.shipping_details.phone}`, margin, y);
    y += 4.5;
  }
  const addr = `${invoice.shipping_details.street}, ${invoice.shipping_details.city}, ${invoice.shipping_details.state} - ${invoice.shipping_details.pincode}`;
  doc.text(`Delivery Address: ${addr}`, margin, y);

  y += 9;

  // Table Header
  doc.setFillColor(245, 235, 230); // Soft peach
  doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(43, 24, 16);

  const colItem = margin + 3;
  const colQty = margin + 100;
  const colPrice = margin + 125;
  const colTotal = margin + 155;

  doc.text('Item Description (Snapshot)', colItem, y + 5.5);
  doc.text('Qty', colQty, y + 5.5);
  doc.text('Unit Price', colPrice, y + 5.5);
  doc.text('Total (INR)', colTotal, y + 5.5);

  y += 8;

  // Table Rows (Items)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  invoice.items.forEach((item, idx) => {
    // Alternating row background
    if (idx % 2 === 1) {
      doc.setFillColor(252, 248, 245);
      doc.rect(margin, y, pageWidth - 2 * margin, 7, 'F');
    }

    const itemName = item.product_name_snapshot.length > 50
      ? item.product_name_snapshot.substring(0, 48) + '...'
      : item.product_name_snapshot;

    doc.text(itemName, colItem, y + 5);
    doc.text(item.quantity.toString(), colQty, y + 5);
    doc.text(`Rs. ${item.unit_price}`, colPrice, y + 5);
    doc.text(`Rs. ${item.line_total}`, colTotal, y + 5);

    y += 7;
  });

  // Table bottom line
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Summary Box
  const summaryX = margin + 105;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  doc.text('Subtotal:', summaryX, y);
  doc.text(`Rs. ${invoice.subtotal}`, colTotal, y);
  y += 5;

  if (invoice.discount_amount > 0) {
    doc.text('Promotional Discount:', summaryX, y);
    doc.text(`- Rs. ${invoice.discount_amount}`, colTotal, y);
    y += 5;
  }

  doc.text('Shipping Fee:', summaryX, y);
  doc.text(invoice.shipping_amount === 0 ? 'FREE' : `Rs. ${invoice.shipping_amount}`, colTotal, y);
  y += 5;

  doc.setDrawColor(91, 14, 20);
  doc.line(summaryX, y, pageWidth - margin, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(91, 14, 20);
  doc.text('Grand Total:', summaryX, y);
  doc.text(`Rs. ${invoice.total_amount}`, colTotal, y);

  y += 15;

  // Important Terms & Policy Notes
  doc.setFillColor(253, 244, 238);
  doc.roundedRect(margin, y, pageWidth - 2 * margin, 32, 2, 2, 'F');
  doc.setDrawColor(240, 210, 200);
  doc.roundedRect(margin, y, pageWidth - 2 * margin, 32, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(91, 14, 20);
  doc.text('IMPORTANT CHARMS HUB POLICIES & GUIDELINES:', margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 50, 50);
  doc.text('1. MANDATORY UNBOXING VIDEO: As per store policy, a 360-degree opening video without cuts or pauses', margin + 4, y + 12);
  doc.text('   starting from outer packaging is strictly mandatory for reporting transit damages or missing items within 24h.', margin + 4, y + 16);
  doc.text('2. DISPATCH & DELIVERY: Handcrafted orders are dispatched within 24-48 hours. Expected transit: 4-7 business days.', margin + 4, y + 21);
  doc.text('3. FREE SHIPPING: Free standard shipping is provided on all cart orders of Rs. 499 or above across India.', margin + 4, y + 26);

  // Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text('This is an electronically generated authentic invoice from Charms Hub AI. No physical signature required.', margin, 285);

  // Save / Trigger Download
  const filename = `CharmsHub_Invoice_${invoice.invoice_number}.pdf`;
  doc.save(filename);

  // Log activity
  await logActivity({
    userId: invoice.user_id,
    userEmail: invoice.customer_email,
    role: userRole,
    eventType: 'invoice_downloaded',
    entityType: 'invoice',
    entityId: invoice.id,
    metadata: {
      invoice_number: invoice.invoice_number,
      order_number: invoice.order_number,
      total_amount: invoice.total_amount,
    },
  });
}

export const downloadInvoicePDF = generateAndDownloadInvoicePDF;
