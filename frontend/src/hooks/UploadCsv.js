import { useState } from 'react';
import axios from 'axios';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://192.168.0.2:8000";

/* ---------- 유틸 ---------- */
const detectDelimiter = (headerLine) => {
  const semi = (headerLine.match(/;/g) || []).length;
  const comma = (headerLine.match(/,/g) || []).length;
  const tab = (headerLine.match(/\t/g) || []).length;
  if (tab > semi && tab > comma) return '\t';
  return semi > comma ? ';' : ',';
};

const splitCSVLine = (line, delim) => {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === delim && !inQuotes) {
      out.push(cur); cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
};

const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const stripBOM = (s) => String(s || '').replace(/^\uFEFF/, '');
const sanitizeToken = (s) =>
  String(s || '').trim().replace(/\s+/g, ' ').replace(/[\/\\:*?"<>|]/g, '').replace(/\s/g, '_');

const toAsciiHyphen = (s) => String(s || '').replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-');
const canonCompare = (s) => toAsciiHyphen(String(s || '')).normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ').replace(/_/g, ' ').replace(/\s*-\s*/g, '-');
const stripNonAlnum = (s) => String(s || '').replace(/[^a-z0-9]/g, '');

const parseQty = (s) => {
  const m = String(s ?? '').match(/-?\d+(?:[,\s]?\d+)*/);
  if (!m) return 0;
  const digits = m[0].replace(/[,\s]/g, '');
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
};

/* ---------- normalize (device/value → part_name 규칙 반영) ---------- */
const normalizeCsvText = (text) => {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.length);
  if (!lines.length) throw new Error('빈 CSV입니다.');

  const delim = detectDelimiter(lines[0]);
  const headers = splitCSVLine(lines[0], delim).map(c => stripBOM(c).replace(/^"+|"+$/g, ''));

  const H = {
    qty: ['Qty', 'Quantity', 'QTY', 'Count', 'Qty.'],
    value: ['Value', 'Val', 'Spec'],
    device: ['Device', 'Type', 'Category'],
    parts: ['Parts', 'Reference', 'Designator', 'RefDes', 'Refs'],
    desc: ['Detailed Description', 'Description', 'Desc'],
    pack: ['Footprint Name', 'Package', 'Footprint', 'Package Name', 'Package/Case'],
    mfr: ['Manufacturer', 'Mfr', 'Mfr.', 'Manufacturer Name', 'Vendor'],
  };

  const idxOfAny = (names) => {
    for (const n of names) {
      const i = headers.findIndex(h => String(h || '').trim().toLowerCase() === String(n || '').trim().toLowerCase());
      if (i >= 0) return i;
    }
    return -1;
  };

  const iQty = idxOfAny(H.qty);
  const iValue = idxOfAny(H.value);
  const iDevice = idxOfAny(H.device);
  const iParts = idxOfAny(H.parts);
  const iDesc = idxOfAny(H.desc);
  const iPack = idxOfAny(H.pack);
  const iMfr = idxOfAny(H.mfr);

  if (iParts < 0) throw new Error('CSV에 참조열(Parts/Reference/Designator)이 없습니다.');
  if (iQty < 0) throw new Error('CSV에 수량(Qty/Quantity) 헤더가 없습니다.');

  const out = [];
  out.push(['part_name', 'quantity', 'reference', 'description', 'package'].join(','));

  let skippedEmpty = 0;
  let skippedZero = 0;

  for (let r = 1; r < lines.length; r++) {
    const rawCells = splitCSVLine(lines[r], delim).map(c => c.replace(/^"+|"+$/g, ''));
    if (rawCells.every(c => !c || !String(c).trim())) { skippedEmpty++; continue; }

    const qty = parseQty(iQty >= 0 ? rawCells[iQty] : 0);
    if (!qty) { skippedZero++; continue; }

    const deviceRaw = iDevice >= 0 ? (rawCells[iDevice] || '').trim() : '';
    const valueRaw = iValue >= 0 ? (rawCells[iValue] || '').trim() : '';
    const reference = (rawCells[iParts] || '').trim();
    const description = iDesc >= 0 ? (rawCells[iDesc] || '').trim() : '';
    const pack = iPack >= 0 ? (rawCells[iPack] || '').trim() : '';
    const mfrRaw = iMfr >= 0 ? (rawCells[iMfr] || '').trim() : '';

    const deviceTok = sanitizeToken(deviceRaw);
    const valueTok = sanitizeToken(valueRaw);
    const mfrTok = sanitizeToken(mfrRaw);

    const devNorm = canonCompare(deviceRaw);
    const valNorm = canonCompare(valueRaw);

    let baseName = '';
    if (devNorm && valNorm) {
      baseName = (devNorm === valNorm || stripNonAlnum(devNorm) === stripNonAlnum(valNorm))
        ? deviceTok
        : `${deviceTok}_${valueTok}`;
    } else if (devNorm) baseName = deviceTok;
    else if (valNorm) baseName = valueTok;
    else baseName = sanitizeToken(reference || '');

    const part_name = mfrTok ? `${mfrTok}_${baseName}` : baseName;

    out.push([
      q(part_name),
      q(qty),
      q(reference),
      q(description),
      q(pack),
    ].join(','));
  }

  return { csv: out.join('\n'), stats: { skippedEmpty, skippedZero } };
};

/* ---------- 훅 ---------- */
export const useCsvUploader = (uploadPath) => {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');

  const handleFileChange = (e) => setFile(e.target.files[0]);

  const handleUploadWithData = async (extraData = {}) => {
    if (!file) { setMessage('파일을 선택하세요.'); return; }

    try {
      const originalText = await file.text();
      const { csv: normalizedCsv, stats } = normalizeCsvText(originalText);

      // BOM 붙여 엑셀 호환성 보장
      const blob = new Blob(["\uFEFF", normalizedCsv], { type: 'text/csv;charset=utf-8' });
      const normalizedFile = new File([blob], `${file.name.replace(/\.(csv|txt)$/i, '')}_normalized.csv`, { type: 'text/csv' });

      const formData = new FormData();
      formData.append('file', normalizedFile);
      for (const key in extraData) formData.append(key, extraData[key]);

      // axios: 브라우저가 Content-Type 경계(boundary)를 붙이도록 헤더 지정 금지
      const res = await axios.post(`${SERVER_URL}${uploadPath}`, formData);

      const inserted = res?.data?.inserted ?? 0;
      const suffix = (stats.skippedEmpty || stats.skippedZero)
        ? ` (빈행 ${stats.skippedEmpty}건, 수량 0행 ${stats.skippedZero}건 스킵)` : '';
      setMessage(`업로드 성공: ${inserted}개 등록됨${suffix}`);
    } catch (err) {
      setMessage(`오류: ${err?.response?.data?.error || err?.message || String(err)}`);
    }
  };

  return { file, message, handleFileChange, handleUploadWithData };
};
