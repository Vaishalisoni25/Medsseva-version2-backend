import PDFDocument from 'pdfkit';
import { cloudinary } from '../config/cloudinary';
import os from 'os';
import path from 'path';
import fs from 'fs';

const LOGO_PATH = path.join(__dirname, '../../assets/logo.png');

export interface InvoiceLineItem {
  name: string;
  category?: string;
  itemType: string;
  originalPrice: number;
  discountedPrice: number;
  discount: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  receiptNumber: string;
  bookingId: string;
  bookingCode: string;
  paymentId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  paymentMethod: string;
  paidAt: Date;
  patientName: string;
  patientAge?: number | null;
  patientDob?: string | null;
  patientGender?: string | null;
  patientMobile?: string | null;
  patientEmail?: string | null;
  patientAddress?: string | null;
  collectionMode: string;
  collectionAddress?: string;
  branchName?: string | null;
  scheduledDate: Date;
  scheduledSlot: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  testDiscount: number;
  couponCode?: string | null;
  couponDiscount: number;
  collectionCharge: number;
  gst: number;
  platformFee: number;
  finalAmount: number;
}

export interface UploadedDocument {
  url: string;
  publicId: string;
}

const COMPANY = {
  name: 'MEDSSEVA GLOBAL HEALTHCARE PRIVATE LIMITED',
  tagline: 'Smart Diagnostics. Better Care.',
  gstin: '09AATCM6853F1ZU',
  cin: 'U85110MH2021PTC362145',
  pan: 'AAFCO021L',
  website: 'www.medseva.com',
  email: 'medssevagroup@gmail.com',
  phone: '+91 8448030936',
  address1: 'G-130 BASEMENT OFFICE NO 01, NOIDA',
  address2: 'GAUTAM BUDDHA NAGAR, Uttar Pradesh - 201301',
};

const C = {
  primary: '#005C55',
  teal: '#0F766E',
  tealLight: '#CCFBF1',
  text: '#121C2A',
  muted: '#6B7280',
  border: '#E5E7EB',
  bg: '#F9FAFB',
  white: '#FFFFFF',
  red: '#DC2626',
  green: '#15803D',
  greenBg: '#F0FDF4',
  greenBorder: '#BBF7D0',
};

const PW = 595.28;
const PH = 841.89;
const ML = 40;
const MR = 40;
const CW = PW - ML - MR;
const FOOTER_H = 120;

function calculateAgeFromDob(dob: string): number | null {
  try {
    const parts = dob.split(/[-\/]/);
    let birthDate: Date;
    if (parts.length === 3) {
      const [a, b, c] = parts.map(Number);
      birthDate = c > 31 ? new Date(c, b - 1, a) : new Date(a, b - 1, c);
    } else {
      birthDate = new Date(dob);
    }
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age >= 0 && age <= 120 ? age : null;
  } catch {
    return null;
  }
}

export class InvoiceService {
  async generateAndUploadInvoice(data: InvoiceData): Promise<{ invoice: UploadedDocument; receipt: UploadedDocument }> {
    const [invoice, receipt] = await Promise.all([
      this.buildAndUpload(data, 'invoice'),
      this.buildAndUpload(data, 'receipt'),
    ]);
    return { invoice, receipt };
  }

  private async buildAndUpload(data: InvoiceData, type: 'invoice' | 'receipt'): Promise<UploadedDocument> {
    const tmpFile = path.join(os.tmpdir(), `${type}-${data.bookingCode}-${Date.now()}.pdf`);
    await this.writePdf(data, type, tmpFile);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const docNumber = type === 'invoice' ? data.invoiceNumber : data.receiptNumber;
    const folder = `medseva/${type}s/${year}/${month}`;

    const result = await cloudinary.uploader.upload(tmpFile, {
      folder,
      public_id: docNumber.replace(/[^a-zA-Z0-9\-_]/g, '-'),
      resource_type: 'raw',
      format: 'pdf',
      overwrite: true,
    });

    fs.unlink(tmpFile, () => {});
    return { url: result.secure_url, publicId: result.public_id };
  }

