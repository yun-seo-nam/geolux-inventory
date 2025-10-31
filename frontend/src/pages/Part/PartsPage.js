// src/pages/Part/PartsPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Row, Col, Form, Card, Pagination, ToggleButtonGroup, ToggleButton,
  Button, InputGroup, Table, Modal
} from 'react-bootstrap';
import { FiGrid, FiList, FiTrash2 } from 'react-icons/fi';
import { MdOutlineAdd, MdOutlineCancel, MdOutlineEdit, MdSave } from "react-icons/md";

import UploadPart from '../../components/UploadPart';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:8000";

// 서버가 받는 키만 화이트리스트로 구성 + 타입/기본값 보정
const buildPartUpdatePayload = (src) => {
  const num = (v, def = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };
  const str = (v, def = "") => (v ?? "").toString();
  const optNumOrNull = (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const payload = {
    // 기존
    part_name: str(src.part_name),
    quantity: num(src.quantity, 0),
    location: str(src.location),
    description: str(src.description),

    // 새로 추가
    type: str(src.mounting_type),
    package: str(src.package),
    price: optNumOrNull(src.price),
    supplier: str(src.supplier),
    purchase_date: str(src.purchase_date),
    manufacturer: str(src.manufacturer),
    purchase_url: str(src.purchase_url),
    memo: str(src.memo),
  };

  Object.keys(payload).forEach(k => {
    if (payload[k] === undefined) delete payload[k];
  });
  return payload;
};

const GridView = ({
  parts, navigate, deleteMode, selectedIds, setSelectedIds,
  inlineEdit, onFieldChange, onSaveRow, savingIds
}) => {

  return (
    <div className="d-flex flex-wrap" style={{ gap: '12px', justifyContent: 'flex-start' }}>
      {parts.map(part => {
        const saving = savingIds?.has?.(part.id);
        return (
          <Card
            key={part.id}
            style={{ width: '220px', height: '230px', maxWidth: '100%', position: 'relative' }}
          >
            {deleteMode && (
              <Form.Check
                type="checkbox"
                checked={selectedIds.includes(part.id)}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setSelectedIds(prev =>
                    checked ? [...prev, part.id] : prev.filter(id => id !== part.id)
                  );
                }}
                className="position-absolute top-0 start-0 m-2"
              />
            )}

            <div className="d-flex justify-content-center" onClick={() => { if (!inlineEdit) navigate(`/partDetail/${part.id}`); }}>
              <Card.Img
                variant="top"
                src={
                  part.image_filename
                    ? `${SERVER_URL}/static/images/parts/${part.image_filename}`
                    : '/default-part-icon.png'
                }
                alt="part preview"
                loading="lazy"
                style={{
                  height: '140px',
                  maxWidth: '200px',
                  objectFit: 'contain',
                  padding: '10px',
                  backgroundColor: '#f8f9fa',
                  cursor: inlineEdit ? 'default' : 'pointer',
                }}
              />
            </div>

            <Card.Body className="px-3 py-2">
              <div className="d-flex justify-content-between align-items-center mb-1" title={part.part_name}>
                {inlineEdit ? (
                  <Form.Control
                    size="sm"
                    value={part.part_name || ""}
                    onChange={(e) => onFieldChange(part.id, "part_name", e.target.value)}
                    style={{ maxWidth: '140px' }}
                  />
                ) : (
                  <div
                    className="fw-bold mb-0 text-truncate"
                    style={{ fontSize: '1rem', cursor: 'pointer', flexGrow: 1, marginRight: '10px', maxWidth: '200px' }}
                    onClick={() => navigate(`/partDetail/${part.id}`)}
                  >
                    {part.part_name}
                  </div>
                )}

                {inlineEdit ? (
                  <Form.Control
                    size="sm"
                    type="number"
                    value={part.quantity ?? 0}
                    onChange={(e) => onFieldChange(part.id, "quantity", Number(e.target.value))}
                    style={{ width: 70 }}
                  />
                ) : (
                  <Card.Text className="mb-0" style={{ fontSize: '0.9rem', color: '#666', whiteSpace: 'nowrap' }}>
                    {part.quantity ?? 0}개
                  </Card.Text>
                )}
              </div>

              {/* 행 저장 버튼 (편집 모드에서만) */}
              {inlineEdit ? (
                <div className="d-flex justify-content-end">
                  <Button
                    size="sm"
                    variant="outline-primary"
                    disabled={saving}
                    onClick={() => onSaveRow(part.id)}
                  >
                    {saving ? "..." : <MdSave />}
                  </Button>
                </div>
              ) : (
                <div className="mb-1 d-flex flex-row-reverse">
                  <Card.Text className="mb-0" style={{ fontSize: '0.8rem', color: '#666', whiteSpace: 'nowrap' }}>
                    {part.update_date ? part.update_date.split(' ')[0] : '날짜 없음'}
                  </Card.Text>
                </div>
              )}
            </Card.Body>
          </Card>
        );
      })}
    </div>
  );
};

