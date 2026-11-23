import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SchoolProfile } from '../types';
import { formatIndonesianDate, getTodayWibDate } from './time';

export interface ReportTableConfig {
  title: string;
  subtitle?: string;
  school: SchoolProfile;
  columns: string[];
  rows: (string | number)[][];
  fileName: string;
  orientation?: 'portrait' | 'landscape';
}

export function exportReportToPdf(config: ReportTableConfig) {
  const doc = new jsPDF({
    orientation: config.orientation || 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Official SMKN 6 Muaro Jambi Letterhead (Kop Surat)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('PEMERINTAH PROVINSI JAMBI — DINAS PENDIDIKAN', pageWidth / 2, 13, { align: 'center' });

  doc.setFontSize(15);
  doc.text(config.school.schoolName || 'SMK NEGERI 6 MUARO JAMBI', pageWidth / 2, 20, {
    align: 'center'
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `${config.school.address || 'Kabupaten Muaro Jambi, Provinsi Jambi'} | ${config.school.contact || ''}`,
    pageWidth / 2,
    25.5,
    { align: 'center' }
  );

  doc.setLineWidth(0.8);
  doc.line(14, 29, pageWidth - 14, 29);
  doc.setLineWidth(0.25);
  doc.line(14, 30.2, pageWidth - 14, 30.2);

  // Report Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(config.title.toUpperCase(), pageWidth / 2, 37, { align: 'center' });

  if (config.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(config.subtitle, pageWidth / 2, 42.5, { align: 'center' });
  }

  autoTable(doc, {
    startY: config.subtitle ? 47 : 42,
    head: [config.columns],
    body: config.rows.map((r) => r.map((c) => String(c ?? '-'))),
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      valign: 'middle'
    },
    headStyles: {
      fillColor: [15, 37, 68],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  // Footer Signature Block
  const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 120;
  const pageHeight = doc.internal.pageSize.getHeight();
  let signY = finalY + 12;
  if (signY + 30 > pageHeight) {
    doc.addPage();
    signY = 25;
  }

  const signX = pageWidth - 78;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Muaro Jambi, ${formatIndonesianDate(getTodayWibDate())}`, signX, signY);
  doc.text('Kepala Sekolah,', signX, signY + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(config.school.principalName || 'Kepala SMK Negeri 6 Muaro Jambi', signX, signY + 23);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${config.school.principalNip || '-'}`, signX, signY + 28);

  doc.save(config.fileName.endsWith('.pdf') ? config.fileName : `${config.fileName}.pdf`);
}
