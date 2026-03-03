const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();
const { handleError } = require('../utils/errorUtils');

// GET /admin/dispatch/subjects
const getSubjectsForDispatch = async (req, res) => {
    try {
        const { semester } = req.query;
        let where = {};
        if (semester) {
            where.semester = parseInt(semester);
        }
        const subjects = await prisma.subject.findMany({
            where,
            select: { id: true, code: true, name: true, semester: true },
            orderBy: [{ semester: 'asc' }, { code: 'asc' }]
        });
        res.json(subjects);
    } catch (error) {
        handleError(res, error, 'Error fetching subjects for dispatch');
    }
};

// GET /admin/dispatch/students?subjectId=X&semester=X
const getStudentsForDispatch = async (req, res) => {
    try {
        const { subjectId, semester } = req.query;
        if (!subjectId || !semester) {
            return res.status(400).json({ error: 'subjectId and semester are required' });
        }

        const semInt = parseInt(semester);

        // 1) Regular active students in this semester
        const regularStudents = await prisma.student.findMany({
            where: {
                currentSemester: semInt,
                status: 'ACTIVE',
                registerNumber: { not: null }
            },
            select: { id: true, name: true, registerNumber: true, rollNo: true, department: true },
        });

        const regularIds = new Set(regularStudents.map(s => s.id));

        // 2) Arrear students: students who have an uncleared arrear for this subject
        const arrears = await prisma.arrear.findMany({
            where: {
                subjectId: parseInt(subjectId),
                isCleared: false,
                student: {
                    registerNumber: { not: null }
                }
            },
            include: {
                student: {
                    select: { id: true, name: true, registerNumber: true, rollNo: true, department: true }
                }
            }
        });

        // 3) Merge — arrear students not already in regular list
        const arrearStudents = arrears
            .filter(a => !regularIds.has(a.student.id))
            .map(a => ({ ...a.student, isArrear: true }));

        // Mark regular students (not arrear)
        const allStudents = [
            ...regularStudents.map(s => ({ ...s, isArrear: false })),
            ...arrearStudents
        ];

        // 4) Sort by register number numerically (extract trailing digits if any)
        allStudents.sort((a, b) => {
            const numA = parseInt((a.registerNumber || '').replace(/\D/g, '')) || 0;
            const numB = parseInt((b.registerNumber || '').replace(/\D/g, '')) || 0;
            if (numA !== numB) return numA - numB;
            return (a.registerNumber || '').localeCompare(b.registerNumber || '');
        });

        res.json(allStudents);
    } catch (error) {
        handleError(res, error, 'Error fetching students for dispatch');
    }
};

// Helper: draw text at absolute position without affecting cursor
function drawText(doc, text, x, y, options = {}) {
    doc.text(text, x, y, { lineBreak: false, ...options });
}

