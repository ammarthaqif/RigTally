import express from 'express';
import type { Express, Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { GoogleGenAI, Type } from '@google/genai';
import type {
  ComponentType,
  ComputedTallyResult,
  InspectionReportItem,
  InspectionReportResult,
  LengthUnit,
  TallyConfig,
} from '../src/types/tally.ts';

function inferMimeType(file: Express.Multer.File): string {
  const mime = (file.mimetype || '').toLowerCase();
  const ext = (file.originalname || '').toLowerCase();
  if (mime === 'application/pdf' || ext.endsWith('.pdf')) return 'application/pdf';
  if (mime.startsWith('image/')) return mime;
  if (ext.endsWith('.png')) return 'image/png';
  if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) return 'image/jpeg';
  if (ext.endsWith('.webp')) return 'image/webp';
  if (ext.endsWith('.gif')) return 'image/gif';
  if (ext.endsWith('.heic')) return 'image/heic';
  if (ext.endsWith('.tif') || ext.endsWith('.tiff')) return 'image/tiff';
  return mime || 'application/octet-stream';
}

function normalizeComponentType(raw: unknown): ComponentType {
  const s = String(raw ?? '').toLowerCase();
  if (s.includes('pup')) return 'pup';
  if (s.includes('xo') || s.includes('cross')) return 'xo';
  if (s.includes('shoe')) return 'shoe';
  if (s.includes('collar') || s.includes('float')) return 'collar';
  if (s.includes('hanger') || s.includes('hgr')) return 'hanger';
  if (s.includes('landing') || s.includes('lnd')) return 'landing';
  if (s.includes('bha') || s.includes('packer') || s.includes('sub') || s.includes('stabilizer')) {
    return 'bha';
  }
  return 'joint';
}

function normalizeUnit(raw: unknown): LengthUnit | 'unknown' {
  const s = String(raw ?? '').toLowerCase().trim();
  if (s === 'm' || s === 'meter' || s === 'meters' || s === 'metre' || s === 'metres') return 'm';
  if (s === 'ft' || s === 'foot' || s === 'feet' || s === "'") return 'ft';
  return 'unknown';
}

