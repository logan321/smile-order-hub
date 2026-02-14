import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Client, Order, Service, OrderFile, OrderCustomValue } from '@/types';
import { BusinessConfig } from '@/lib/businessConfig';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getOrderTotal } from '@/context/AppContext';

export function generateClientReportPDF(
  client: Client,
  orders: Order[],
  total: number,
  config: BusinessConfig,
  services: Service[] = []
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(config.businessName || 'Relatório de Serviços', pageWidth / 2, y, { align: 'center' });
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
  doc.line(14, y, pageWidth - 14, y);
  y += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório do Cliente', 14, y);
  y += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nome: ${client.name}`, 14, y); y += 5;
  if (client.email) { doc.text(`E-mail: ${client.email}`, 14, y); y += 5; }
  if (client.phone) { doc.text(`Telefone: ${client.phone}`, 14, y); y += 5; }
  doc.text(`Data do relatório: ${format(new Date(), "dd/MM/yyyy", { locale: ptBR })}`, 14, y);
  y += 10;

  const tableData: string[][] = [];
  let rowNum = 1;
  orders.forEach((order) => {
    if (order.items && order.items.length > 0) {
      order.items.forEach(item => {
        const svc = services.find(s => s.id === item.serviceId);
        const name = svc?.name ?? 'Serviço removido';
        tableData.push([
          rowNum.toString(),
          name,
          format(new Date(order.date), "dd/MM/yyyy", { locale: ptBR }),
          item.quantity.toString(),
          `R$ ${item.unitPrice.toFixed(2)}`,
          `R$ ${(item.unitPrice * item.quantity).toFixed(2)}`
        ]);
        rowNum++;
      });
    } else {
      tableData.push([
        rowNum.toString(),
        (order as any).service ?? '',
        format(new Date(order.date), "dd/MM/yyyy", { locale: ptBR }),
        '1',
        `R$ ${((order as any).price ?? 0).toFixed(2)}`,
        `R$ ${((order as any).price ?? 0).toFixed(2)}`
      ]);
      rowNum++;
    }
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'Serviço', 'Data', 'Qtd', 'Unit.', 'Total']],
    body: tableData,
    foot: [['', '', '', '', 'TOTAL', `R$ ${total.toFixed(2)}`]],
    theme: 'striped',
    headStyles: { fillColor: [34, 51, 84], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [240, 240, 240], textColor: [34, 51, 84], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 15;

  const hasPaymentInfo = config.paymentMethods || config.pixKey || config.bankInfo;

  if (hasPaymentInfo) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Dados para Pagamento', 14, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    if (config.paymentMethods) {
      doc.text(`Formas de pagamento: ${config.paymentMethods}`, 14, y);
      y += 5;
    }
    if (config.pixKey) {
      doc.text(`Chave PIX: ${config.pixKey}`, 14, y);
      y += 5;
    }
    if (config.bankInfo) {
      const bankLines = doc.splitTextToSize(`Dados bancários: ${config.bankInfo}`, pageWidth - 28);
      doc.text(bankLines, 14, y);
      y += bankLines.length * 5;
    }
  }

  if (config.extraNotes) {
    y += 5;
    doc.setDrawColor(200, 200, 200);
    doc.line(14, y, pageWidth - 14, y);
    y += 8;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    const noteLines = doc.splitTextToSize(config.extraNotes, pageWidth - 28);
    doc.text(noteLines, 14, y);
  }

  const safeName = client.name.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`relatorio_${safeName}.pdf`);
}

/** Load image as base64 data URL */
async function loadImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Generate a single order preview PDF — everything on ONE page */
export async function generateOrderPreviewPDF(
  order: Order,
  client: Client | undefined,
  services: Service[],
  files: OrderFile[],
  customValues: OrderCustomValue[],
  statusLabel: string,
  config: BusinessConfig
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 14;

  // ─── Header (compact) ───
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(config.businessName || 'Pedido', margin, y);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Pedido: ${order.trackingId}`, pageWidth - margin, y, { align: 'right' });
  y += 5;

  // Sub-header line
  const infoLeft = `Cliente: ${client?.name ?? 'N/A'}  •  ${format(new Date(order.date), "dd/MM/yyyy", { locale: ptBR })}`;
  const infoRight = `Status: ${statusLabel}`;
  doc.setFontSize(8);
  doc.text(infoLeft, margin, y);
  doc.text(infoRight, pageWidth - margin, y, { align: 'right' });
  y += 4;

  if (order.deliveryDate) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Data de Entrega: ${format(new Date(order.deliveryDate), "dd/MM/yyyy", { locale: ptBR })}`, margin, y);
    doc.setFont('helvetica', 'normal');
    y += 4;
  }

  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // ─── Calculate remaining space for images ───
  // Estimate space needed for ficha técnica + items + footer
  const fichaTecnicaHeight = customValues.length > 0 ? 8 + Math.ceil(customValues.length / 2) * 5 + 4 : 0;
  const itemsHeight = order.items.length > 0 ? 8 + order.items.length * 5 + 8 : 0;
  const footerHeight = 12;
  const reservedBottom = fichaTecnicaHeight + itemsHeight + footerHeight + 8;
  const availableForImages = pageHeight - y - reservedBottom - 10;

  // ─── Layout Images (side by side, proportional) ───
  if (files.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Layouts', margin, y);
    y += 4;

    // Load all images
    const loadedImages: { dataUrl: string; w: number; h: number }[] = [];
    for (const file of files) {
      try {
        const dataUrl = await loadImageAsDataUrl(file.fileUrl);
        const props = doc.getImageProperties(dataUrl);
        loadedImages.push({ dataUrl, w: props.width, h: props.height });
      } catch {
        // skip failed images
      }
    }

    if (loadedImages.length > 0) {
      const maxImgHeight = Math.min(availableForImages, 90);
      const gap = 4;

      if (loadedImages.length === 1) {
        const img = loadedImages[0];
        const ratio = Math.min(contentWidth / img.w, maxImgHeight / img.h);
        const imgW = img.w * ratio;
        const imgH = img.h * ratio;
        doc.addImage(img.dataUrl, 'JPEG', margin, y, imgW, imgH);
        y += imgH + 3;
      } else {
        // Side by side: split width equally
        const slotWidth = (contentWidth - gap * (loadedImages.length - 1)) / Math.min(loadedImages.length, 3);
        let rowImages = loadedImages.slice(0, 3); // max 3 per row
        let maxRowH = 0;

        rowImages.forEach((img, i) => {
          const ratio = Math.min(slotWidth / img.w, maxImgHeight / img.h);
          const imgW = img.w * ratio;
          const imgH = img.h * ratio;
          const x = margin + i * (slotWidth + gap);
          doc.addImage(img.dataUrl, 'JPEG', x, y, imgW, imgH);
          if (imgH > maxRowH) maxRowH = imgH;
        });
        y += maxRowH + 3;

        // If more than 3 images, second row
        if (loadedImages.length > 3) {
          const row2 = loadedImages.slice(3, 6);
          let maxRowH2 = 0;
          row2.forEach((img, i) => {
            const ratio = Math.min(slotWidth / img.w, maxImgHeight / img.h);
            const imgW = img.w * ratio;
            const imgH = img.h * ratio;
            const x = margin + i * (slotWidth + gap);
            doc.addImage(img.dataUrl, 'JPEG', x, y, imgW, imgH);
            if (imgH > maxRowH2) maxRowH2 = imgH;
          });
          y += maxRowH2 + 3;
        }
      }
    }

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
  }

  // ─── Ficha Técnica (compact 2-column grid) ───
  if (customValues.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Ficha Técnica', margin, y);
    y += 5;

    doc.setFontSize(8);
    const colWidth = contentWidth / 2;
    customValues.forEach((cv, i) => {
      const col = i % 2;
      const x = margin + col * colWidth;
      if (col === 0 && i > 0) y += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.text(`${cv.fieldName}: `, x, y);
      const labelWidth = doc.getTextWidth(`${cv.fieldName}: `);
      doc.setFont('helvetica', 'bold');
      doc.text(cv.value, x + labelWidth, y);
    });
    if (customValues.length % 2 !== 0) y += 4.5;
    y += 4;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
  }

  // ─── Order Items ───
  const total = getOrderTotal(order);
  if (order.items.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Itens do Pedido', margin, y);
    y += 5;

    doc.setFontSize(8);
    order.items.forEach((item, i) => {
      const svc = services.find(s => s.id === item.serviceId);
      const name = svc?.name ?? 'Serviço removido';
      const qtyText = item.quantity > 1 ? ` (x${item.quantity})` : '';
      doc.setFont('helvetica', 'normal');
      doc.text(`${name}${qtyText}`, margin, y);
      doc.text(`R$ ${(item.unitPrice * item.quantity).toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
      y += 4.5;
    });

    doc.setFont('helvetica', 'bold');
    doc.text('Total:', margin, y);
    doc.text(`R$ ${total.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 6;
  }

  // ─── Payment status ───
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Pagamento: ${order.paid ? 'PAGO' : 'PENDENTE'}`, margin, y);

  doc.save(`pedido_${order.trackingId}.pdf`);
}
