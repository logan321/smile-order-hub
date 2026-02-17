import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Service } from '@/types';
import { BusinessConfig } from '@/lib/businessConfig';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface BudgetPDFData {
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  notes: string;
  items: { serviceId: string; quantity: number; unitPrice: number }[];
  createdAt: string;
}

export function generateBudgetPDF(
  budget: BudgetPDFData,
  services: Service[],
  config: BusinessConfig
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 20;

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(config.businessName || 'Orçamento', pageWidth / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const businessLines: string[] = [];
  if (config.ownerName) businessLines.push(config.ownerName);
  if (config.document) businessLines.push(`CPF/CNPJ: ${config.document}`);
  if (config.phone) businessLines.push(`Tel: ${config.phone}`);
  if (config.email) businessLines.push(config.email);
  if (businessLines.length > 0) {
    doc.text(businessLines.join('  •  '), pageWidth / 2, y, { align: 'center' });
    y += 8;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ORÇAMENTO', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Client info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (budget.clientName) { doc.text(`Cliente: ${budget.clientName}`, margin, y); y += 5; }
  if (budget.clientPhone) { doc.text(`Telefone: ${budget.clientPhone}`, margin, y); y += 5; }
  if (budget.clientEmail) { doc.text(`E-mail: ${budget.clientEmail}`, margin, y); y += 5; }
  doc.text(`Data: ${format(new Date(budget.createdAt), "dd/MM/yyyy", { locale: ptBR })}`, margin, y);
  y += 10;

  // Items table
  const total = budget.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const tableData = budget.items.map((item, i) => {
    const svc = services.find(s => s.id === item.serviceId);
    return [
      (i + 1).toString(),
      svc?.name ?? 'Serviço removido',
      item.quantity.toString(),
      `R$ ${item.unitPrice.toFixed(2)}`,
      `R$ ${(item.unitPrice * item.quantity).toFixed(2)}`,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'Serviço', 'Qtd', 'Valor Unit.', 'Subtotal']],
    body: tableData,
    foot: [['', '', '', 'TOTAL', `R$ ${total.toFixed(2)}`]],
    theme: 'striped',
    headStyles: { fillColor: [34, 51, 84], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [240, 240, 240], textColor: [34, 51, 84], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 15;

  // Notes
  if (budget.notes) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Observações:', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const noteLines = doc.splitTextToSize(budget.notes, pageWidth - margin * 2);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 5 + 5;
  }

  // Payment info
  const hasPaymentInfo = config.paymentMethods || config.pixKey || config.bankInfo;
  if (hasPaymentInfo) {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Dados para Pagamento', margin, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (config.paymentMethods) { doc.text(`Formas de pagamento: ${config.paymentMethods}`, margin, y); y += 5; }
    if (config.pixKey) { doc.text(`Chave PIX: ${config.pixKey}`, margin, y); y += 5; }
    if (config.bankInfo) {
      const bankLines = doc.splitTextToSize(`Dados bancários: ${config.bankInfo}`, pageWidth - margin * 2);
      doc.text(bankLines, margin, y);
    }
  }

  const safeName = budget.clientName.replace(/[^a-zA-Z0-9]/g, '_') || 'orcamento';
  doc.save(`orcamento_${safeName}.pdf`);
}
