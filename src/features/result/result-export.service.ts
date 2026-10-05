import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import PDFDocument from 'pdfkit';

export interface ReportExportData {
  title: string;
  scope: 'POLLING_UNIT' | 'WARD' | 'LGA' | 'STATE';
  officeName: string;
  electoralScope: string;
  generatedAt: Date;
  summary: {
    totalRegisteredVoters?: number | null;
    totalAccreditedVoters?: number | null;
    totalValidVotes: number;
    rejectedVotes: number;
    totalVotesCast: number;
    reportingUnitsCount?: number;
    totalUnitsCount?: number;
    turnoutPercentage?: string | number;
  };
  breakdown: Array<{
    partyCode: string;
    partyName: string;
    candidateName?: string;
    votes: number;
    percentage: string | number;
  }>;
  subUnits?: Array<{
    name: string;
    code?: string;
    totalValidVotes: number;
    rejectedVotes: number;
    leadingParty?: string;
    status?: string;
  }>;
}

@Injectable()
export class ResultExportService {
  private readonly logger = new Logger(ResultExportService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Generates a branded, high-quality PDF stream buffer.
   * Color Palette: Green (#008751), White (#FFFFFF), Black/Charcoal (#111827, #374151).
   */
  async generatePdfReport(data: ReportExportData): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const appName =
          this.configService.get<string>('app.name') ||
          process.env.APP_NAME ||
          'Election Eye';
        const appAddress =
          this.configService.get<string>('app.address') ||
          process.env.APP_ADDRESS ||
          'Lagos State, Nigeria';
        const appPhone =
          this.configService.get<string>('app.phone') ||
          process.env.APP_PHONE ||
          '+234 000 000 0000';

        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          info: {
            Title: `${data.title} - ${appName}`,
            Author: appName,
            Subject: 'Electoral Results Official Report',
          },
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        const PRIMARY_GREEN = '#008751';
        const DARK_GREEN = '#0A4D2E';
        const LIGHT_GREEN_BG = '#F0FDF4';
        const CHARCOAL_BLACK = '#111827';
        const TEXT_MUTED = '#4B5563';
        const BORDER_COLOR = '#E5E7EB';

        // --- Header Banner ---
        const logoPath = path.join(process.cwd(), 'app_logo.png');
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 40, 38, { width: 44, height: 44 });
        }

        doc
          .font('Helvetica-Bold')
          .fontSize(16)
          .fillColor(PRIMARY_GREEN)
          .text(appName.toUpperCase(), 92, 38);

        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(TEXT_MUTED)
          .text('Official Certified Election Intelligence Report', 92, 56);

        // Top right generation date
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(TEXT_MUTED)
          .text(
            `Generated: ${new Date(data.generatedAt).toLocaleString('en-GB')}`,
            350,
            42,
            { align: 'right', width: 205 },
          );

        // Horizontal divider
        doc
          .strokeColor(PRIMARY_GREEN)
          .lineWidth(2)
          .moveTo(40, 88)
          .lineTo(555, 88)
          .stroke();

        // --- Report Title & Context Section ---
        let currentY = 100;
        doc
          .font('Helvetica-Bold')
          .fontSize(14)
          .fillColor(CHARCOAL_BLACK)
          .text(data.title, 40, currentY);

        currentY += 18;
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(TEXT_MUTED)
          .text(
            `Electoral Office: ${data.officeName}  |  Jurisdiction / Location: ${data.electoralScope}`,
            40,
            currentY,
          );

        // --- Key Metric Badges (Cards) ---
        currentY += 20;
        const cardWidth = 110;
        const cardHeight = 46;
        const cardGap = 12;

        const metrics = [
          {
            label: 'TOTAL VOTES CAST',
            value: (data.summary.totalVotesCast || 0).toLocaleString(),
          },
          {
            label: 'VALID VOTES',
            value: (data.summary.totalValidVotes || 0).toLocaleString(),
          },
          {
            label: 'REJECTED VOTES',
            value: (data.summary.rejectedVotes || 0).toLocaleString(),
          },
          {
            label: 'ACCREDITED',
            value:
              data.summary.totalAccreditedVoters != null
                ? data.summary.totalAccreditedVoters.toLocaleString()
                : 'N/A',
          },
        ];

        metrics.forEach((metric, index) => {
          const cardX = 40 + index * (cardWidth + cardGap);
          // Card background
          doc
            .roundedRect(cardX, currentY, cardWidth, cardHeight, 4)
            .fillAndStroke(LIGHT_GREEN_BG, BORDER_COLOR);

          doc
            .font('Helvetica-Bold')
            .fontSize(7)
            .fillColor(DARK_GREEN)
            .text(metric.label, cardX + 6, currentY + 7, {
              width: cardWidth - 12,
            });

          doc
            .font('Helvetica-Bold')
            .fontSize(13)
            .fillColor(CHARCOAL_BLACK)
            .text(metric.value, cardX + 6, currentY + 22, {
              width: cardWidth - 12,
            });
        });