const ListView = ({
  parts, navigate, deleteMode, selectedIds, setSelectedIds,
  inlineEdit, onFieldChange, onSaveRow, savingIds
}) => {
  const stop = (e) => inlineEdit && e.stopPropagation();
  const dateToInput = (v) => !v ? "" : String(v).split(" ")[0];

  // 말줄임 공통 스타일
  const tdEllipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' };
  const inputEllipsis = { width: '100%', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

  // 비율(총 20단위, 단위=5%)
  const UNIT = 5;
  const WIDTHS_PERCENT = {
    name: 2 * UNIT,     // 품명 10
    qty: 2 * UNIT,      // 수량 5
    loc: 1 * UNIT,      // 위치 5
    desc: 3 * UNIT,     // 설명 15
    type: 1 * UNIT,     // Type 5
    pkg: 1 * UNIT,      // 패키지 5
    price: 1 * UNIT,    // 가격 5
    supplier: 1 * UNIT, // 공급업체 5
    pdate: 2 * UNIT,    // 구매일 10
    mfr: 1 * UNIT,      // 제조사 5
    url: 2 * UNIT,      // URL 15
    memo: 2 * UNIT,     // Memo 10
    updated: 1 * UNIT   // 수정일 5
  };

  // 공백 텍스트 노드 방지: 배열로 만든 뒤 렌더
  const colEls = [];
  if (deleteMode) colEls.push(<col key="sel" style={{ width: 56 }} />);
  colEls.push(<col key="name" style={{ width: `${WIDTHS_PERCENT.name}%` }} />);
  colEls.push(<col key="qty" style={{ width: `${WIDTHS_PERCENT.qty}%` }} />);
  colEls.push(<col key="loc" style={{ width: `${WIDTHS_PERCENT.loc}%` }} />);
  colEls.push(<col key="desc" style={{ width: `${WIDTHS_PERCENT.desc}%` }} />);
  colEls.push(<col key="type" style={{ width: `${WIDTHS_PERCENT.type}%` }} />);
  colEls.push(<col key="pkg" style={{ width: `${WIDTHS_PERCENT.pkg}%` }} />);
  colEls.push(<col key="price" style={{ width: `${WIDTHS_PERCENT.price}%` }} />);
  colEls.push(<col key="supplier" style={{ width: `${WIDTHS_PERCENT.supplier}%` }} />);
  colEls.push(<col key="pdate" style={{ width: `${WIDTHS_PERCENT.pdate}%` }} />);
  colEls.push(<col key="mfr" style={{ width: `${WIDTHS_PERCENT.mfr}%` }} />);
  colEls.push(<col key="url" style={{ width: `${WIDTHS_PERCENT.url}%` }} />);
  colEls.push(<col key="memo" style={{ width: `${WIDTHS_PERCENT.memo}%` }} />);
  colEls.push(<col key="updated" style={{ width: `${WIDTHS_PERCENT.updated}%` }} />);
  if (inlineEdit) colEls.push(<col key="save" style={{ width: 90 }} />);

  // ListView 함수 시작 부분 바로 아래에 추가
  const [hoverRow, setHoverRow] = useState(null);

  const [showAdjModal, setShowAdjModal] = useState(false);
  const [adjMode, setAdjMode] = useState('in'); // 'in' | 'out'
  const [adjPart, setAdjPart] = useState(null);
  const [adjValue, setAdjValue] = useState(1);

  // 모달 열기
  const openAdjustModal = (part, mode) => {
    setAdjMode(mode);
    setAdjPart(part);
    setAdjValue(1);
    setShowAdjModal(true);
  };

  // 모달 확정 처리: 서버에 PUT, 성공 시 UI 동기화
  const handleConfirmAdjust = async () => {
    if (!adjPart) return;
    const baseQty = Number(adjPart.quantity ?? 0);
    const delta = adjMode === 'in' ? Number(adjValue) : -Number(adjValue);
    if (!Number.isFinite(delta) || delta === 0) {
      alert("조정 수량을 올바르게 입력하세요.");
      return;
    }
    const nextQty = baseQty + delta;
    if (nextQty < 0) {
      alert("출고 수량이 재고를 초과합니다.");
      return;
    }

    try {
      // 서버에 즉시 반영 (PUT /api/parts/:id)
      const payload = { quantity: nextQty }; // 필요한 경우 memo 같은 필드도 함께 보낼 수 있음
      const res = await fetch(`${SERVER_URL}/api/parts/${adjPart.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`PUT ${res.status} - ${text}`);
      }

      // UI 즉시 반영
      onFieldChange(adjPart.id, "quantity", nextQty);

      setShowAdjModal(false);
    } catch (e) {
      console.error(e);
      alert(`수량 조정 실패: ${e.message}`);
    }
  };

  return (
    <Table
      striped
      bordered
      hover
      size="sm"
      responsive
      // fixed여야 퍼센트 폭+ellipsis가 안정적으로 적용
      style={{ tableLayout: 'fixed', width: '100%' }}
    >
      <colgroup>{colEls}</colgroup>

      <thead>
        <tr>
          {deleteMode && <th>선택</th>}
          <th>품명</th>
          <th>수량</th>
          <th>위치</th>
          <th>설명</th>
          <th>Type</th>
          <th>패키지</th>
          <th>가격</th>
          <th>공급업체</th>
          <th>구매일</th>
          <th>제조사</th>
          <th>URL</th>
          <th>Memo</th>
          <th>수정일</th>
          {inlineEdit && <th>저장</th>}
        </tr>
      </thead>

      <tbody>
        {parts.map((part) => {
          const saving = savingIds?.has?.(part.id);

          return (
            <tr
              key={part.id}
              style={{ cursor: inlineEdit ? 'default' : 'pointer' }}
              onClick={() => { if (!inlineEdit) navigate(`/partDetail/${part.id}`); }}
            >
              {deleteMode && (
                <td style={tdEllipsis} onClick={(e) => e.stopPropagation()}>
                  <Form.Check
                    type="checkbox"
                    checked={selectedIds.includes(part.id)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSelectedIds(prev =>
                        checked ? [...prev, part.id] : prev.filter(id => id !== part.id)
                      );
                    }}
                  />
                </td>
              )}

              {/* 품명(10%) */}
              <td style={tdEllipsis} title={part.part_name} onClick={stop}>
                {inlineEdit ? (
                  <Form.Control
                    size="sm"
                    value={part.part_name || ""}
                    onChange={(e) => onFieldChange(part.id, "part_name", e.target.value)}
                    style={inputEllipsis}
                  />
                ) : part.part_name}
              </td>

              {/* 수량(5%) */}
              <td
                style={tdEllipsis}
                onMouseEnter={() => setHoverRow(part.id)}
                onMouseLeave={() => setHoverRow(null)}
                onClick={stop}
              >
                <div style={{ position: 'relative' }}>
                  {inlineEdit ? (
                    <Form.Control
                      size="sm"
                      type="number"
                      value={part.quantity ?? 0}
                      onChange={(e) => onFieldChange(part.id, "quantity", Number(e.target.value))}
                      style={inputEllipsis}
                    />
                  ) : (
                    <span>{part.quantity ?? 0}</span>
                  )}

                  {/* hover 액션 버튼 (보기모드에서만 표시) */}
                  {!inlineEdit && hoverRow === part.id && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        display: 'flex',
                        gap: 4,
                        background: 'rgba(255,255,255,0.9)',
                        borderRadius: 4,
                      }}
                    >
                      <Button
                        size="sm"
                        variant="outline-success"
                        onClick={(e) => { e.stopPropagation(); openAdjustModal(part, 'in'); }}
                        style={{ height: 24, lineHeight: "20px", padding: "0 6px" }}
                      >
                        입고
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-warning"
                        onClick={(e) => { e.stopPropagation(); openAdjustModal(part, 'out'); }}
                        style={{ height: 24, lineHeight: "20px", padding: "0 6px" }}
                      >
                        출고
                      </Button>
                    </div>
                  )}
                </div>
              </td>

              {/* 위치(5%) */}
              <td style={tdEllipsis} onClick={stop}>
                {inlineEdit ? (
                  <Form.Control
                    size="sm"
                    value={part.location || ""}
                    onChange={(e) => onFieldChange(part.id, "location", e.target.value)}
                    style={inputEllipsis}
                  />
                ) : (part.location ?? '-')}
              </td>

              {/* 설명(15%) */}
              <td style={tdEllipsis} title={part.description || ''} onClick={stop}>
                {inlineEdit ? (
                  <Form.Control
                    size="sm"
                    value={part.description || ""}
                    onChange={(e) => onFieldChange(part.id, "description", e.target.value)}
                    style={inputEllipsis}
                  />
                ) : (part.description || '-')}
              </td>

              {/* Type(5%) */}
              <td style={tdEllipsis} onClick={stop}>
                {inlineEdit ? (
                  <Form.Control
                    size="sm"
                    value={part.mounting_type || ""}
                    onChange={(e) => onFieldChange(part.id, "type", e.target.value)}
                    style={inputEllipsis}
                  />
                ) : (part.mounting_type || '-')}
              </td>

              {/* 패키지(5%) */}
              <td style={tdEllipsis} onClick={stop}>
                {inlineEdit ? (
                  <Form.Control
                    size="sm"
                    value={part.package || ""}
                    onChange={(e) => onFieldChange(part.id, "package", e.target.value)}
                    style={inputEllipsis}
                  />
                ) : (part.package || '-')}
              </td>

              {/* 가격(5%) */}
              <td style={tdEllipsis} onClick={stop}>
                {inlineEdit ? (
                  <Form.Control
                    size="sm" type="number" step="0.01"
                    value={part.price ?? ""}
                    onChange={(e) => onFieldChange(part.id, "price", e.target.value)}
                    style={inputEllipsis}
                  />
                ) : (
                  part.price === null || part.price === undefined ? '-' : Number(part.price).toFixed(2)
                )}
              </td>

              {/* 공급업체(5%) */}
              <td style={tdEllipsis} onClick={stop}>
                {inlineEdit ? (
                  <Form.Control
                    size="sm"
                    value={part.supplier || ""}
                    onChange={(e) => onFieldChange(part.id, "supplier", e.target.value)}
                    style={inputEllipsis}
                  />
                ) : (part.supplier || '-')}
              </td>

              {/* 구매일(10%) */}
              <td style={tdEllipsis} onClick={stop}>
                {inlineEdit ? (
                  <Form.Control
                    size="sm" type="date"
                    value={dateToInput(part.purchase_date)}
                    onChange={(e) => onFieldChange(part.id, "purchase_date", e.target.value)}
                    style={inputEllipsis}
                  />
                ) : (dateToInput(part.purchase_date) || '-')}
              </td>

              {/* 제조사(5%) */}
              <td style={tdEllipsis} onClick={stop}>
                {inlineEdit ? (
                  <Form.Control
                    size="sm"
                    value={part.manufacturer || ""}
                    onChange={(e) => onFieldChange(part.id, "manufacturer", e.target.value)}
                    style={inputEllipsis}
                  />
                ) : (part.manufacturer || '-')}
              </td>

              {/* URL(15%) */}
              <td style={tdEllipsis} title={part.purchase_url || ''} onClick={stop}>
                {inlineEdit ? (
                  <Form.Control
                    size="sm"
                    value={part.purchase_url || ""}
                    onChange={(e) => onFieldChange(part.id, "purchase_url", e.target.value)}
                    style={inputEllipsis}
                  />
                ) : (
                  part.purchase_url
                    ? <a href={part.purchase_url} target="_blank" rel="noreferrer" style={{ ...tdEllipsis, display: 'inline-block', maxWidth: '100%' }}>{part.purchase_url}</a>
                    : '-'
                )}
              </td>

              {/* Memo(10%) */}
              <td style={tdEllipsis} title={part.memo || ''} onClick={stop}>
                {inlineEdit ? (
                  <Form.Control
                    size="sm"
                    value={part.memo || ""}
                    onChange={(e) => onFieldChange(part.id, "memo", e.target.value)}
                    style={inputEllipsis}
                  />
                ) : (part.memo || '-')}
              </td>

              {/* 수정일(5%) */}
              <td style={tdEllipsis}>
                {part.update_date ? part.update_date.split(' ')[0] : '-'}
              </td>

              {inlineEdit && (
                <td style={tdEllipsis} onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="outline-primary" disabled={saving} onClick={() => onSaveRow(part.id)}>
                    {saving ? "..." : <MdSave />}
                  </Button>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
      <Modal show={showAdjModal} onHide={() => setShowAdjModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {adjMode === 'in' ? '입고' : '출고'} — {adjPart?.part_name ?? '부품'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>조정 수량</Form.Label>
              <Form.Control
                type="number"
                min={1}
                step={1}
                value={adjValue}
                onChange={(e) => setAdjValue(Number(e.target.value))}
                placeholder="숫자 입력"
              />
              <Form.Text muted>
                현재 재고: {adjPart ? (adjPart.quantity ?? 0) : '-'} →
                {' '}
                예상 재고: {adjPart ? (Number(adjPart.quantity ?? 0) + (adjMode === 'in' ? Number(adjValue) : -Number(adjValue))) : '-'}
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAdjModal(false)}>취소</Button>
          <Button
            variant={adjMode === 'in' ? 'success' : 'warning'}
            onClick={handleConfirmAdjust}
          >
            확인
          </Button>
        </Modal.Footer>
      </Modal>
    </Table>
  );
};

/** ---------- 메인 페이지 ---------- */
const PartsPage = () => {
  const navigate = useNavigate();
  const [parts, setParts] = useState([]);
  const [viewMode, setViewMode] = useState('list'); // 'grid' | 'list'
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('update_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const partsPerPage = 20;

  const [showUploadModal, setShowUploadModal] = useState(false);
  const handleOpenModal = () => setShowUploadModal(true);
  const handleCloseModal = () => setShowUploadModal(false);

  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [largeCategories, setLargeCategories] = useState([]);
  const [mediumCategories, setMediumCategories] = useState([]);
  const [smallCategories, setSmallCategories] = useState([]);

  const [selectedLarge, setSelectedLarge] = useState('');
  const [selectedMedium, setSelectedMedium] = useState('');
  const [selectedSmall, setSelectedSmall] = useState('');

  const [inlineEdit, setInlineEdit] = useState(false);
  const [dirty, setDirty] = useState({});
  const [savingIds, setSavingIds] = useState(new Set());
  const [isSavingAll, setIsSavingAll] = useState(false);

  const fetchParts = () => {
    fetch(`${SERVER_URL}/api/parts?include=pcbs`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setParts(data);
        } else {
          console.error("서버에서 배열이 아닌 데이터를 받음:", data);
          setParts([]);
        }
      })
      .catch(err => console.error("부품 목록을 불러오는 데 실패했습니다:", err));
  };

  const fetchCategories = () => {
    fetch(`${SERVER_URL}/api/categories/large`)
      .then(res => res.json()).then(d => { if (Array.isArray(d)) setLargeCategories(d); });

    fetch(`${SERVER_URL}/api/categories/medium`)
      .then(res => res.json()).then(d => { if (Array.isArray(d)) setMediumCategories(d); });

    fetch(`${SERVER_URL}/api/categories/small`)
      .then(res => res.json()).then(d => { if (Array.isArray(d)) setSmallCategories(d); });
  };

  useEffect(() => {
    fetchCategories();
    fetchParts();
  }, []);

  const handleFieldChange = (id, key, value) => {
    // 화면 즉시 반영(낙관적 UI)
    setParts(prev => prev.map(p => p.id === id ? { ...p, [key]: value } : p));
    // dirty 누적
    setDirty(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [key]: value }
    }));
  };

  // 추가) 편집 모드를 위한 스냅샷 상태 추가
  const [originalParts, setOriginalParts] = useState({});

  const enterEditMode = () => {
    setDeleteMode(false);
    setSelectedIds([]);
    setInlineEdit(true);

    const snapshot = {};
    parts.forEach(p => { snapshot[p.id] = { ...p }; });
    setOriginalParts(snapshot);
  };

  const saveRow = async (id) => {
    // 확인창 추가
    const ok = window.confirm("변경 사항을 저장하시겠습니까?");
    if (!ok) {
      const orig = originalParts[id];
      if (orig) {
        setParts(prev => prev.map(p => (p.id === id ? { ...orig } : p)));
      }
      setDirty(prev => {
        const cp = { ...prev };
        delete cp[id];
        return cp;
      });
      return;
    }

    const changed = dirty[id];
    if (!changed) return;

    // 현재 화면의 원본(정렬/페이지 네이션 이후 배열에서 찾아 합침)
    const base = parts.find(p => p.id === id);
    if (!base) {
      alert(`행 ${id} 원본을 찾을 수 없습니다.`);
      return;
    }

    // 원본 + 변경분 병합 → 서버가 기대하는 키만 추출
    const merged = { ...base, ...changed };
    const payload = buildPartUpdatePayload(merged);

    try {
      setSavingIds(prev => new Set(prev).add(id));
      const res = await fetch(`${SERVER_URL}/api/parts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // 서버 에러 메시지 확인(디버깅 강화)
        const text = await res.text().catch(() => "");
        throw new Error(`PUT ${res.status} - ${text}`);
      }

      // 성공: dirty 제거
      setDirty(prev => {
        const cp = { ...prev };
        delete cp[id];
        return cp;
      });
      setOriginalParts(prev => ({ ...prev, [id]: { ...merged } }));
    } catch (e) {
      console.error(e);
      alert(`저장 실패(행 ${id}).\n${e.message}`);
      // 서버 상태 신뢰 위해 재조회
      fetchParts();
    } finally {
      setSavingIds(prev => {
        const cp = new Set(prev);
        cp.delete(id);
        return cp;
      });
    }
  };

  const putOnePart = async (id) => {
    const changed = dirty[id];
    if (!changed) return { id, ok: true, skipped: true };

    const base = parts.find(p => p.id === id);
    if (!base) return { id, ok: false, error: "원본 행 없음" };

    const merged = { ...base, ...changed };
    const payload = buildPartUpdatePayload(merged);

    // 디버깅 원하면:
    // console.log("[PUT payload:all]", id, payload);

    const res = await fetch(`${SERVER_URL}/api/parts/${id}`, {
      method: "PUT",         // 서버가 부분 업데이트면 "PATCH"로 바꿔 테스트
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`PUT ${res.status} - ${text}`);
    }
    return { id, ok: true };
  };


  const saveAll = async () => {
    const ids = Object.keys(dirty);
    if (!ids.length) {
      alert("저장할 변경사항이 없습니다.");
      return;
    }

    const ok = window.confirm(`변경된 ${ids.length}개 행을 저장하시겠습니까?`);
    if (!ok) {
      return;
    }

    if (isSavingAll) return;

    try {
      setIsSavingAll(true);
      // UI에서 각 행을 저장중 표시
      setSavingIds(prev => {
        const s = new Set(prev);
        ids.forEach(id => s.add(Number(id)));
        return s;
      });

      // 병렬 저장(너무 많으면 chunk 처리도 가능)
      const results = await Promise.allSettled(ids.map(id => putOnePart(Number(id))));

      // 집계
      const successIds = [];
      const failMsgs = [];
      results.forEach((r, idx) => {
        const id = Number(ids[idx]);
        if (r.status === "fulfilled" && r.value?.ok) {
          successIds.push(id);
        } else {
          const msg = r.status === "rejected" ? r.reason?.message : (r.value?.error || "알 수 없는 오류");
          failMsgs.push(`행 ${id}: ${msg}`);
        }
      });
      if (successIds.length) {
        setDirty(prev => {
          const cp = { ...prev };
          successIds.forEach(id => delete cp[id]);
          return cp;
        });
      }
      setSavingIds(prev => {
        const cp = new Set(prev);
        ids.forEach(id => cp.delete(Number(id)));
        return cp;
      });

      // 서버 기준 최신화(정렬/시간 반영)
      await fetchParts();

      // 결과 안내
      if (failMsgs.length) {
        alert(`일부 저장 실패 (${failMsgs.length}/${ids.length})\n\n` + failMsgs.slice(0, 10).join("\n"));
      } else {
        alert(`변경사항 저장 완료 (${ids.length}개)`);
      }
    } catch (e) {
      console.error(e);
      alert("전체 저장 중 치명적 오류가 발생했습니다.\n" + (e?.message || ""));
      // 안전하게 재동기화
      fetchParts();
    } finally {
      setIsSavingAll(false);
    }
  };

  const exitEditMode = async () => {
    const ids = Object.keys(dirty);
    if (ids.length === 0) {
      // 변경된 게 없으면 그냥 나가기
      setInlineEdit(false);
      setDirty({});
      setSavingIds(new Set());
      fetchParts();
      return;
    }

    // 변경된 게 있으면 확인
    const save = window.confirm(`변경된 ${ids.length}개 행이 있습니다. 저장하시겠습니까?`);

    if (save) {
      try {
        await saveAll();
        setInlineEdit(false);
        setDirty({});
        setSavingIds(new Set());
        fetchParts();
      } catch (e) {
        console.error(e);
        alert("저장 중 오류가 발생했습니다. 편집 모드를 유지합니다.");
      }
      return;
    }

    // 저장 안 하겠다고 하면
    const discard = window.confirm("저장되지 않은 정보는 사라집니다. 정말 종료하시겠습니까?");
    if (discard) {
      // 스냅샷 원복이 있으면 그걸 쓰고, 아니면 서버 재조회
      fetchParts();
      setInlineEdit(false);
      setDirty({});
      setSavingIds(new Set());
    }
  };

  const toggleDeleteMode = () => {
    if (!deleteMode) {
      exitEditMode();
      setSelectedIds([]);
    } else {
      setSelectedIds([]);
    }
    setDeleteMode(prev => !prev);
  };

  // 검색/필터
  const filteredParts = parts.filter(part => {
    const nameOk = (part.part_name || '').toLowerCase().includes(search.toLowerCase());
    const largeOk = !selectedLarge || part.category_large === selectedLarge;
    const mediumOk = !selectedMedium || part.category_medium === selectedMedium;
    const smallOk = !selectedSmall || part.category_small === selectedSmall;
    return nameOk && largeOk && mediumOk && smallOk;
  });

  // 정렬
  const sortedParts = [...filteredParts].sort((a, b) => {
    const fieldA = a[sortField];
    const fieldB = b[sortField];
    if (fieldA == null) return 1;
    if (fieldB == null) return -1;
    if (sortField === 'part_name') {
      const A = String(fieldA).toLowerCase();
      const B = String(fieldB).toLowerCase();
      return sortOrder === 'asc' ? (A > B ? 1 : A < B ? -1 : 0) : (A < B ? 1 : A > B ? -1 : 0);
    }
    return sortOrder === 'asc'
      ? (fieldA > fieldB ? 1 : fieldA < fieldB ? -1 : 0)
      : (fieldA < fieldB ? 1 : fieldA > fieldB ? -1 : 0);
  });

  // 페이지네이션
  const paginatedParts = sortedParts.slice(
    (currentPage - 1) * partsPerPage,
    currentPage * partsPerPage
  );
  const totalPages = Math.ceil(filteredParts.length / partsPerPage);

  // 삭제
  const handleDeleteSelected = () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`선택한 ${selectedIds.length}개의 부품을 삭제하시겠습니까?`)) return;

    fetch(`${SERVER_URL}/api/parts`, {
      method: "DELETE",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds })
    })
      .then(async (res) => {
        // 백엔드 메시지 그대로 전달
        if (!res.ok) {
          // json이든 text든 그대로 꺼내서 보여줌
          const ct = res.headers.get('content-type') || '';
          const body = ct.includes('application/json') ? await res.json() : await res.text();
          const msg = typeof body === 'string' ? body : (body.error ?? JSON.stringify(body));
          alert(msg);
          throw new Error(msg); // 이후 then 체인 중단
        }
        return res.json();
      })
      .then(() => {
        const remaining = filteredParts.length - selectedIds.length;
        const newTotalPages = Math.ceil(remaining / partsPerPage);
        const newPage = Math.min(currentPage, newTotalPages || 1);

        setCurrentPage(newPage);
        setSelectedIds([]);
        setDeleteMode(false);
        fetchParts();
        fetchCategories();
      })
      .catch(() => { /* alert 이미 했으니 추가 처리 없음 */ });
  };

  const handleDeleteAllFiltered = () => {
    const idsToDelete = filteredParts.map(p => p.id);
    if (!idsToDelete.length) return;
    if (!window.confirm(`현재 필터링된 ${idsToDelete.length}개의 부품을 모두 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;

    fetch(`${SERVER_URL}/api/parts`, {
      method: "DELETE",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: idsToDelete })
    })
      .then(async (res) => {
        if (!res.ok) {
          const ct = res.headers.get('content-type') || '';
          const body = ct.includes('application/json') ? await res.json() : await res.text();
          const msg = typeof body === 'string' ? body : (body.error ?? JSON.stringify(body));
          alert(msg);
          throw new Error(msg);
        }
        return res.json();
      })
      .then(() => {
        fetchParts();
        setSelectedIds([]);
        setDeleteMode(false);
      })
      .catch(() => { });
  };
  // 페이지 번호 계산(… 포함)
  const visiblePageRange = 2;
  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages ||
      (i >= currentPage - visiblePageRange && i <= currentPage + visiblePageRange)) {
      pageNumbers.push(i);
    } else if ((i === currentPage - visiblePageRange - 1) || (i === currentPage + visiblePageRange + 1)) {
      pageNumbers.push('ellipsis');
    }
  }

  // 현재 페이지 전체선택/해제
  const toggleSelectAllCurrentPage = (checked) => {
    const currentPageIds = paginatedParts.map(p => p.id);
    setSelectedIds(prev =>
      checked
        ? Array.from(new Set([...prev, ...currentPageIds]))
        : prev.filter(id => !currentPageIds.includes(id))
    );
  };

  return (
    <div className="content-wrapper">
      <Row className="d-flex justify-content-between align-items-center mb-3">
        <Col xs="auto" className="d-flex gap-2 align-items-center">
          <ToggleButtonGroup type="radio" name="viewMode" value={viewMode} onChange={setViewMode}>
            <ToggleButton id="grid" value="grid" variant="outline-secondary"><FiGrid /></ToggleButton>
            <ToggleButton id="list" value="list" variant="outline-secondary"><FiList /></ToggleButton>
          </ToggleButtonGroup>
          {!inlineEdit ? (
            <Button variant="outline-primary" onClick={enterEditMode} disabled={deleteMode}>
              <MdOutlineEdit /> 편집
            </Button>
          ) : (
            <>
              <Button variant="outline-secondary" onClick={exitEditMode}>
                <MdOutlineCancel />
              </Button>
              <Button variant="primary" onClick={saveAll} disabled={!Object.keys(dirty).length}>
                변경사항 저장
              </Button>
            </>
          )}
        </Col>

        <Col xs="auto" className="d-flex gap-2">

          {deleteMode && (
            <Col className="d-flex justify-content-center gap-3 align-items-center">
              <Form.Check
                type="checkbox"
                id="select-all"
                className="mt-1"
                checked={paginatedParts.length > 0 && paginatedParts.every(p => selectedIds.includes(p.id))}
                onChange={(e) => toggleSelectAllCurrentPage(e.target.checked)}
              />
              <Button variant="danger" onClick={handleDeleteSelected} disabled={selectedIds.length === 0}>
                선택 삭제
              </Button>
              <Button variant="outline-danger" onClick={handleDeleteAllFiltered}>
                전체 삭제
              </Button>
            </Col>
          )}
          <Button
            variant={deleteMode ? "outline-danger" : "danger"}
            onClick={toggleDeleteMode}
            disabled={inlineEdit}
          >
            {deleteMode ? <MdOutlineCancel /> : <FiTrash2 />}
          </Button>
        </Col>
      </Row>

      {/* 검색/정렬 */}
      <Row className="g-2 d-flex justify-content-between align-items-center mb-2 border-bottom pb-2">
        <Col className="d-flex flex-row gap-3" md={8}>
          <Form.Control
            placeholder="검색어를 입력하세요"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          />
          <Button onClick={handleOpenModal}><MdOutlineAdd /></Button>
        </Col>
        <Col md={3}>
          <InputGroup>
            <Form.Select value={sortField} onChange={(e) => setSortField(e.target.value)}>
              <option value="update_date">수정일</option>
              <option value="part_name">이름</option>
              <option value="quantity">수량</option>
            </Form.Select>
            <Button
              variant="outline-secondary"
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              title="정렬 방향 전환"
            >
              {sortOrder === 'asc' ? '▲' : '▼'}
            </Button>
          </InputGroup>
        </Col>
      </Row>

      {/* 카테고리 필터 */}
      <Row className="mb-2 mt-4">
        <Col md={4}>
          <Form.Select value={selectedLarge} onChange={(e) => { setSelectedLarge(e.target.value); setCurrentPage(1); }}>
            <option value="">대분류 선택</option>
            {largeCategories.map((cat, idx) => (<option key={idx} value={cat}>{cat}</option>))}
          </Form.Select>
        </Col>
        <Col md={4}>
          <Form.Select value={selectedMedium} onChange={(e) => { setSelectedMedium(e.target.value); setCurrentPage(1); }}>
            <option value="">중분류 선택</option>
            {mediumCategories.map((cat, idx) => (<option key={idx} value={cat}>{cat}</option>))}
          </Form.Select>
        </Col>
        <Col md={4}>
          <Form.Select value={selectedSmall} onChange={(e) => { setSelectedSmall(e.target.value); setCurrentPage(1); }}>
            <option value="">소분류 선택</option>
            {smallCategories.map((cat, idx) => (<option key={idx} value={cat}>{cat}</option>))}
          </Form.Select>
        </Col>
      </Row>

      {/* 뷰 분기 */}
      {viewMode === 'grid' ? (
        <GridView
          parts={paginatedParts}
          navigate={navigate}
          deleteMode={deleteMode}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          inlineEdit={inlineEdit}
          onFieldChange={handleFieldChange}
          onSaveRow={saveRow}
          savingIds={savingIds}
        />
      ) : (
        <ListView
          parts={paginatedParts}
          navigate={navigate}
          deleteMode={deleteMode}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          inlineEdit={inlineEdit}
          onFieldChange={handleFieldChange}
          onSaveRow={saveRow}
          savingIds={savingIds}
        />
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <Row>
          <Col className="d-flex justify-content-center mt-3">
            <Pagination>
              {pageNumbers.map((num, idx) =>
                num === 'ellipsis' ? (
                  <Pagination.Ellipsis key={`ellipsis-${idx}`} disabled />
                ) : (
                  <Pagination.Item
                    key={num}
                    active={num === currentPage}
                    onClick={() => setCurrentPage(num)}
                  >
                    {num}
                  </Pagination.Item>
                )
              )}
            </Pagination>
          </Col>
        </Row>
      )}

      {/* 업로드 모달 */}
      <UploadPart
        show={showUploadModal}
        handleClose={handleCloseModal}
        onPartAdded={() => {
          fetchParts();
          fetchCategories();
        }}
        presetName={search}
      />
    </div>
  );
};

export default PartsPage;
