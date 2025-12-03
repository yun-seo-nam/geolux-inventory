import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Card, Table, Row, Col, Button, Spinner, Form, InputGroup, Badge, Modal } from "react-bootstrap";
import { FiEdit, FiTrash2, FiSave, FiX } from "react-icons/fi";
import { FaSearch } from "react-icons/fa";

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:8000";

async function req(path, opts = {}) {
  const res = await fetch(`${SERVER_URL}${path}`, opts);
  if (!res.ok) {
    let msg;
    try { msg = (await res.json()).error || await res.text(); }
    catch { msg = await res.text(); }
    throw new Error(msg || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

/* ---- API ---- */
const api = {
  searchAliases: (q = "", limit = 100, offset = 0) =>
    req(`/api/aliases/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`),

  getLinks: (aliasId) => req(`/api/aliases/${aliasId}/links`),
  createAlias: (alias_name) =>
    req(`/api/aliases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alias_name: (alias_name || "").trim() })
    }),
  updateAlias: (aliasId, alias_name) =>
    req(`/api/aliases/${aliasId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alias_name: (alias_name || "").trim() })
    }),
  deleteAlias: (aliasId) => req(`/api/aliases/${aliasId}`, { method: "DELETE" }),
  addLink: (aliasId, part_id) =>
    req(`/api/aliases/${aliasId}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ part_id })
    }),
  deleteLink: (linkId) => req(`/api/aliases/links/${linkId}`, { method: "DELETE" }),

  listParts: () => req(`/api/parts`),

  createPart: ({ part_name, quantity = 0 }) =>
    req(`/api/parts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ part_name, quantity })
    }),
};

/* ---- helpers ---- */
const getPartId = (obj) => obj?.part_id ?? obj?.id ?? obj?.partId ?? null;

const findPartIdByName = async (name) => {
  const rows = await api.listParts();
  const key = (name || "").trim().toLowerCase();
  const hit = (rows || []).find(p => (p.part_name || "").trim().toLowerCase() === key);
  return hit ? getPartId(hit) : null;
};