function normalizeSizeIn(label: string, rawNum: unknown): number | null {
  const n = Number(rawNum);
  if (Number.isFinite(n) && n > 0 && n < 100) return n;
  const cleaned = label.replace(/["'″in]/gi, '').trim();
  const mixed = cleaned.match(/^(\d+)\s*[-\s]\s*(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  }
  const frac = cleaned.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    return Number(frac[1]) / Number(frac[2]);
  }
  const plain = Number(cleaned);
  return Number.isFinite(plain) && plain > 0 && plain < 100 ? plain : null;
}

export function createApiApp(): Express {
  const app = express();

  app.use(express.json({ limit: '15mb' }));

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  const inspectionUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 },
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Extract joint specs & tally lengths from uploaded inspection report snapshot (image) or PDF
  app.post(
    '/api/tally/parse-inspection',
    inspectionUpload.single('file'),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          res.status(400).json({ error: 'No inspection report file uploaded.' });
          return;
        }

        const apiKey = process.env.GEMINI_API_KEY?.trim();
        if (!apiKey) {
          res.status(500).json({
            error:
              'GEMINI_API_KEY is not configured. Add it in environment settings to extract inspection reports.',
          });
          return;
        }

        const mimeType = inferMimeType(req.file);
        const supported =
          mimeType === 'application/pdf' || mimeType.startsWith('image/');
        if (!supported) {
          res.status(400).json({
            error: `Unsupported file type (${mimeType}). Upload a PDF or image snapshot (PNG, JPG, WEBP).`,
          });
          return;
        }

        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const base64Data = req.file.buffer.toString('base64');

        const promptText =
          'Extract every tubular / pipe / pup joint / crossover (XO) / accessory line item from this drilling pipe inspection report or tally sheet. ' +
          'Capture report-level defaults (title, inspector company, length unit, OD size, weight in lb/ft, steel grade, connection) and every individual joint or item row with its exact measured length, top connection, bottom connection, serial/heat number, and pass/reject condition.';

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              { text: promptText },
            ],
          },
          config: {
            systemInstruction:
              'You are a drilling tubular inspection data extractor. Read OCTG / casing / tubing / conductor inspection reports, pipe tally sheets, pup joint certificates, and crossover (XO) logs accurately. ' +
              'Never invent joints not present in the document. If top and bottom connections are listed as one connection (e.g. "VAM TOP"), put it in both topConnection and bottomConnection. If an XO or crossover shows two connections (e.g. "BTC Box x VAM TOP Pin" or "BTC / VAM TOP"), set bottomConnection and topConnection accordingly (or pin/box as labeled). If length unit is meters use "m", if feet use "ft", else "unknown". Set condition to "rejected" if marked Reject/Fail/Damaged/Scrap/No-Go, "repair" if marked Re-thread/Repair, otherwise "accepted". Keep remarks concise.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                reportTitle: { type: Type.STRING },
                inspectorCompany: { type: Type.STRING },
                detectedUnit: { type: Type.STRING },
                detectedSizeLabel: { type: Type.STRING },
                detectedSizeIn: { type: Type.NUMBER },
                detectedWeightLbFt: { type: Type.NUMBER },
                detectedGrade: { type: Type.STRING },
                detectedConnection: { type: Type.STRING },
                notes: { type: Type.STRING },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      jointNo: { type: Type.STRING },
                      componentType: { type: Type.STRING },
                      sizeLabel: { type: Type.STRING },
                      sizeIn: { type: Type.NUMBER },
                      weightLbFt: { type: Type.NUMBER },
                      grade: { type: Type.STRING },
                      topConnection: { type: Type.STRING },
                      bottomConnection: { type: Type.STRING },
                      measuredLength: { type: Type.NUMBER },
                      lengthUnit: { type: Type.STRING },
                      serialNo: { type: Type.STRING },
                      condition: { type: Type.STRING },
                      remarks: { type: Type.STRING },
                    },
                    required: ['jointNo', 'measuredLength'],
                  },
                },
              },
              required: ['items'],
            },
          },
        });

        const rawJson = (response.text ?? '{}').trim();
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(rawJson) as Record<string, unknown>;
        } catch {
          res.status(502).json({
            error: 'Could not parse structured joint data from the inspection report response.',
          });
          return;
        }

        const detectedUnit = normalizeUnit(parsed.detectedUnit);
        const detectedSizeLabel = String(parsed.detectedSizeLabel ?? '').trim();
        const detectedSizeIn = normalizeSizeIn(detectedSizeLabel, parsed.detectedSizeIn);
        const rawWeight = Number(parsed.detectedWeightLbFt);
        const detectedWeightLbFt =
          Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : null;
        const detectedGrade = String(parsed.detectedGrade ?? '').trim();
        const detectedConnection = String(parsed.detectedConnection ?? '').trim();

        const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
        const items: InspectionReportItem[] = rawItems
          .map((itemRaw, idx): InspectionReportItem | null => {
            if (!itemRaw || typeof itemRaw !== 'object') return null;
            const r = itemRaw as Record<string, unknown>;
            const len = Number(r.measuredLength);
            if (!Number.isFinite(len) || len <= 0) return null;

            const jointNo = String(r.jointNo ?? idx + 1).trim() || String(idx + 1);
            const sizeLabel = String(r.sizeLabel ?? '').trim() || detectedSizeLabel;
            const sizeIn = normalizeSizeIn(sizeLabel, r.sizeIn) ?? detectedSizeIn;
            const wt = Number(r.weightLbFt);
            const weightLbFt =
              Number.isFinite(wt) && wt > 0 ? wt : detectedWeightLbFt;
            const grade = String(r.grade ?? '').trim() || detectedGrade;
            const topConn =
              String(r.topConnection ?? '').trim() || detectedConnection;
            const botConn =
              String(r.bottomConnection ?? '').trim() || topConn || detectedConnection;
            const itemUnit = normalizeUnit(r.lengthUnit);
            const condRaw = String(r.condition ?? '').toLowerCase();
            const condition: InspectionReportItem['condition'] = condRaw.includes('reject')
              ? 'rejected'
              : condRaw.includes('repair')
                ? 'repair'
                : 'accepted';
            const remarks = String(r.remarks ?? '').trim();
            const inferredType = normalizeComponentType(
              `${r.componentType ?? ''} ${jointNo} ${remarks}`
            );

            return {
              id: `insp_${Date.now()}_${idx}`,
              jointNo,
              componentType: inferredType,
              sizeLabel,
              sizeIn,
              weightLbFt,
              grade,
              topConnection: topConn,
              bottomConnection: botConn,
              measuredLength: Number(len.toFixed(3)),
              lengthUnit: itemUnit !== 'unknown' ? itemUnit : detectedUnit,
              serialNo: String(r.serialNo ?? '').trim(),
              condition,
              remarks,
            };
          })
          .filter((item): item is InspectionReportItem => item !== null);

        if (items.length === 0) {
          res.status(422).json({
            error:
              'No valid pipe joints with positive lengths were detected in this inspection report. Try cropping closer to the tally table or uploading a clearer PDF/image.',
          });
          return;
        }

        const result: InspectionReportResult = {
          fileName: req.file.originalname || 'inspection-report',
          reportTitle: String(parsed.reportTitle ?? '').trim() || 'Inspection Report',
          inspectorCompany: String(parsed.inspectorCompany ?? '').trim(),
          detectedUnit,
          detectedSizeLabel,
          detectedSizeIn,
          detectedWeightLbFt,
          detectedGrade,
          detectedConnection,
          notes: String(parsed.notes ?? '').trim(),
          items,
        };

        res.json(result);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to extract inspection report.';
        res.status(500).json({ error: message });
      }
    }
  );

  // Parse uploaded Excel (.xlsx, .xls) or CSV file into structured columns & rows
  app.post('/api/tally/parse-excel', upload.single('file'), (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded.' });
        return;
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetNames = workbook.SheetNames;
      if (!sheetNames || sheetNames.length === 0) {
        res.status(400).json({ error: 'The uploaded workbook contains no sheets.' });
        return;
      }

      const requestedSheet = typeof req.body?.sheetName === 'string' ? req.body.sheetName : '';
      const activeSheetName =
        requestedSheet && sheetNames.includes(requestedSheet) ? requestedSheet : sheetNames[0];

      const worksheet = workbook.Sheets[activeSheetName];
      const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(worksheet, {
        header: 1,
        defval: '',
        blankrows: false,
      });

      if (matrix.length === 0) {
        res.status(400).json({ error: 'The selected sheet is empty.' });
        return;
      }

      // Score top 25 rows to locate the true table header row (skips well/rig metadata blocks at top)
      let headerRowIndex = 0;
      let bestScore = 0;
      const headerKeywords = [
        'joint',
        'jt',
        'length',
        'len',
        'measured',
        'gross',
        'weight',
        'ppf',
        'loss',
        'mu',
        'serial',
        'remark',
        'type',
        'grade',
        'od',
        'size',
        'run',
        'cum',
        'depth',
        'conn',
        'thread',
      ];

      for (let i = 0; i < Math.min(25, matrix.length); i++) {
        const row = matrix[i].map((c) => String(c ?? '').trim().toLowerCase());
        const nonEmpty = row.filter((c) => c.length > 0);
        if (nonEmpty.length < 2) continue;

        let score = 0;
        for (const cell of nonEmpty) {
          if (headerKeywords.some((kw) => cell.includes(kw))) {
            score += 1;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          headerRowIndex = i;
        }
      }

      const rawHeaderRow = matrix[headerRowIndex] ?? [];
      const maxCols = matrix.reduce((max, r) => Math.max(max, r.length), rawHeaderRow.length);

      const headers: string[] = [];
      for (let c = 0; c < maxCols; c++) {
        const val = String(rawHeaderRow[c] ?? '').trim();
        headers.push(val || `Column ${c + 1}`);
      }

      // Determine whether headerRowIndex actually looks like headers or is directly numeric data
      const firstRowHasNumericLength = rawHeaderRow.every(
        (cell) => String(cell ?? '').trim() === '' || Number.isFinite(Number(cell))
      );
      const dataStartIdx =
        headerRowIndex === 0 && firstRowHasNumericLength ? 0 : headerRowIndex + 1;

      const rows = matrix
        .slice(dataStartIdx)
        .map((r) => {
          const padded: string[] = [];
          for (let c = 0; c < maxCols; c++) {
            padded.push(String(r[c] ?? '').trim());
          }
          return padded;
        })
        .filter((r) => r.some((cell) => cell.length > 0));

      res.json({
        fileName: req.file.originalname,
        sheetNames,
        activeSheetName,
        headers:
          headerRowIndex === 0 && firstRowHasNumericLength
            ? headers.map((_, idx) => `Column ${idx + 1}`)
            : headers,
        rows,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse Excel file.';
      res.status(500).json({ error: message });
    }
  });

  // Export Running Tally to formatted Excel (.xlsx) with live formulas
  app.post('/api/tally/export/excel', async (req: Request, res: Response) => {
    try {
      const { config, computed } = req.body as {
        config: TallyConfig;
        computed: ComputedTallyResult;
      };

      if (!config || !computed || !Array.isArray(computed.rows)) {
        res.status(400).json({ error: 'Invalid tally payload.' });
        return;
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'RigTally';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Running Tally', {
        views: [{ state: 'frozen', ySplit: 9 }],
      });

      // Title Banner
      sheet.mergeCells('A1:P1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = `PIPE RUNNING TALLY — ${config.stringName || config.stringCategory.toUpperCase()}`;
      titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      sheet.getRow(1).height = 28;

      // Metadata grid (Rows 2-6)
      const targetShoeDepth =
        config.sectionTd > 0
          ? Math.max(0, config.sectionTd - (config.shoeOffTd || 0))
          : config.targetDepth;
      const hangerText = config.hasHanger
        ? `Hanger @ ${config.hangerDepth} ${config.lengthUnit} · Stick-up ${computed.summary.actualStickupAboveRigFloor.toFixed(2)} ${config.lengthUnit}`
        : 'No Hanger';
      const defaultTopConn = config.topConnection || config.connection || '-';
      const defaultBotConn = config.bottomConnection || config.connection || '-';

      const metaPairs: Array<[string, string, string, string]> = [
        ['Well Name:', config.wellName || '-', 'String Category:', config.stringCategory.toUpperCase()],
        ['Rig / Unit:', config.rigName || '-', 'Pipe OD / Weight:', `${config.pipeSizeLabel}" · ${config.weightLbFt} lb/ft (${config.grade || 'API'})`],
        ['Field / Block:', config.fieldBlock || '-', 'Conn (Top / Btm):', `${defaultTopConn} / ${defaultBotConn} · MU ${config.defaultMakeUpLoss} ${config.makeUpLossUnit}`],
        ['Engineer:', config.engineerName || '-', 'Hanger / Landing:', hangerText],
        ['Section TD / Shoe:', `TD ${config.sectionTd || targetShoeDepth} ${config.lengthUnit} (Off ${config.shoeOffTd || 0} → Shoe ${targetShoeDepth} ${config.lengthUnit})`, 'Mud Weight:', `${config.mudWeightPpg} ppg (BF ${computed.summary.buoyancyFactor.toFixed(4)})`],
      ];

      metaPairs.forEach((pair, idx) => {
        const rowNum = idx + 2;
        const row = sheet.getRow(rowNum);
        row.height = 18;
        sheet.getCell(`A${rowNum}`).value = pair[0];
        sheet.getCell(`A${rowNum}`).font = { bold: true, size: 10, color: { argb: 'FF475569' } };
        sheet.mergeCells(`B${rowNum}:E${rowNum}`);
        sheet.getCell(`B${rowNum}`).value = pair[1];
        sheet.getCell(`B${rowNum}`).font = { size: 10, color: { argb: 'FF0F172A' } };

        sheet.mergeCells(`F${rowNum}:G${rowNum}`);
        sheet.getCell(`F${rowNum}`).value = pair[2];
        sheet.getCell(`F${rowNum}`).font = { bold: true, size: 10, color: { argb: 'FF475569' } };
        sheet.mergeCells(`H${rowNum}:P${rowNum}`);
        sheet.getCell(`H${rowNum}`).value = pair[3];
        sheet.getCell(`H${rowNum}`).font = { size: 10, color: { argb: 'FF0F172A' } };
      });

      sheet.getRow(7).height = 8;

      // Table Headers (Row 9)
      const unit = config.lengthUnit;
      const headers = [
        'Run #',
        'Joint / Tag',
        'Layer',
        'Type',
        'Top Conn',
        'Bot Conn',
        `Measured (${unit})`,
        `MU Loss (${unit})`,
        `Net Len (${unit})`,
        `Cum Len (${unit})`,
        `Top MD (${unit})`,
        `Bot MD (${unit})`,
        'Wt (lb/ft)',
        'Seg Wt (lbs)',
        'Cum Wt (lbs)',
        'Status / Remarks',
      ];

      const headerRow = sheet.getRow(9);
      headerRow.height = 24;
      headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.alignment = {
          vertical: 'middle',
          horizontal: i >= 6 && i <= 14 ? 'right' : i === 2 ? 'center' : 'left',
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
      });

      const startRow = 10;
      const isMeters = unit === 'm';

      computed.rows.forEach((r, idx) => {
        const excelRowNum = startRow + idx;
        const row = sheet.getRow(excelRowNum);
        row.height = 19;
        const isDiscarded = Boolean(r.discarded);

        row.getCell(1).value = isDiscarded ? 'REJ' : r.runSeq ?? r.seq;
        row.getCell(2).value = r.jointNo;
        row.getCell(3).value = r.layer ?? '';
        row.getCell(4).value = r.componentType.toUpperCase();
        row.getCell(5).value = r.effectiveTopConnection || defaultTopConn;
        row.getCell(6).value = r.effectiveBottomConnection || defaultBotConn;
        row.getCell(7).value = isDiscarded ? 0 : Number(r.measuredLength.toFixed(3));
        row.getCell(8).value = isDiscarded ? 0 : Number(r.effectiveMakeUpLoss.toFixed(4));
        row.getCell(9).value = isDiscarded
          ? 0
          : {
              formula: `MAX(0,G${excelRowNum}-H${excelRowNum})`,
              result: Number(r.effectiveLength.toFixed(3)),
            };
        row.getCell(10).value = isDiscarded
          ? Number(r.cumLength.toFixed(3))
          : idx === 0
            ? { formula: `I${excelRowNum}`, result: Number(r.cumLength.toFixed(3)) }
            : {
                formula: `J${excelRowNum - 1}+I${excelRowNum}`,
                result: Number(r.cumLength.toFixed(3)),
              };
        row.getCell(11).value = isDiscarded ? '' : Number(r.topDepth.toFixed(2));
        row.getCell(12).value = isDiscarded ? '' : Number(r.bottomDepth.toFixed(2));
        row.getCell(13).value = Number(r.unitWeightLbFt.toFixed(2));
        row.getCell(14).value = isDiscarded
          ? 0
          : {
              formula: isMeters
                ? `I${excelRowNum}*3.280839895*M${excelRowNum}`
                : `I${excelRowNum}*M${excelRowNum}`,
              result: Number(r.segmentAirWeightLbs.toFixed(1)),
            };
        row.getCell(15).value = isDiscarded
          ? Number(r.cumAirWeightLbs.toFixed(1))
          : idx === 0
            ? { formula: `N${excelRowNum}`, result: Number(r.cumAirWeightLbs.toFixed(1)) }
            : {
                formula: `O${excelRowNum - 1}+N${excelRowNum}`,
                result: Number(r.cumAirWeightLbs.toFixed(1)),
              };
        const statusPrefix = isDiscarded ? '[REJECTED] ' : '';
        row.getCell(16).value =
          statusPrefix + [r.serialNo, r.discardReason, r.remarks].filter(Boolean).join(' — ');

        row.getCell(7).numFmt = '0.00';
        row.getCell(8).numFmt = '0.000';
        row.getCell(9).numFmt = '0.00';
        row.getCell(10).numFmt = '0.00';
        row.getCell(11).numFmt = '0.00';
        row.getCell(12).numFmt = '0.00';
        row.getCell(13).numFmt = '0.00';
        row.getCell(14).numFmt = '#,##0.0';
        row.getCell(15).numFmt = '#,##0.0';

        for (let c = 1; c <= 16; c++) {
          const cell = row.getCell(c);
          cell.font = {
            size: 10,
            color: { argb: isDiscarded ? 'FFB91C1C' : 'FF0F172A' },
            strike: isDiscarded && c === 2,
          };
          if (c >= 7 && c <= 15) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          } else if (c === 3) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          }
          if (isDiscarded) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
          } else if (idx % 2 === 1) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          }
        }
      });

      // Totals row
      const endRow = startRow + computed.rows.length - 1;
      const totalRowNum = endRow + 1;
      const totalRow = sheet.getRow(totalRowNum);
      totalRow.height = 22;

      totalRow.getCell(1).value = 'TOTAL';
      totalRow.getCell(2).value = `${computed.summary.totalJoints} run (${computed.summary.discardedCount} rej)`;
      if (computed.rows.length > 0) {
        totalRow.getCell(7).value = {
          formula: `SUM(G${startRow}:G${endRow})`,
          result: Number(computed.summary.totalMeasuredLength.toFixed(2)),
        };
        totalRow.getCell(8).value = {
          formula: `SUM(H${startRow}:H${endRow})`,
          result: Number(computed.summary.totalMakeUpLoss.toFixed(3)),
        };
        totalRow.getCell(9).value = {
          formula: `SUM(I${startRow}:I${endRow})`,
          result: Number(computed.summary.totalEffectiveLength.toFixed(2)),
        };
        totalRow.getCell(14).value = {
          formula: `SUM(N${startRow}:N${endRow})`,
          result: Number(computed.summary.totalAirWeightLbs.toFixed(1)),
        };
      }

      totalRow.getCell(7).numFmt = '#,##0.00';
      totalRow.getCell(8).numFmt = '#,##0.000';
      totalRow.getCell(9).numFmt = '#,##0.00';
      totalRow.getCell(14).numFmt = '#,##0.0';

      for (let c = 1; c <= 16; c++) {
        const cell = totalRow.getCell(c);
        cell.font = { bold: true, size: 10, color: { argb: 'FF0F172A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.border = { top: { style: 'medium', color: { argb: 'FF0F172A' } } };
        if (c >= 7 && c <= 15) cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }

      // Column widths
      const colWidths = [8, 15, 8, 10, 13, 13, 14, 13, 14, 14, 13, 13, 11, 14, 15, 30];
      colWidths.forEach((w, i) => {
        sheet.getColumn(i + 1).width = w;
      });

      // Summary Sheet
      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.getColumn(1).width = 32;
      summarySheet.getColumn(2).width = 36;
      const xoCount = Array.isArray(computed.crossoverAlerts) ? computed.crossoverAlerts.length : 0;
      const summaryRows = [
        ['Tally Summary Metric', 'Value'],
        ['Well / String', `${config.wellName} — ${config.stringName}`],
        ['Pipe OD / Nominal Weight', `${config.pipeSizeLabel}" (${config.pipeSizeIn} in) · ${config.weightLbFt} lb/ft`],
        ['Default Top / Bottom Connection', `${defaultTopConn} / ${defaultBotConn}`],
        ['Crossover (XO) Required Alerts', xoCount === 0 ? 'None' : `${xoCount} mismatch(es)`],
        ['Section TD / Off TD', `${config.sectionTd || targetShoeDepth} ${unit} / Off ${config.shoeOffTd || 0} ${unit}`],
        ['Target Shoe Depth', `${targetShoeDepth} ${unit}`],
        ['Achieved Shoe Depth', `${computed.summary.achievedShoeDepth.toFixed(2)} ${unit}`],
        ['Hanger Landing Depth', config.hasHanger ? `${config.hangerDepth} ${unit}` : 'N/A'],
        ['Rig Floor Stick-Up (Cmt Head)', config.hasHanger ? `${computed.summary.actualStickupAboveRigFloor.toFixed(2)} ${unit}` : 'N/A'],
        ['Active Run Pieces', computed.summary.totalJoints],
        ['Rejected / Discarded Pieces', computed.summary.discardedCount],
        ['Standard Joints', computed.summary.standardJointCount],
        ['Pup Joints', computed.summary.pupJointCount],
        ['Landing Joints', computed.summary.landingJointCount],
        ['Shoe / Collars / Hanger', computed.summary.accessoryCount],
        [`Total Measured Length (${unit})`, Number(computed.summary.totalMeasuredLength.toFixed(2))],
        [`Total Make-Up Loss (${unit})`, Number(computed.summary.totalMakeUpLoss.toFixed(3))],
        [`Total Net Run Length (${unit})`, Number(computed.summary.totalEffectiveLength.toFixed(2))],
        ['Total Air Weight (lbs)', Number(computed.summary.totalAirWeightLbs.toFixed(1))],
        ['Total Air Weight (MT)', Number(computed.summary.totalAirWeightTonnes.toFixed(2))],
        ['Buoyancy Factor', Number(computed.summary.buoyancyFactor.toFixed(4))],
        ['Total Buoyed Weight (lbs)', Number(computed.summary.totalBuoyedWeightLbs.toFixed(1))],
        ['Total Buoyed Weight (MT)', Number(computed.summary.totalBuoyedWeightTonnes.toFixed(2))],
      ];
      summaryRows.forEach((sr, i) => {
        const r = summarySheet.getRow(i + 1);
        r.getCell(1).value = sr[0];
        r.getCell(2).value = sr[1];
        if (i === 0) {
          r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
          r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        } else {
          r.getCell(1).font = { bold: true, color: { argb: 'FF334155' } };
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const safeName = (config.stringName || 'pipe_tally').replace(/[^a-zA-Z0-9_-]+/g, '_');

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}_tally.xlsx"`);
      res.send(Buffer.from(buffer));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export Excel.';
      res.status(500).json({ error: message });
    }
  });

  // Export Running Tally to print-ready PDF
  app.post('/api/tally/export/pdf', (req: Request, res: Response) => {
    try {
      const { config, computed } = req.body as {
        config: TallyConfig;
        computed: ComputedTallyResult;
      };

      if (!config || !computed || !Array.isArray(computed.rows)) {
        res.status(400).json({ error: 'Invalid tally payload.' });
        return;
      }

      const safeName = (config.stringName || 'pipe_tally').replace(/[^a-zA-Z0-9_-]+/g, '_');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}_tally.pdf"`);

      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 32,
        bufferPages: true,
      });

      doc.pipe(res);

      const pageWidth = doc.page.width - 64;
      const unit = config.lengthUnit;

      const drawHeader = () => {
        doc.rect(32, 28, pageWidth, 28).fill('#0F172A');
        doc
          .fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(12)
          .text(
            `PIPE RUNNING TALLY — ${config.stringName || config.stringCategory.toUpperCase()}`,
            42,
            36
          );
        doc
          .font('Helvetica')
          .fontSize(9)
          .text(`Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`, 32, 37, {
            width: pageWidth - 10,
            align: 'right',
          });

        const targetShoeDepth =
          config.sectionTd > 0
            ? Math.max(0, config.sectionTd - (config.shoeOffTd || 0))
            : config.targetDepth;
        const ySpec = 64;
        doc.fillColor('#334155').font('Helvetica-Bold').fontSize(8);
        doc.text(`Well: `, 32, ySpec, { continued: true }).font('Helvetica').text(`${config.wellName || '-'}  `);
        doc.font('Helvetica-Bold').text(`OD/Wt: `, { continued: true }).font('Helvetica').text(`${config.pipeSizeLabel}" · ${config.weightLbFt} lb/ft  `);
        doc.font('Helvetica-Bold').text(`Conn (T/B): `, { continued: true }).font('Helvetica').text(`${config.topConnection || config.connection || '-'}/${config.bottomConnection || config.connection || '-'}  `);
        doc.font('Helvetica-Bold').text(`MU Loss: `, { continued: true }).font('Helvetica').text(`${config.defaultMakeUpLoss} ${config.makeUpLossUnit}  `);
        doc.font('Helvetica-Bold').text(`TD / Shoe: `, { continued: true }).font('Helvetica').text(`${config.sectionTd || targetShoeDepth} (Off ${config.shoeOffTd || 0} → ${targetShoeDepth} ${unit})  `);
        if (config.hasHanger) {
          doc.font('Helvetica-Bold').text(`Hanger: `, { continued: true }).font('Helvetica').text(`${config.hangerDepth} ${unit} (SU +${computed.summary.actualStickupAboveRigFloor.toFixed(2)})  `);
        }
        doc.font('Helvetica-Bold').text(`MW: `, { continued: true }).font('Helvetica').text(`${config.mudWeightPpg} ppg`);

        doc.moveTo(32, 80).lineTo(32 + pageWidth, 80).strokeColor('#CBD5E1').lineWidth(0.75).stroke();
      };

      const colSpec = [
        { label: 'Run', w: 24, align: 'left' as const },
        { label: 'Joint / Tag', w: 58, align: 'left' as const },
        { label: 'Lyr', w: 22, align: 'center' as const },
        { label: 'Type', w: 38, align: 'left' as const },
        { label: 'Top Conn', w: 46, align: 'left' as const },
        { label: 'Bot Conn', w: 46, align: 'left' as const },
        { label: `Gross (${unit})`, w: 46, align: 'right' as const },
        { label: `MU (${unit})`, w: 40, align: 'right' as const },
        { label: `Net (${unit})`, w: 46, align: 'right' as const },
        { label: `Cum (${unit})`, w: 50, align: 'right' as const },
        { label: `Top MD`, w: 48, align: 'right' as const },
        { label: `Bot MD`, w: 48, align: 'right' as const },
        { label: 'lb/ft', w: 34, align: 'right' as const },
        { label: 'Seg Wt', w: 50, align: 'right' as const },
        { label: 'Cum Wt', w: 54, align: 'right' as const },
        { label: 'Status / Remarks', w: pageWidth - 650, align: 'left' as const },
      ];

      const drawTableHeaders = (y: number) => {
        doc.rect(32, y, pageWidth, 18).fill('#1E293B');
        let x = 32;
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.4);
        for (const col of colSpec) {
          doc.text(col.label, x + 3, y + 5, { width: col.w - 6, align: col.align });
          x += col.w;
        }
        return y + 18;
      };

      drawHeader();
      let y = drawTableHeaders(88);

      computed.rows.forEach((r, idx) => {
        if (y > doc.page.height - 72) {
          doc.addPage();
          drawHeader();
          y = drawTableHeaders(88);
        }

        const isDiscarded = Boolean(r.discarded);
        if (isDiscarded) {
          doc.rect(32, y, pageWidth, 16).fill('#FEF2F2');
        } else if (idx % 2 === 1) {
          doc.rect(32, y, pageWidth, 16).fill('#F8FAFC');
        }

        const values = [
          isDiscarded ? 'REJ' : String(r.runSeq ?? r.seq),
          r.jointNo,
          r.layer ? String(r.layer) : '-',
          r.componentType.toUpperCase(),
          r.effectiveTopConnection || config.topConnection || config.connection || '-',
          r.effectiveBottomConnection || config.bottomConnection || config.connection || '-',
          isDiscarded ? '0.00' : r.measuredLength.toFixed(2),
          isDiscarded ? '0.000' : r.effectiveMakeUpLoss.toFixed(3),
          isDiscarded ? '0.00' : r.effectiveLength.toFixed(2),
          isDiscarded ? '-' : r.cumLength.toFixed(2),
          isDiscarded ? '-' : r.topDepth < 0 ? `+${Math.abs(r.topDepth).toFixed(2)}SU` : r.topDepth.toFixed(2),
          isDiscarded ? '-' : r.bottomDepth.toFixed(2),
          r.unitWeightLbFt.toFixed(1),
          isDiscarded ? '0' : Math.round(r.segmentAirWeightLbs).toLocaleString('en-US'),
          isDiscarded ? '-' : Math.round(r.cumAirWeightLbs).toLocaleString('en-US'),
          `${isDiscarded ? '[REJECTED] ' : ''}${[r.serialNo, r.discardReason, r.remarks].filter(Boolean).join(' · ')}`.slice(0, 26),
        ];

        let x = 32;
        doc.fillColor(isDiscarded ? '#B91C1C' : '#0F172A').font('Helvetica').fontSize(7.3);
        colSpec.forEach((col, cIdx) => {
          doc.text(values[cIdx], x + 3, y + 4, {
            width: col.w - 6,
            align: col.align,
            lineBreak: false,
            ellipsis: true,
          });
          x += col.w;
        });

        y += 16;
      });

      // Totals summary box
      if (y > doc.page.height - 90) {
        doc.addPage();
        drawHeader();
        y = 92;
      }

      const xoAlerts = Array.isArray(computed.crossoverAlerts) ? computed.crossoverAlerts : [];
      y += 8;
      doc.rect(32, y, pageWidth, xoAlerts.length > 0 ? 44 : 34).fill('#E2E8F0');
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8.5);
      doc.text(
        `ACTIVE PIECES: ${computed.summary.totalJoints} (REJ: ${computed.summary.discardedCount})  |  SHOE MD: ${computed.summary.achievedShoeDepth.toFixed(2)} ${unit}  |  NET LEN: ${computed.summary.totalEffectiveLength.toFixed(2)} ${unit}${config.hasHanger ? `  |  STICK-UP: +${computed.summary.actualStickupAboveRigFloor.toFixed(2)} ${unit}` : ''}  |  AIR WT: ${Math.round(computed.summary.totalAirWeightLbs).toLocaleString('en-US')} lbs (${computed.summary.totalAirWeightTonnes.toFixed(2)} MT)`,
        42,
        y + 10,
        { width: pageWidth - 20 }
      );
      if (xoAlerts.length > 0) {
        doc
          .fillColor('#B45309')
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(
            `XO ALERTS (${xoAlerts.length}): ` +
              xoAlerts
                .map(
                  (a) =>
                    `${a.fromJointNo} ${a.fromEnd || 'Top'} (${a.fromConnection}) <-> ${a.toJointNo} ${a.toEnd || 'Bottom'} (${a.toConnection})`
                )
                .join('  |  '),
            42,
            y + 25,
            { width: pageWidth - 20, lineBreak: false, ellipsis: true }
          );
      }

      // Page numbers
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc
          .fillColor('#64748B')
          .font('Helvetica')
          .fontSize(8)
          .text(
            `RigTally Engineering Sheet · Engineer: ${config.engineerName || '—'} · Page ${i + 1} of ${pages.count}`,
            32,
            doc.page.height - 26,
            { width: pageWidth, align: 'right' }
          );
      }

      doc.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export PDF.';
      res.status(500).json({ error: message });
    }
  });

  return app;
}