// POST /admin/dispatch/export-pdf
const exportDispatchPDF = async (req, res) => {
    try {
        const {
            subjectId,
            subjectCode,
            subjectName,
            semester,
            dispatchIndex,
            totalDispatches,
            date,
            time,
            session,
            ampm,
            boardCode,
            qpCode,
            students,
        } = req.body;

        if (!students || !Array.isArray(students)) {
            return res.status(400).json({ error: 'students array is required' });
        }

        const MIET_LOGO = path.join(__dirname, '../../client/public/miet-logo.png');
        // A4 Landscape: 841.89 x 595.28 pts
        const PAGE_W = 841.89;
        const PAGE_H = 595.28;
        const M = 32; // margin
        const CW = PAGE_W - M * 2; // content width

        const doc = new PDFDocument({
            size: 'A4',
            layout: 'landscape',
            margin: 0,
            info: { Title: 'Dispatch Sheet - MIET' }
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="dispatch_${(dispatchIndex || 0) + 1}.pdf"`);
        doc.pipe(res);

        // ── LOGO ───────────────────────────────────────────────────────────────
        const LOGO_SZ = 56;
        const LOGO_X = M;
        const LOGO_Y = M;
        if (fs.existsSync(MIET_LOGO)) {
            doc.image(MIET_LOGO, LOGO_X, LOGO_Y, { width: LOGO_SZ, height: LOGO_SZ });
        } else {
            doc.rect(LOGO_X, LOGO_Y, LOGO_SZ, LOGO_SZ).stroke();
            doc.font('Helvetica-Bold').fontSize(9).fillColor('black');
            drawText(doc, 'MIET', LOGO_X + 14, LOGO_Y + 22);
        }

        // ── TITLE BLOCK (centred, to the right of logo) ────────────────────────
        const TX = M + LOGO_SZ + 8;
        const TW = CW - LOGO_SZ - 8;

        doc.font('Helvetica-Bold').fontSize(14).fillColor('black');
        drawText(doc, 'M.I.E.T Engineering College :: TRICHY', TX, M + 2, { width: TW, align: 'center' });

        const examMonth = date
            ? new Date(date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
            : 'May, 2024';

        doc.font('Helvetica-Bold').fontSize(10);
        drawText(doc, `${examMonth} - Semester Examinations`, TX, M + 20, { width: TW, align: 'center' });
        drawText(doc, 'LIST OF ANSWER BOOK ( AVAILABLE )', TX, M + 34, { width: TW, align: 'center' });

        // ── DIVIDER 1 ──────────────────────────────────────────────────────────
        const D1Y = M + LOGO_SZ + 4;
        doc.moveTo(M, D1Y).lineTo(PAGE_W - M, D1Y).lineWidth(1).strokeColor('black').stroke();

        // ── INSTITUTION / SUBJECT ROW ──────────────────────────────────────────
        const INFO_Y = D1Y + 6;
        const HALF = CW / 2;

        doc.font('Helvetica-Bold').fontSize(8).fillColor('black');
        drawText(doc, 'Institution: ', M, INFO_Y, { lineBreak: false });
        doc.font('Helvetica').fontSize(8);
        drawText(doc, '8124 : M.I.E.T. ENGINEERING COLLEGE', M + 52, INFO_Y);

        const fmtDate = date
            ? new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
            : '---';
        const timeDisplay = time ? `${time} ${ampm || ''}`.trim() : '10 AM';
        const sessionDisplay = session || 'FN';
        const examDateStr = `${fmtDate} / ${sessionDisplay}(${timeDisplay}-1 PM)`;

        doc.font('Helvetica-Bold').fontSize(8).fillColor('black');
        drawText(doc, 'Exam Date:  ', M + HALF, INFO_Y);
        doc.font('Helvetica').fontSize(8);
        drawText(doc, examDateStr, M + HALF + 54, INFO_Y);

        const SUB_Y = INFO_Y + 13;
        doc.font('Helvetica-Bold').fontSize(8).fillColor('black');
        drawText(doc, 'Subject:    ', M, SUB_Y);
        doc.font('Helvetica').fontSize(8);
        drawText(doc, `${subjectCode || ''}:${subjectName || ''}`, M + 52, SUB_Y);

        doc.font('Helvetica-Bold').fontSize(8).fillColor('black');
        drawText(doc, 'Question Paper Code: ', M + HALF, SUB_Y);
        doc.font('Helvetica').fontSize(8);
        drawText(doc, qpCode || '', M + HALF + 104, SUB_Y);

        // ── DIVIDER 2 ──────────────────────────────────────────────────────────
        const D2Y = SUB_Y + 13;
        doc.moveTo(M, D2Y).lineTo(PAGE_W - M, D2Y).lineWidth(0.6).strokeColor('black').stroke();

        // ── FIXED BOTTOM BLOCK HEIGHTS ────────────────────────────────────────
        //  footer line: 15pt from bottom
        //  sig box: 46pt
        //  notes: 26pt
        //  summary bar: 20pt
        //  divider above summary: 1pt
        //  gap between D2Y and grid: 5pt
        const FT_H = 15;    // footer strip height
        const SIG_H = 46;    // signature box
        const NOTE_H = 26;    // two note lines
        const SUM_H = 20;    // summary text
        const BOTTOM_BLOCK = FT_H + SIG_H + NOTE_H + SUM_H + 8; // total below grid

        const COLS = 5;
        const ROWS = 10;
        const GRID_Y = D2Y + 5;
        const COL_W = CW / COLS;

        // Compute row height to fill remaining space
        const GRID_AVAIL = PAGE_H - M - BOTTOM_BLOCK - GRID_Y;
        const ROW_H = Math.floor(GRID_AVAIL / ROWS);  // e.g. ~30–33 pt
        const REG_FONT = Math.min(11, Math.floor(ROW_H * 0.45)); // scale font

        // ── STUDENT GRID (5 cols × 10 rows, column-major) ─────────────────────
        for (let col = 0; col < COLS; col++) {
            for (let row = 0; row < ROWS; row++) {
                const idx = col * ROWS + row;
                if (idx >= students.length) break;

                const s = students[idx];
                const cellX = M + col * COL_W;
                const cellY = GRID_Y + row * ROW_H + Math.floor((ROW_H - REG_FONT) / 2);

                const regText = s.registerNumber || '';

                if (s.isAbsent) {
                    doc.font('Helvetica-Bold').fontSize(REG_FONT).fillColor('red');
                } else if (s.isArrear) {
                    doc.font('Helvetica-Bold').fontSize(REG_FONT).fillColor('#b35800');
                } else {
                    doc.font('Helvetica-Bold').fontSize(REG_FONT).fillColor('black');
                }
                drawText(doc, regText, cellX, cellY, { lineBreak: false });

                // Small badge suffix
                if (s.isAbsent || s.isArrear) {
                    const badge = s.isAbsent ? 'AB' : 'AR';
                    const badgeX = cellX + doc.widthOfString(regText) + 3;
                    const badgeY = cellY + 1;
                    doc.font('Helvetica-Bold').fontSize(REG_FONT - 3);
                    drawText(doc, badge, badgeX, badgeY, { lineBreak: false });
                }
            }
        }

        doc.fillColor('black');

        // ── SUMMARY BAR (pinned just above sig box) ────────────────────────────
        const SUM_Y = PAGE_H - M - FT_H - SIG_H - NOTE_H - SUM_H - 3;
        doc.moveTo(M, SUM_Y).lineTo(PAGE_W - M, SUM_Y).lineWidth(0.8).strokeColor('black').stroke();

        const totalCount = students.length;
        const abCount = students.filter(s => s.isAbsent).length;
        const mpCount = students.filter(s => s.isMalpractice).length;
        const presentCount = totalCount - abCount;

        const SUM_TY = SUM_Y + 3;
        doc.font('Helvetica-Bold').fontSize(12).fillColor('black');
        drawText(doc, `Bd:   ${boardCode || '505'}`, M, SUM_TY);
        const summary = `Total: ${totalCount}   ( AB:${abCount}   MP:${mpCount}   Present: ${presentCount} )`;
        drawText(doc, summary, M + 100, SUM_TY, { width: CW - 200, align: 'center' });

        // ── NOTES ──────────────────────────────────────────────────────────────
        const NOTE_Y = SUM_TY + 14;
        doc.font('Helvetica').fontSize(6.5).fillColor('black');
        drawText(doc, '** This page should be pasted on the top of Answer booklet cover.', M, NOTE_Y);
        drawText(doc, '** Absentees / Malpractice / Discrepancies should be marked before taking print.', M, NOTE_Y + 9);

        // ── SIGNATURE BOX (pinned near bottom) ────────────────────────────────
        const SIG_Y = PAGE_H - M - FT_H - SIG_H - 2;
        doc.rect(M, SIG_Y, CW, SIG_H).lineWidth(0.6).strokeColor('black').stroke();

        const SI = SIG_Y + 8;
        const C1 = M + 10;
        const C2 = M + CW * 0.36;
        const C3 = M + CW * 0.70;

        doc.font('Helvetica').fontSize(7.5).fillColor('red');
        drawText(doc, 'STATION________________', C1, SI);
        drawText(doc, 'Signature of the University Representative', C2, SI, { width: CW * 0.28, align: 'center' });
        drawText(doc, 'Signature of the Chief Superintendent', C3, SI);
        drawText(doc, 'DATE:______/______/______', C1, SI + 18);
        drawText(doc, 'CENTRE_______(COLLEGE SEAL)', C3, SI + 18);

        // ── FOOTER ─────────────────────────────────────────────────────────────
        const FT_Y = PAGE_H - M - 12;
        doc.moveTo(M, FT_Y - 3).lineTo(PAGE_W - M, FT_Y - 3).lineWidth(0.5).strokeColor('black').stroke();
        doc.font('Helvetica').fontSize(8).fillColor('black');
        drawText(doc, fmtDate, M, FT_Y);
        drawText(doc, `Page ${(dispatchIndex || 0) + 1}/${totalDispatches || 1}`, M, FT_Y, { width: CW, align: 'center' });
        drawText(doc, 'COE', M, FT_Y, { width: CW, align: 'right' });

        doc.end();
    } catch (error) {
        console.error('PDF export error:', error);
        if (!res.headersSent) {
            handleError(res, error, 'Error generating dispatch PDF');
        }
    }
};

module.exports = {
    getSubjectsForDispatch,
    getStudentsForDispatch,
    exportDispatchPDF,
};
