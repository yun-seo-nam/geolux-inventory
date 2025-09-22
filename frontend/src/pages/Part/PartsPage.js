// src/pages/Part/PartsPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Row, Col, Form, Card, Pagination, ToggleButtonGroup, ToggleButton,
  Button, InputGroup, Table
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

  const payload = {
    part_name: str(src.part_name),
    quantity: num(src.quantity, 0),
    // category_medium: str(src.category_medium),
    // category_small: str(src.category_small),
    // mounting_type: str(src.mounting_type),
    location: str(src.location),
    // memo: str(src.memo),
    description: str(src.description),
    // package: str(src.package),
    // value: str(src.value),
    // manufacturer: str(src.manufacturer),
    // price: src.price === undefined || src.price === null ? null : num(src.price),
    // purchase_url: str(src.purchase_url),
  };

  Object.keys(payload).forEach(k => {
    if (payload[k] === undefined) delete payload[k];
  });
  return payload;
};


/** ---------- 분리된 뷰: GridView (카드형) ---------- */
const GridView = ({
  parts, navigate, deleteMode, selectedIds, setSelectedIds,
  // 인라인 편집용
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

/** ---------- 분리된 뷰: ListView (표형) ---------- */
const ListView = ({
  parts, navigate, deleteMode, selectedIds, setSelectedIds,
  inlineEdit, onFieldChange, onSaveRow, savingIds
}) => {
  return (
    <Table striped bordered hover size="sm" responsive>
      <thead>
        <tr>
          {deleteMode && <th style={{ width: 56 }}>선택</th>}
          <th>품명</th>
          <th style={{ width: 90 }}>수량</th>
          <th style={{ width: 120 }}>위치</th>
          <th>설명</th>
          <th style={{ width: 120 }}>수정일</th>
          {inlineEdit && <th style={{ width: 90 }}>저장</th>}
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
                <td onClick={(e) => e.stopPropagation()}>
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

              {/* 품명 */}
              <td title={part.part_name} onClick={(e) => inlineEdit && e.stopPropagation()}>
                {inlineEdit ? (
                  <Form.Control
                    size="sm"
                    value={part.part_name || ""}
                    onChange={(e) => onFieldChange(part.id, "part_name", e.target.value)}
                  />
                ) : (
                  part.part_name
                )}
              </td>

              {/* 수량 */}
              <td onClick={(e) => inlineEdit && e.stopPropagation()}>
                {inlineEdit ? (
                  <Form.Control
                    size="sm"
                    type="number"
                    value={part.quantity ?? 0}
                    onChange={(e) => onFieldChange(part.id, "quantity", Number(e.target.value))}
                  />
                ) : (
                  part.quantity ?? 0
                )}
              </td>

              {/* 위치 */}
              <td onClick={(e) => inlineEdit && e.stopPropagation()}>
                {inlineEdit ? (
                  <Form.Control
                    size="sm"
                    value={part.location || ""}
                    onChange={(e) => onFieldChange(part.id, "location", e.target.value)}
                  />
                ) : (
                  part.location ?? '-'
                )}
              </td>

              {/* 설명 */}
              <td className="text-truncate" style={{ maxWidth: 480 }} title={part.description || ''} onClick={(e) => inlineEdit && e.stopPropagation()}>
                {inlineEdit ? (
                  <Form.Control
                    size="sm"
                    value={part.description || ""}
                    onChange={(e) => onFieldChange(part.id, "description", e.target.value)}
                  />
                ) : (
                  part.description || '-'
                )}
              </td>

              {/* 수정일 */}
              <td>{part.update_date ? part.update_date.split(' ')[0] : '-'}</td>

              {/* 저장 버튼(행 단위) */}
              {inlineEdit && (
                <td onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline-primary"
                    disabled={saving}
                    onClick={() => onSaveRow(part.id)}
                  >
                    {saving ? "..." : <MdSave />}
                  </Button>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
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

  const saveRow = async (id) => {
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
    if (isSavingAll) return; // 중복 방지
    const ids = Object.keys(dirty);
    if (!ids.length) {
      alert("저장할 변경사항이 없습니다.");
      return;
    }

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

      // 성공한 것들은 dirty에서 제거
      if (successIds.length) {
        setDirty(prev => {
          const cp = { ...prev };
          successIds.forEach(id => delete cp[id]);
          return cp;
        });
      }

      // 저장표시 해제
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

  // 모드 토글 헬퍼
  const enterEditMode = () => {
    setDeleteMode(false);
    setSelectedIds([]);
    setInlineEdit(true);
  };

  const exitEditMode = () => {
    setInlineEdit(false);
    setDirty({});
    setSavingIds(new Set());
    fetchParts()
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
      .then(res => res.json())
      .then(() => {
        const remaining = filteredParts.length - selectedIds.length;
        const newTotalPages = Math.ceil(remaining / partsPerPage);
        const newPage = Math.min(currentPage, newTotalPages || 1);

        setCurrentPage(newPage);
        setSelectedIds([]);
        setDeleteMode(false);
        fetchParts();
        fetchCategories();
      });
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
      .then(res => res.json())
      .then(() => {
        fetchParts();
        setSelectedIds([]);
        setDeleteMode(false);
      });
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
              <Button variant="primary" onClick={saveAll} disabled={!Object.keys(dirty).length}>
                <MdSave /> 변경사항 저장
              </Button>
              <Button variant="outline-secondary" onClick={exitEditMode}>
                <MdOutlineCancel /> 취소
              </Button>
            </>
          )}
        </Col>

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

        <Col xs="auto" className="d-flex gap-2">
          <Button
            variant={deleteMode ? "danger" : "outline-danger"}
            onClick={toggleDeleteMode}
            disabled={inlineEdit}
          >
            {deleteMode ? <MdOutlineCancel /> : <FiTrash2 />}
          </Button>
          <Button onClick={handleOpenModal}><MdOutlineAdd /></Button>
        </Col>
      </Row>

      {/* 검색/정렬 */}
      <Row className="g-2 d-flex justify-content-between align-items-center mb-2 border-bottom pb-2">
        <Col md={8}>
          <Form.Control
            placeholder="검색어를 입력하세요"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          />
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
      />
    </div>
  );
};

export default PartsPage;