        // --- Party Results Table ---
        currentY += cardHeight + 20;

        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor(CHARCOAL_BLACK)
          .text('POLITICAL PARTY PERFORMANCE BREAKDOWN', 40, currentY);

        currentY += 16;

        // Table Header
        const tableX = 40;
        const tableWidth = 515;
        const headerHeight = 22;

        doc
          .rect(tableX, currentY, tableWidth, headerHeight)
          .fill(PRIMARY_GREEN);

        doc
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .fillColor('#FFFFFF')
          .text('PARTY CODE', tableX + 8, currentY + 6, { width: 80 })
          .text('PARTY NAME', tableX + 95, currentY + 6, { width: 170 })
          .text('CANDIDATE', tableX + 270, currentY + 6, { width: 110 })
          .text('VOTES', tableX + 385, currentY + 6, {
            width: 60,
            align: 'right',
          })
          .text('SHARE (%)', tableX + 450, currentY + 6, {
            width: 55,
            align: 'right',
          });

        currentY += headerHeight;

        // Table Rows
        const sortedBreakdown = [...(data.breakdown || [])].sort(
          (a, b) => b.votes - a.votes,
        );

        const rowHeight = 20;
        sortedBreakdown.forEach((row, idx) => {
          const isEven = idx % 2 === 0;
          if (isEven) {
            doc
              .rect(tableX, currentY, tableWidth, rowHeight)
              .fill('#F9FAFB');
          }

          doc
            .font('Helvetica-Bold')
            .fontSize(8.5)
            .fillColor(CHARCOAL_BLACK)
            .text(row.partyCode || 'N/A', tableX + 8, currentY + 5, {
              width: 80,
            });

          doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor(TEXT_MUTED)
            .text(row.partyName || 'N/A', tableX + 95, currentY + 5, {
              width: 170,
            });

          doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor(TEXT_MUTED)
            .text(row.candidateName || '-', tableX + 270, currentY + 5, {
              width: 110,
            });

          doc
            .font('Helvetica-Bold')
            .fontSize(8.5)
            .fillColor(CHARCOAL_BLACK)
            .text((row.votes || 0).toLocaleString(), tableX + 385, currentY + 5, {
              width: 60,
              align: 'right',
            });

          const pct =
            typeof row.percentage === 'number'
              ? `${row.percentage.toFixed(2)}%`
              : `${row.percentage}%`;

          doc
            .font('Helvetica-Bold')
            .fontSize(8.5)
            .fillColor(PRIMARY_GREEN)
            .text(pct, tableX + 450, currentY + 5, {
              width: 55,
              align: 'right',
            });

          // Row bottom border
          doc
            .strokeColor(BORDER_COLOR)
            .lineWidth(0.5)
            .moveTo(tableX, currentY + rowHeight)
            .lineTo(tableX + tableWidth, currentY + rowHeight)
            .stroke();

          currentY += rowHeight;
        });

        // --- Sub-Units Table (If available, e.g. Wards in LGA or PUs in Ward) ---
        if (data.subUnits && data.subUnits.length > 0) {
          currentY += 16;

          // Check for page overflow
          if (currentY + 120 > 750) {
            doc.addPage();
            currentY = 40;
          }

          doc
            .font('Helvetica-Bold')
            .fontSize(11)
            .fillColor(CHARCOAL_BLACK)
            .text('GEOGRAPHICAL SUB-UNITS SUMMARY', 40, currentY);

          currentY += 16;

          doc
            .rect(tableX, currentY, tableWidth, headerHeight)
            .fill(DARK_GREEN);

          doc
            .font('Helvetica-Bold')
            .fontSize(8.5)
            .fillColor('#FFFFFF')
            .text('SUB-UNIT NAME', tableX + 8, currentY + 6, { width: 190 })
            .text('VALID VOTES', tableX + 205, currentY + 6, {
              width: 90,
              align: 'right',
            })
            .text('REJECTED', tableX + 300, currentY + 6, {
              width: 70,
              align: 'right',
            })
            .text('LEADING PARTY', tableX + 380, currentY + 6, { width: 70 })
            .text('AUDIT STATUS', tableX + 455, currentY + 6, { width: 50 });

          currentY += headerHeight;

          data.subUnits.slice(0, 15).forEach((unit, idx) => {
            if (currentY + rowHeight > 750) {
              doc.addPage();
              currentY = 40;
            }

            const isEven = idx % 2 === 0;
            if (isEven) {
              doc
                .rect(tableX, currentY, tableWidth, rowHeight)
                .fill('#F9FAFB');
            }

            doc
              .font('Helvetica-Bold')
              .fontSize(8)
              .fillColor(CHARCOAL_BLACK)
              .text(unit.name || 'Unit', tableX + 8, currentY + 5, {
                width: 190,
              });

            doc
              .font('Helvetica')
              .fontSize(8)
              .fillColor(TEXT_MUTED)
              .text((unit.totalValidVotes || 0).toLocaleString(), tableX + 205, currentY + 5, {
                width: 90,
                align: 'right',
              });

            doc
              .font('Helvetica')
              .fontSize(8)
              .fillColor(TEXT_MUTED)
              .text((unit.rejectedVotes || 0).toLocaleString(), tableX + 300, currentY + 5, {
                width: 70,
                align: 'right',
              });

            doc
              .font('Helvetica-Bold')
              .fontSize(8)
              .fillColor(PRIMARY_GREEN)
              .text(unit.leadingParty || '-', tableX + 380, currentY + 5, {
                width: 70,
              });

            doc
              .font('Helvetica')
              .fontSize(8)
              .fillColor(unit.status === 'FLAGGED' ? '#DC2626' : TEXT_MUTED)
              .text(unit.status || 'VERIFIED', tableX + 455, currentY + 5, {
                width: 50,
              });

            doc
              .strokeColor(BORDER_COLOR)
              .lineWidth(0.5)
              .moveTo(tableX, currentY + rowHeight)
              .lineTo(tableX + tableWidth, currentY + rowHeight)
              .stroke();

            currentY += rowHeight;
          });
        }

