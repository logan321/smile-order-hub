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

  // Header - Business name
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(config.businessName || 'Relatório de Serviços', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Business info
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

  // Line separator
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, pageWidth - 14, y);
  y += 10;

  // Client info
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

  // Orders table - build rows with service details
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
      // legacy order
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

  // Payment info section
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

  // Extra notes
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

  // Save
  const safeName = client.name.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`relatorio_${safeName}.pdf`);
}

/** Generate a single order preview PDF with layout images and technical sheet */
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
  let y = 18;

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(config.businessName || 'Pedido', pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const info: string[] = [];
  if (config.ownerName) info.push(config.ownerName);
  if (config.phone) info.push(`Tel: ${config.phone}`);
  if (config.email) info.push(config.email);
  if (info.length > 0) {
    doc.text(info.join('  •  '), pageWidth / 2, y, { align: 'center' });
    y += 7;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, pageWidth - 14, y);
  y += 8;

  // Order info
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Pedido: ${order.trackingId}`, 14, y);
  doc.text(`Status: ${statusLabel}`, pageWidth - 14, y, { align: 'right' });
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Cliente: ${client?.name ?? 'N/A'}`, 14, y);
  doc.text(`Data: ${format(new Date(order.date), "dd/MM/yyyy", { locale: ptBR })}`, pageWidth - 14, y, { align: 'right' });
  y += 5;
  doc.text(`Tipo: ${order.orderType === 'confeccao' ? 'Confecção' : 'Designer'}`, 14, y);
  y += 8;

  // Layout images
  if (files.length > 0) {
    doc.setDrawColor(200, 200, 200);
    doc.line(14, y, pageWidth - 14, y);
    y += 6;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Layouts', 14, y);
    y += 6;

    for (const file of files) {
      try {
        const response = await fetch(file.fileUrl);
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        const imgProps = doc.getImageProperties(dataUrl);
        const maxWidth = pageWidth - 28;
        const maxHeight = 80;
        const ratio = Math.min(maxWidth / imgProps.width, maxHeight / imgProps.height);
        const imgW = imgProps.width * ratio;
        const imgH = imgProps.height * ratio;

        if (y + imgH + 10 > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          y = 20;
        }

        doc.addImage(dataUrl, 'JPEG', 14, y, imgW, imgH);
        y += imgH + 3;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.text(file.fileName, 14, y);
        y += 6;
      } catch {
        doc.setFontSize(8);
        doc.text(`[Imagem: ${file.fileName}]`, 14, y);
        y += 6;
      }
    }
  }

  // Custom fields (Ficha Técnica)
  if (customValues.length > 0) {
    if (y + 20 > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
    doc.setDrawColor(200, 200, 200);
    doc.line(14, y, pageWidth - 14, y);
    y += 6;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Ficha Técnica', 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [['Campo', 'Valor']],
      body: customValues.map(cv => [cv.fieldName, cv.value]),
      theme: 'striped',
      headStyles: { fillColor: [34, 51, 84], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Order items (Designer type)
  const total = getOrderTotal(order);
  if (order.items.length > 0) {
    if (y + 20 > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
    doc.setDrawColor(200, 200, 200);
    doc.line(14, y, pageWidth - 14, y);
    y += 6;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Itens do Pedido', 14, y);
    y += 2;

    const itemRows = order.items.map((item, i) => {
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
      head: [['#', 'Serviço', 'Qtd', 'Unit.', 'Total']],
      body: itemRows,
      foot: [['', '', '', 'TOTAL', `R$ ${total.toFixed(2)}`]],
      theme: 'striped',
      headStyles: { fillColor: [34, 51, 84], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [240, 240, 240], textColor: [34, 51, 84], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 4 },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Payment status
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Pagamento: ${order.paid ? 'PAGO' : 'PENDENTE'}`, 14, y);

  // Save
  doc.save(`pedido_${order.trackingId}.pdf`);
}