  private writePdf(data: InvoiceData, type: 'invoice' | 'receipt', outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: true });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      const docNumber = type === 'invoice' ? data.invoiceNumber : data.receiptNumber;
      const docTitle = type === 'invoice' ? 'TAX INVOICE' : 'PAYMENT RECEIPT';

      let y = ML;
      y = this.header(doc, data, docNumber, docTitle, y);
      y = this.companyMeta(doc, y);
      y = this.infoSection(doc, data, y);
      y = this.testTable(doc, data, y);
      this.summaryAndPayment(doc, data, y);
      this.footer(doc);

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }

private header(doc: PDFKit.PDFDocument, data: InvoiceData, docNumber: string, docTitle: string, y: number): number {
    const LOGO_BOX_W = 160;
    const LOGO_BOX_H = 44;
    doc.rect(ML, y, LOGO_BOX_W, LOGO_BOX_H).fill(C.primary);
    if (fs.existsSync(LOGO_PATH)) {
      const MAX_IMG_W = 144;
      const MAX_IMG_H = 36;
      const PAD_X = (LOGO_BOX_W - MAX_IMG_W) / 2;
      const PAD_Y = (LOGO_BOX_H - MAX_IMG_H) / 2;
      doc.image(LOGO_PATH, ML + PAD_X, y + PAD_Y, { width: MAX_IMG_W, height: MAX_IMG_H, fit: [MAX_IMG_W, MAX_IMG_H], align: 'center', valign: 'center' });
    } else {
      doc.fillColor(C.white).fontSize(16).font('Helvetica-Bold').text('MedsSeva', ML + 10, y + 8);
      doc.fillColor(C.tealLight).fontSize(7).font('Helvetica').text('Smart Diagnostics. Better Care.', ML + 10, y + 28);
    }

    // Title right
    doc.fillColor(C.text).fontSize(24).font('Helvetica-Bold')
      .text(docTitle, ML, y, { width: CW, align: 'right' });

    // Invoice meta
    const metaY = y + 30;
    doc.fillColor(C.muted).fontSize(8).font('Helvetica')
      .text(`INVOICE NO: ${docNumber}`, ML, metaY, { width: CW, align: 'right' });
    doc.text(
      `DATE: ${data.paidAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      ML, metaY + 12, { width: CW, align: 'right' }
    );

    // PAID badge
    const badgeY = metaY + 28;
    doc.roundedRect(PW - MR - 46, badgeY, 46, 15, 3).fill(C.green);
    doc.fillColor(C.white).fontSize(8).font('Helvetica-Bold')
      .text('● PAID', PW - MR - 44, badgeY + 4, { width: 42, align: 'center' });

    // Company name below logo
    const cnY = y + 46;
    doc.fillColor(C.text).fontSize(10).font('Helvetica-Bold').text(COMPANY.name, ML, cnY);
    doc.fillColor(C.muted).fontSize(8).font('Helvetica-Oblique').text(COMPANY.tagline, ML, cnY + 13);

    const lineY = cnY + 27;
    doc.moveTo(ML, lineY).lineTo(PW - MR, lineY).lineWidth(0.5).stroke(C.border);

    return lineY + 10;
  }

  private companyMeta(doc: PDFKit.PDFDocument, y: number): number {
    const cols = [
      { label: 'GSTIN', value: COMPANY.gstin },
      { label: 'SUPPORT EMAIL', value: COMPANY.email },
      { label: 'WEBSITE', value: COMPANY.website },
      { label: 'CONTACT', value: COMPANY.phone },
    ];
    const colW = CW / 4;
    cols.forEach((c, i) => {
      const x = ML + i * colW;
      doc.fillColor(C.muted).fontSize(7).font('Helvetica').text(c.label, x, y);
      doc.fillColor(C.text).fontSize(8).font('Helvetica-Bold').text(c.value, x, y + 10);
    });
    const lineY = y + 26;
    doc.moveTo(ML, lineY).lineTo(PW - MR, lineY).lineWidth(0.5).stroke(C.border);
    return lineY + 12;
  }

  private infoSection(doc: PDFKit.PDFDocument, data: InvoiceData, y: number): number {
    const halfW = CW / 2 - 8;
    const rX = ML + halfW + 16;
    const ROW_H = 18;

    doc.fillColor(C.teal).fontSize(9).font('Helvetica-Bold').text('Patient Information', ML, y);
    doc.fillColor(C.teal).fontSize(9).font('Helvetica-Bold').text('Booking Information', rX, y);

    const lineY = y + 14;
    doc.moveTo(ML, lineY).lineTo(ML + halfW, lineY).lineWidth(0.5).stroke(C.border);
    doc.moveTo(rX, lineY).lineTo(rX + halfW, lineY).lineWidth(0.5).stroke(C.border);

    const drawRow = (x: number, w: number, ry: number, label: string, value: string) => {
      doc.fillColor(C.muted).fontSize(8).font('Helvetica').text(label, x, ry);
      doc.fillColor(C.text).fontSize(8).font('Helvetica')
        .text(value, x + w * 0.42, ry, { width: w * 0.58, align: 'right' });
      doc.moveTo(x, ry + 13).lineTo(x + w, ry + 13).lineWidth(0.3).stroke('#F3F4F6');
    };

const resolvedAge: number | null =
      (data.patientAge != null && data.patientAge > 0)
        ? data.patientAge
        : data.patientDob
          ? calculateAgeFromDob(data.patientDob)
          : null;

    const ageDisplay = resolvedAge != null ? `${resolvedAge} Years` : '-';
    const genderDisplay = data.patientGender
      ? data.patientGender.charAt(0).toUpperCase() + data.patientGender.slice(1).toLowerCase()
      : '-';

    const patientRows: [string, string][] = [
      ['Name', data.patientName || '-'],
      ['Age / Gender', `${ageDisplay} / ${genderDisplay}`],
      ['Mobile', data.patientMobile ? `+91 ${data.patientMobile}` : '-'],
      ['Email', data.patientEmail || '-'],
      ['Address', data.collectionAddress || '-'],
    ];

    const bookingRows: [string, string][] = [
      ['Booking Code', data.bookingCode],
      ['Collection Mode', data.collectionMode === 'HOME' ? 'Home Sample Collection' : 'Lab Visit'],
      ['Branch', data.branchName || '-'],
      ['Booking Date', data.scheduledDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })],
      ['Collection Time', data.scheduledSlot],
      ['Payment Mode', data.paymentMethod || 'Online'],
    ];

    let lY = lineY + 8;
    let rY = lineY + 8;
    const maxR = Math.max(patientRows.length, bookingRows.length);
    for (let i = 0; i < maxR; i++) {
      if (patientRows[i]) { drawRow(ML, halfW, lY, patientRows[i][0], patientRows[i][1]); lY += ROW_H; }
      if (bookingRows[i]) { drawRow(rX, halfW, rY, bookingRows[i][0], bookingRows[i][1]); rY += ROW_H; }
    }

    const endY = Math.max(lY, rY) + 8;
    doc.moveTo(ML, endY).lineTo(PW - MR, endY).lineWidth(0.5).stroke(C.border);
    return endY + 12;
  }

  private testTable(doc: PDFKit.PDFDocument, data: InvoiceData, startY: number): number {
    const cols = {
      num:      { x: ML,       w: 22  },
      name:     { x: ML + 22,  w: 168 },
      cat:      { x: ML + 190, w: 88  },
      mrp:      { x: ML + 278, w: 64  },
      disc:     { x: ML + 342, w: 66  },
      qty:      { x: ML + 408, w: 28  },
      final:    { x: ML + 436, w: 79  },
    };

    const drawHeader = (y: number): number => {
      doc.rect(ML, y, CW, 20).fill(C.primary);
      doc.fillColor(C.white).fontSize(7).font('Helvetica-Bold');
      doc.text('#',                cols.num.x + 3, y + 7);
      doc.text('TEST NAME',        cols.name.x,    y + 7);
      doc.text('CATEGORY',         cols.cat.x,     y + 7);
      doc.text('MRP (₹)',          cols.mrp.x,     y + 7, { width: cols.mrp.w,  align: 'right' });
      doc.text('DISCOUNT',         cols.disc.x,    y + 7, { width: cols.disc.w, align: 'right' });
      doc.text('QTY',              cols.qty.x,     y + 7, { width: cols.qty.w,  align: 'center' });
      doc.text('FINAL PRICE (₹)',  cols.final.x,   y + 7, { width: cols.final.w, align: 'right' });
      return y + 20;
    };

    let y = drawHeader(startY);
    const ROW_H = 26;

    data.lineItems.forEach((item, i) => {
      const spaceLeft = PH - y - FOOTER_H - 60;
      if (spaceLeft < ROW_H) {
        doc.addPage({ margin: 0, size: 'A4' });
        y = ML;
        y = drawHeader(y);
      }

      doc.rect(ML, y, CW, ROW_H).fill(i % 2 === 0 ? C.white : C.bg);

      doc.fillColor(C.muted).fontSize(8).font('Helvetica')
        .text(String(i + 1).padStart(2, '0'), cols.num.x + 3, y + 9);

      doc.fillColor(C.text).fontSize(8).font('Helvetica-Bold')
        .text(item.name, cols.name.x, y + 9, { width: cols.name.w });

      doc.fillColor(C.muted).fontSize(8).font('Helvetica-Oblique')
        .text(item.category || (item.itemType === 'package' ? 'Package' : '-'), cols.cat.x, y + 9, { width: cols.cat.w });

      // MRP with strikethrough
      const mrpStr = item.originalPrice.toFixed(2);
  doc.fontSize(8).font('Helvetica');
      const mrpW = doc.widthOfString(mrpStr);
      const mrpX = cols.mrp.x + cols.mrp.w - mrpW - 2;
      doc.fillColor(C.muted).text(mrpStr, mrpX, y + 9);
      if (item.discount > 0) {
        doc.moveTo(mrpX, y + 13).lineTo(mrpX + mrpW, y + 13).lineWidth(0.7).stroke(C.muted);
      }
      doc.fillColor(C.red).fontSize(8).font('Helvetica-Bold')
        .text(item.discount > 0 ? `₹ ${item.discount.toFixed(2)}` : '-',
          cols.disc.x, y + 9, { width: cols.disc.w, align: 'right' });

      doc.fillColor(C.muted).fontSize(8).font('Helvetica')
        .text('1', cols.qty.x, y + 9, { width: cols.qty.w, align: 'center' });

      doc.fillColor(C.text).fontSize(8).font('Helvetica-Bold')
        .text(item.discountedPrice.toFixed(2), cols.final.x, y + 9, { width: cols.final.w, align: 'right' });

      y += ROW_H;
    });

    doc.moveTo(ML, y).lineTo(PW - MR, y).lineWidth(0.5).stroke(C.border);
    return y + 12;
  }

  private summaryAndPayment(doc: PDFKit.PDFDocument, data: InvoiceData, y: number): void {
    const spaceNeeded = 220;
    if (y + spaceNeeded > PH - FOOTER_H) {
      doc.addPage({ margin: 0, size: 'A4' });
      y = ML;
    }

    // Payment info box left
    const boxW = CW * 0.46;
    const payRows: [string, string][] = [
      ['Transaction ID:', data.razorpayPaymentId || '-'],
      ['Razorpay Order ID:', data.razorpayOrderId || '-'],
      ['Razorpay Payment ID:', data.razorpayPaymentId || '-'],
      ['Method:', data.paymentMethod || 'Online'],
    ];
    const boxH = 20 + payRows.length * 14 + 10;

    doc.rect(ML, y, boxW, boxH).fillAndStroke(C.greenBg, C.greenBorder);
    doc.fillColor(C.green).fontSize(8).font('Helvetica-Bold')
      .text('PAYMENT INFORMATION', ML + 10, y + 10);

    let pyY = y + 24;
    payRows.forEach(([label, value]) => {
      doc.fillColor(C.muted).fontSize(7.5).font('Helvetica').text(label, ML + 10, pyY);
      doc.fillColor(C.text).fontSize(7.5).font('Helvetica-Bold')
        .text(value, ML + 115, pyY, { width: boxW - 120 });
      pyY += 14;
    });

    // Summary right
    const sumX = ML + boxW + 16;
    const sumW = CW - boxW - 16;

    const rows: { label: string; value: string; color?: string }[] = [
      { label: 'Subtotal', value: `₹ ${data.subtotal.toFixed(2)}` },
      { label: 'Discount', value: `- ₹ ${data.testDiscount.toFixed(2)}`, color: C.red },
    ];

    if (data.couponCode && data.couponDiscount > 0) {
      rows.push({ label: `Coupon (${data.couponCode})`, value: `- ₹ ${data.couponDiscount.toFixed(2)}`, color: C.red });
    }
    if (data.collectionCharge > 0) {
      rows.push({ label: 'Collection Charges', value: `₹ ${data.collectionCharge.toFixed(2)}` });
    }

    const cgst = data.gst / 2;
    rows.push({ label: 'CGST (2.5%)', value: `₹ ${cgst.toFixed(2)}` });
    rows.push({ label: 'SGST (2.5%)', value: `₹ ${cgst.toFixed(2)}` });

    if (data.platformFee > 0) {
      rows.push({ label: 'Platform Fee', value: `₹ ${data.platformFee.toFixed(2)}` });
    }

    let sY = y;
    rows.forEach(row => {
      doc.fillColor(C.muted).fontSize(8).font('Helvetica').text(row.label, sumX, sY);
      doc.fillColor(row.color || C.text).fontSize(8).font('Helvetica')
        .text(row.value, sumX, sY, { width: sumW, align: 'right' });
      doc.moveTo(sumX, sY + 13).lineTo(sumX + sumW, sY + 13).lineWidth(0.3).stroke(C.border);
      sY += 16;
    });

    sY += 6;
    doc.moveTo(sumX, sY).lineTo(sumX + sumW, sY).lineWidth(1).stroke(C.border);
    sY += 6;
    doc.fillColor(C.text).fontSize(11).font('Helvetica-Bold').text('TOTAL PAID', sumX, sY);
    doc.fillColor(C.teal).fontSize(14).font('Helvetica-Bold')
      .text(`₹ ${data.finalAmount.toFixed(2)}`, sumX, sY - 2, { width: sumW, align: 'right' });
  }

  private footer(doc: PDFKit.PDFDocument): void {
    const pageCount = doc.bufferedPageRange ? doc.bufferedPageRange().count : 1;
    const range = (doc as any)._pageBuffer ? (doc as any)._pageBuffer.length : 1;
    const total = range || 1;

    // Draw footer only on last page (current page at end)
    const footerY = PH - FOOTER_H;
    doc.moveTo(ML, footerY).lineTo(PW - MR, footerY).lineWidth(0.5).stroke(C.border);

    const halfW = CW / 2 - 8;
    const rX = ML + halfW + 16;

    doc.fillColor(C.muted).fontSize(7).font('Helvetica-Bold').text('TERMS & CONDITIONS', ML, footerY + 8);
    const terms = [
      'This is a computer-generated Tax Invoice and does not require a physical signature.',
      'Reports are usually delivered within 24-48 hours of sample collection.',
      'Prices are inclusive of all taxes unless specified otherwise.',
      'In case of disputes, the jurisdiction shall be limited to Noida, Uttar Pradesh.',
    ];
    let tY = footerY + 18;
    terms.forEach(t => {
      doc.fillColor(C.muted).fontSize(6.5).font('Helvetica').text(`• ${t}`, ML, tY, { width: halfW });
      tY += 11;
    });

    doc.fillColor(C.muted).fontSize(7).font('Helvetica-Bold')
      .text('REGISTERED OFFICE', rX, footerY + 8, { width: halfW, align: 'right' });

    const officeLines = [
      COMPANY.name,
      COMPANY.address1,
      COMPANY.address2,
      `CIN: ${COMPANY.cin}`,
      `PAN: ${COMPANY.pan}`,
    ];
    let oY = footerY + 18;
    officeLines.forEach(line => {
      doc.fillColor(C.muted).fontSize(6.5).font('Helvetica')
        .text(line, rX, oY, { width: halfW, align: 'right' });
      oY += 10;
    });
  }
}

export const invoiceService = new InvoiceService();