        // --- Footer ---
        const footerY = 780;
        doc
          .strokeColor(BORDER_COLOR)
          .lineWidth(1)
          .moveTo(40, footerY)
          .lineTo(555, footerY)
          .stroke();

        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor(TEXT_MUTED)
          .text(
            `${appName} | Address: ${appAddress} | Support: ${appPhone}`,
            40,
            footerY + 6,
            { align: 'center', width: 515 },
          );

        doc.end();
      } catch (error) {
        this.logger.error('Error generating PDF report:', error);
        reject(error);
      }
    });
  }

  /**
   * Generates an RFC-4180 standard CSV string buffer with UTF-8 BOM.
   */
  generateCsvReport(data: ReportExportData): Buffer {
    const lines: string[] = [];

    // Header metadata
    lines.push(`"ELECTION REPORT: ${data.title}"`);
    lines.push(`"Electoral Office","${data.officeName}"`);
    lines.push(`"Jurisdiction","${data.electoralScope}"`);
    lines.push(`"Generated At","${new Date(data.generatedAt).toISOString()}"`);
    lines.push('');

    // Summary Section
    lines.push('"SUMMARY METRICS"');
    lines.push('"Metric","Value"');
    lines.push(`"Total Valid Votes",${data.summary.totalValidVotes || 0}`);
    lines.push(`"Rejected Votes",${data.summary.rejectedVotes || 0}`);
    lines.push(`"Total Votes Cast",${data.summary.totalVotesCast || 0}`);
    lines.push(
      `"Accredited Voters",${data.summary.totalAccreditedVoters ?? 'N/A'}`,
    );
    lines.push(
      `"Registered Voters",${data.summary.totalRegisteredVoters ?? 'N/A'}`,
    );
    lines.push('');

    // Party Breakdown Section
    lines.push('"POLITICAL PARTY BREAKDOWN"');
    lines.push('"Party Code","Party Name","Candidate","Votes","Share (%)"');

    const sortedBreakdown = [...(data.breakdown || [])].sort(
      (a, b) => b.votes - a.votes,
    );
    for (const row of sortedBreakdown) {
      const partyCode = `"${(row.partyCode || '').replace(/"/g, '""')}"`;
      const partyName = `"${(row.partyName || '').replace(/"/g, '""')}"`;
      const candidate = `"${(row.candidateName || '').replace(/"/g, '""')}"`;
      const votes = row.votes || 0;
      const percentage =
        typeof row.percentage === 'number'
          ? row.percentage.toFixed(2)
          : row.percentage;
      lines.push(`${partyCode},${partyName},${candidate},${votes},${percentage}`);
    }

    // Sub-units Section (if present)
    if (data.subUnits && data.subUnits.length > 0) {
      lines.push('');
      lines.push('"GEOGRAPHICAL SUB-UNITS"');
      lines.push('"Sub-Unit Name","Valid Votes","Rejected Votes","Leading Party","Status"');
      for (const unit of data.subUnits) {
        const unitName = `"${(unit.name || '').replace(/"/g, '""')}"`;
        const valid = unit.totalValidVotes || 0;
        const rejected = unit.rejectedVotes || 0;
        const leading = `"${(unit.leadingParty || '').replace(/"/g, '""')}"`;
        const status = `"${(unit.status || '').replace(/"/g, '""')}"`;
        lines.push(`${unitName},${valid},${rejected},${leading},${status}`);
      }
    }

    // UTF-8 BOM + CRLF joined lines
    const csvContent = '\ufeff' + lines.join('\r\n');
    return Buffer.from(csvContent, 'utf-8');
  }
}