export default function AliasManager() {
  // 좌측 목록
  const [q, setQ] = useState("");
  const [list, setList] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listErr, setListErr] = useState("");

  const [hoveredRow, setHoveredRow] = useState(null);

  // 선택 alias
  const [selId, setSelId] = useState(null);
  const [selName, setSelName] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState("");
  const [links, setLinks] = useState([]);

  // 링크 선택(우측 테이블)
  const [picks, setPicks] = useState(new Set());
  const pickedIds = useMemo(() => Array.from(picks), [picks]);
  const togglePick = (id) => {
    const nx = new Set(picks);
    nx.has(id) ? nx.delete(id) : nx.add(id);
    setPicks(nx);
  };

  // 모달(부품 선택/검색)
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [allParts, setAllParts] = useState([]);
  const [modalPicked, setModalPicked] = useState(new Set());
  const modalPickedIds = useMemo(() => Array.from(modalPicked), [modalPicked]);
  const toggleModalPick = (id) => {
    const nx = new Set(modalPicked);
    nx.has(id) ? nx.delete(id) : nx.add(id);
    setModalPicked(nx);
  };
  const filteredModalParts = useMemo(() => {
    const s = (searchTerm || "").toLowerCase();
    return (allParts || []).filter(p => (p.part_name || "").toLowerCase().includes(s));
  }, [allParts, searchTerm]);

  // 새 alias & 편집
  const [newAlias, setNewAlias] = useState("");
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");

  // 새 부품 입력값 (수량은 선택 사항)
  const [newPartName, setNewPartName] = useState("");
  const [newPartQty, setNewPartQty] = useState(0);

  // 목록 로드
  const refreshList = useCallback(async () => {
    setListLoading(true); setListErr("");
    try {
      const rows = await api.searchAliases(q);
      setList(rows || []);
    } catch (e) { setListErr(e?.message || "목록 로드 실패"); }
    finally { setListLoading(false); }
  }, [q]);

  useEffect(() => { refreshList(); }, [refreshList]);

  // 상세 로드
  const loadDetail = useCallback(async (id, name) => {
    if (!id) { setLinks([]); setSelId(null); setSelName(""); return; }
    setDetailLoading(true); setDetailErr("");
    try {
      const rows = await api.getLinks(id);
      const mapped = (rows || []).map(r => ({
        link_id: r.id ?? r.link_id ?? r.linkId,
        part_id: r.part_id,
        part_name: r.part_name,
        quantity: r.quantity ?? 0,
      }));
      setLinks(mapped);
      setSelId(id);
      setSelName((name || "").toUpperCase());
      setPicks(new Set());
      setEditing(false);
      setEditVal((name || "").toUpperCase());
    } catch (e) { setDetailErr(e?.message || "상세 로드 실패"); }
    finally { setDetailLoading(false); }
  }, []);

  // 모달 열릴 때 parts 로드
  useEffect(() => {
    if (!showSearchModal) return;
    let alive = true;
    (async () => {
      try {
        const rows = await api.listParts();
        if (!alive) return;
        setAllParts(rows || []);
      } catch { setAllParts([]); }
    })();
    return () => { alive = false; };
  }, [showSearchModal]);

  useEffect(() => {
    if ((allParts || []).length > 0) return;
    let alive = true;
    (async () => {
      try {
        const rows = await api.listParts();
        if (!alive) return;
        setAllParts(rows || []);
      } catch { }
    })();
    return () => { alive = false; };
  }, [allParts]);

  // 새 alias 생성
  const handleCreateAlias = async () => {
    const s = (newAlias || "").trim();
    if (!s) return;
    try {
      const created = await api.createAlias(s);
      setNewAlias("");
      await refreshList();
      await loadDetail(created.id, created.alias_name);
    } catch (e) { alert(e?.message || "생성 실패"); }
  };

  // alias 이름 수정
  const handleRename = async () => {
    const s = (editVal || "").trim();
    if (!selId || !s) return;
    try {
      await api.updateAlias(selId, s);
      await refreshList();
      await loadDetail(selId, s);
      setEditing(false);
    } catch (e) { alert(e?.message || "수정 실패"); }
  };

  const handleDeleteAlias = async (targetId, targetName, e) => {
    if (e) e.stopPropagation();

    if (!window.confirm(`'${targetName}'을(를) 삭제하시겠습니까?\n연결된 모든 링크도 함께 삭제됩니다.`)) return;

    try {
      await api.deleteAlias(targetId);

      if (selId === targetId) {
        setSelId(null);
        setSelName("");
        setLinks([]);
        setPicks(new Set());
      }

      await refreshList();
    } catch (e) { alert(e?.message || "삭제 실패"); }
  };

  // 링크 삭제
  const handleDeleteLinks = async () => {
    if (!selId || pickedIds.length === 0) return;
    try {
      for (const row of links) {
        if (picks.has(row.part_id) && row.link_id) {
          try { await api.deleteLink(row.link_id); } catch (e) { console.error("삭제 실패:", e); }
        }
      }
      await loadDetail(selId, selName);
      setPicks(new Set());
    } catch { alert("해제 실패"); }
  };

  // ===== 핵심: 단일 입력 → (없으면) 생성 후 addLink + (있으면) 기존 part에 addLink =====
  const handleCreatePartAndLink = async () => {
    const name = (searchTerm || newPartName || "").trim();
    const qty = Number(newPartQty) || 0;

    if (!selId) return alert("먼저 좌측에서 Alias를 선택하세요.");
    if (!name) return alert("부품명을 입력하세요.");

    try {
      let pid = null;

      // 1) 생성 시도 (실패해도 중단하지 않음)
      try {
        const created = await api.createPart({ part_name: name, quantity: qty });
        pid = getPartId(created);
      } catch (e) {
        console.warn("createPart 실패, 기존 part 탐색으로 전환:", e?.message || e);
      }

      // 2) pid 없으면 기존 part 탐색
      if (!pid) {
        pid = await findPartIdByName(name);
        if (!pid) throw new Error("부품을 생성하거나 찾지 못했습니다.");
      }

      // 3) 이미 링크된 경우 스킵, 아니면 링크 추가
      const linked = new Set((links || []).map(r => r.part_id));
      if (!linked.has(pid)) {
        await api.addLink(selId, pid);
      }

      // 4) 갱신 + 입력 초기화
      const rows = await api.listParts();
      setAllParts(rows || []);
      await loadDetail(selId, selName);
      setNewPartName("");
      setNewPartQty(0);
      setSearchTerm("");

      alert("부품 생성/기존 확인 후 링크 완료");
    } catch (e) {
      console.error(e);
      alert(e?.message || "부품 추가 또는 연결에 실패했습니다.");
    }
  };

  // ==== 좌측 footer의 alias 자동완성 드롭다운 ====
  const [aliasDropdownOpen, setAliasDropdownOpen] = useState(false);
  const filteredPartsForAlias = useMemo(() => {
    const s = (newAlias || "").toLowerCase();
    return (allParts || []).filter(p => (p.part_name || "").toLowerCase().includes(s));
  }, [allParts, newAlias]);

  const pickAliasFromPart = (name) => {
    setNewAlias((name || "").toUpperCase());
    setAliasDropdownOpen(false);
  };

  const aliasBoxRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(e) {
      if (aliasBoxRef.current && !aliasBoxRef.current.contains(e.target)) {
        setAliasDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="content-wrapper">
      <Row>
        {/* 좌측: Alias 목록 */}
        <Col md={4}>
          <Card className="shadow-sm mb-3">
            <Card.Header className="d-flex align-items-center gap-4">
              <strong className="fs-7 text-nowrap">대표부품</strong>|
              <Form.Control
                size="sm"
                placeholder="검색(대소문자 무시)"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </Card.Header>
            <Card.Body style={{ maxHeight: '70vh', overflowY: 'auto', padding: 0 }}>
              {listLoading && <div className="p-3 text-muted"><Spinner size="sm" /> 불러오는 중…</div>}
              {listErr && <div className="p-2 text-danger">{listErr}</div>}
              <Table hover size="sm" className="mb-0">
                <thead className="table-light position-sticky top-0">
                  <tr>
                    <th className="px-5">대표부품 리스트</th>
                  </tr>
                </thead>
                <tbody>
                  {(list || []).map(a => (
                    <tr key={a.id}
                      onClick={() => loadDetail(a.id, a.alias_name)}
                      onMouseEnter={() => setHoveredRow(a.id)} // 마우스 올림
                      onMouseLeave={() => setHoveredRow(null)} // 마우스 떠남
                      style={{ cursor: 'pointer', background: selId === a.id ? '#eef6ff' : '' }}>

                      <td className="px-3">
                        <div className="d-flex justify-content-between align-items-center">
                          {/* 텍스트 */}
                          <span>{a.alias_name}</span>

                          {/* Hover 시에만 보이는 삭제 버튼 */}
                          {hoveredRow === a.id && (
                            <Button
                              size="sm"
                              variant="outline-danger"
                              style={{ padding: '0px 6px', fontSize: '0.7rem' }}
                              onClick={(e) => handleDeleteAlias(a.id, a.alias_name, e)}
                            >
                              <FiTrash2 />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!listLoading && (!list || list.length === 0) && (
                    <tr><td colSpan={2} className="text-center text-muted p-3">결과 없음</td></tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
            <Card.Footer>
              <div className="position-relative" ref={aliasBoxRef}>
                <InputGroup size="sm">
                  <Form.Control
                    placeholder="새 대표부품 (New Representative Parts)"
                    value={newAlias}
                    onChange={(e) => { setNewAlias((e.target.value || "")); setAliasDropdownOpen(true); }}
                    onFocus={() => setAliasDropdownOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateAlias();
                      if (e.key === 'Escape') setAliasDropdownOpen(false);
                    }}
                  />
                  <Button size="sm" onClick={handleCreateAlias}>추가</Button>
                </InputGroup>

                {aliasDropdownOpen && filteredPartsForAlias.length > 0 && (
                  <div className="bg-white border rounded mt-1 shadow-sm"
                    style={{ position: 'absolute', left: 0, right: 0, zIndex: 1050, maxHeight: '40vh', overflowY: 'auto' }}>
                    <Table striped hover size="sm" className="mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>부품명</th>
                          <th style={{ width: 120 }}>재고</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPartsForAlias.map(p => (
                          <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => pickAliasFromPart(p.part_name)}>
                            <td>{p.part_name}</td>
                            <td>{p.quantity ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </div>
            </Card.Footer>
          </Card>
        </Col>

        {/* 우측: 상세 */}
        <Col md={8}>
          <Card className="shadow-sm mb-3">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-2">
                <Badge bg="secondary">대표부품</Badge>
                {editing ? (
                  <>
                    <Form.Control
                      size="sm"
                      style={{ width: 280 }}
                      value={editVal}
                      onChange={(e) => setEditVal((e.target.value || ""))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); }}
                    />
                    <Button size="sm" variant="success" onClick={handleRename}><FiSave /></Button>
                    <Button size="sm" variant="secondary" onClick={() => { setEditing(false); setEditVal(selName); }}><FiX /></Button>
                  </>
                ) : (
                  <>
                    <Form.Control size="sm" style={{ width: 280 }} value={selName} readOnly />
                    <Button size="sm" variant="outline-primary" onClick={() => { if (selId) { setEditing(true); setEditVal(selName); } }} disabled={!selId}><FiEdit /></Button>
                  </>
                )}
              </div>
            </Card.Header>

            <Card.Body>
              {detailLoading && <div><Spinner size="sm" /> 불러오는 중…</div>}
              {detailErr && <div className="text-danger">{detailErr}</div>}

              {selId && !detailLoading && (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0">대체 가능한 부품 (Alternative Parts)</h6>
                    <div className="d-flex gap-2">
                      <Button size="sm" variant="secondary"
                        onClick={() => { setShowSearchModal(true); setSearchTerm(""); setModalPicked(new Set()); }}
                        disabled={!selId}>
                        <FaSearch /> 부품 선택/연결
                      </Button>
                      <Button size="sm" variant="outline-danger" disabled={!pickedIds.length} onClick={handleDeleteLinks}>
                        선택 해제
                      </Button>
                    </div>
                  </div>

                  <Table bordered hover size="sm" className="mb-2">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}></th>
                        <th>part_name</th>
                        <th style={{ width: 90 }}>재고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(links || []).map(lp => (
                        <tr key={lp.part_id} onClick={() => togglePick(lp.part_id)}>
                          <td className="text-center">
                            <Form.Check
                              type="checkbox"
                              checked={picks.has(lp.part_id)}
                              onChange={(e) => { e.stopPropagation(); togglePick(lp.part_id); }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td>{lp.part_name}</td>
                          <td>{lp.quantity}</td>
                        </tr>
                      ))}
                      {(!links || links.length === 0) && (
                        <tr><td colSpan={4} className="text-center text-muted">연결된 부품 없음</td></tr>
                      )}
                    </tbody>
                  </Table>
                </>
              )}

              {!selId && !detailLoading && (
                <div className="text-muted">좌측에서 대표부품을 선택하거나 새로 추가하세요.</div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Modal show={showSearchModal} onHide={() => setShowSearchModal(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>부품 선택/검색/입력</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Control
            className="mb-3"
            placeholder="부품명 입력 (Enter: 없으면 생성+링크 / 있으면 바로 링크)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreatePartAndLink();
              }
            }}
          />
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th style={{ width: 36 }}></th>
                  <th>부품명</th>
                  <th style={{ width: 120 }}>재고</th>
                </tr>
              </thead>
              <tbody>
                {filteredModalParts.map(p => (
                  <tr key={p.id} onClick={() => toggleModalPick(p.id)}>
                    <td className="text-center">
                      <Form.Check
                        type="checkbox"
                        checked={modalPicked.has(p.id)}
                        onChange={(e) => { e.stopPropagation(); toggleModalPick(p.id); }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td>{p.part_name}</td>
                    <td>{p.quantity ?? 0}</td>
                  </tr>
                ))}
                {filteredModalParts.length === 0 && (


                  <tr><td colSpan={3} className="text-center text-muted">결과 없음</td></tr>
                )}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSearchModal(false)}>닫기</Button>
          <Button variant="primary" onClick={async () => {
            if (!selId || modalPickedIds.length === 0) return;
            try {
              const linked = new Set((links || []).map(r => r.part_id));
              for (const pid of modalPickedIds) {
                if (linked.has(pid)) continue;
                try {
                  await api.addLink(selId, pid);
                } catch (e) {
                  alert(e.message); // 서버 에러 메시지 표시
                }
              }
              await loadDetail(selId, selName);
              setShowSearchModal(false);
              setModalPicked(new Set());
              setSearchTerm("");
            } catch (e) { alert("연결 실패"); }
          }} disabled={!selId || modalPickedIds.length === 0}>선택 연결</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
