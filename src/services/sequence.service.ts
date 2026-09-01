import { prisma } from '../lib/prisma';

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function datePart(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1, 2);
  const d = pad(now.getDate(), 2);
  return `${y}${m}${d}`;
}

export class SequenceService {
  async nextInvoiceNumber(): Promise<string> {
    const updated = await prisma.invoiceSequence.upsert({
      where: { id: 'singleton' },
      update: { lastInvoiceSeq: { increment: 1 } },
      create: { id: 'singleton', lastInvoiceSeq: 1, lastReceiptSeq: 0 },
    });
    return `INV-${datePart()}-${pad(updated.lastInvoiceSeq, 6)}`;
  }

  async nextReceiptNumber(): Promise<string> {  
    const updated = await prisma.invoiceSequence.upsert({
      where: { id: 'singleton' },
      update: { lastReceiptSeq: { increment: 1 } },
      create: { id: 'singleton', lastInvoiceSeq: 0, lastReceiptSeq: 1 },
    });
    return `RCPT-${datePart()}-${pad(updated.lastReceiptSeq, 6)}`;
  }
}

export const sequenceService = new SequenceService();