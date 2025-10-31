import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Form, Card, Pagination, Button, InputGroup, Modal, Badge, Table } from 'react-bootstrap';
import { FiGrid, FiList, FiTrash2 } from 'react-icons/fi';
import { MdOutlineAdd, MdOutlineCancel } from "react-icons/md";

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:8000";

const formatDate = (s) => (!s ? '날짜 없음' : (s.includes('T') ? s.split('T')[0] : s.split(' ')[0]));

const BOMPage = () => {
  const navigate = useNavigate();
  const [assemblies, setAssemblies] = useState([]);
  const [viewMode, setViewMode] = useState('list');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('update_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const assembliesPerPage = 30;
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [csvFile, setCsvFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [newAssemblyName, setNewAssemblyName] = useState('');
  const [assemblyAmount, setAssemblyAmount] = useState('');
  const [creating, setCreating] = useState(false);

  const [statusFilter, setStatusFilter] = useState('');

  const fetchAssemblies = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/assemblies`);
      const base = await res.json();
      const list = Array.isArray(base) ? base : [];

      // /detail 응답과 병합해서 update_date 확정
      const details = await Promise.all(
        list.map(a =>
          fetch(`${SERVER_URL}/api/assemblies/${a.id}/detail`)
            .then(r => (r.ok ? r.json() : null))
            .catch(() => null)
        )
      );

      const merged = list.map((a, i) => {
        const d = details[i]?.assembly;
        return {
          ...a,
          update_date: d?.update_date ?? a.update_date ?? null,
          create_date: d?.create_date ?? a.create_date ?? null,
          status: d?.status ?? a.status ?? 'Planned',
          quantity_to_build: a.quantity_to_build ?? d?.quantity_to_build ?? 0,
          image_url: a.image_url
            ?? (d?.image_filename ? `${SERVER_URL}/static/images/assemblies/${d.image_filename}` : null),
        };
      });

      setAssemblies(merged);
    } catch (e) {
      console.error("어셈블리 목록 불러오기 실패:", e);
      setAssemblies([]);
    }
  };

  useEffect(() => {
    fetchAssemblies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAssemblies = assemblies.filter(a =>
    a.assembly_name.toLowerCase().includes(search.toLowerCase()) &&
    (statusFilter === '' || a.status === statusFilter)
  );

  const sortedAssemblies = [...filteredAssemblies].sort((a, b) => {
    const getVal = (obj) => {
      const v = obj[sortField];
      if (v == null) return null;
      if (sortField === 'update_date' || sortField === 'create_date') {
        const t = new Date(v).getTime();
        return Number.isNaN(t) ? null : t;
      }
      return v;
    };
    const va = getVal(a), vb = getVal(b);
    if (va == null) return 1;
    if (vb == null) return -1;
    return sortOrder === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  const paginatedAssemblies = sortedAssemblies.slice(
    (currentPage - 1) * assembliesPerPage,
    currentPage * assembliesPerPage
  );

  const totalPages = Math.ceil(filteredAssemblies.length / assembliesPerPage);
  const visiblePageRange = 2;
  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - visiblePageRange && i <= currentPage + visiblePageRange)
    ) {
      pageNumbers.push(i);
    } else if (
      i === currentPage - visiblePageRange - 1 ||
      i === currentPage + visiblePageRange + 1
    ) {
      pageNumbers.push('ellipsis');
    }
  }

  const handleDeleteSelected = async () => {
    if (!window.confirm(`선택한 ${selectedIds.length}개의 pcb를 삭제하시겠습니까?`)) return;

    try {
      await fetch(`${SERVER_URL}/api/assemblies`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      fetchAssemblies();
      setSelectedIds([]);
      setDeleteMode(false);
    } catch (err) {
      alert("삭제 실패");
      console.error(err);
    }
  };

  const handleDeleteAllFiltered = () => {
    const idsToDelete = filteredAssemblies.map(a => a.id);
    if (!idsToDelete.length) return;

    if (!window.confirm(`현재 필터링된 ${idsToDelete.length}개의 pcb를 모두 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;

    fetch(`${SERVER_URL}/api/assemblies`, {
      method: "DELETE",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: idsToDelete })
    })
      .then(res => res.json())
      .then(() => {
        fetchAssemblies();
        setSelectedIds([]);
        setDeleteMode(false);
      })
      .catch(err => {
        console.error("전체 삭제 실패:", err);
      });
  };

  const handleCsvUpload = async () => {
    if (!csvFile) return alert("CSV 파일을 선택해주세요.");

    const formData = new FormData();
    formData.append("file", csvFile);
    setIsUploading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/assemblies/upload_csv`, {
        method: "POST",
        body: formData
      });

      const result = await res.json();
      if (res.ok) {
        alert(result.message);
        fetchAssemblies();
      } else {
        alert(result.error || "업로드 실패");
      }
    } catch (err) {
      console.error("업로드 오류:", err);
      alert("업로드 중 오류가 발생했습니다.");
    }
    setIsUploading(false);
  };

  const getImageSrc = (url) => (url ? `${url}` : '/default-part-icon.png');
  const handleOpenModal = () => setShowModal(true);
  const handleCloseModal = () => {
    setShowModal(false);
    setNewAssemblyName('');
  };

  const handleAmountChange = (e) => {
    const v = e.target.value;
    if (v === "") { setAssemblyAmount(""); return; }
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    setAssemblyAmount(Math.max(1, Math.floor(n)));
  };

  const handleCreateAssembly = async () => {
    const name = newAssemblyName.trim();
    const qty = Number(assemblyAmount) || 1;

    if (!name) {
      alert("이름을 입력하세요.");
      return;
    }
    if (qty < 1) {
      alert("수량은 1 이상이어야 합니다.");
      return;
    }

    try {
      setCreating(true);
      const res = await fetch(`${SERVER_URL}/api/assemblies/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assembly_name: name,
          quantity_to_build: qty,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "생성 실패");
        return;
      }
      alert(`${name} 생성 완료`);
      setNewAssemblyName("");
      setAssemblyAmount(1);
      handleCloseModal();
      fetchAssemblies();
    } catch (e) {
      console.error(e);
      alert("요청 중 오류가 발생했습니다.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="content-wrapper">
      <Row className="d-flex justify-content-between align-items-center mb-3">
        <Col xs="auto" className="d-flex gap-2 align-items-center">
          <InputGroup>
            <Button
              variant={viewMode === "grid" ? "secondary" : "outline-secondary"}
              onClick={() => setViewMode("grid")}
            >
              <FiGrid />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "outline-secondary"}
              onClick={() => setViewMode("list")}
            >
              <FiList />
            </Button>
          </InputGroup>
        </Col>
        <Col xs="auto" className="d-flex gap-2">
          {deleteMode && (
            <Col className="d-flex justify-content-center gap-3 align-items-center">
              {deleteMode && (
                <Form.Check
                  type="checkbox"
                  id="select-all"
                  className="mt-2"
                  checked={paginatedAssemblies.every(p => selectedIds.includes(p.id))}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const currentPageIds = paginatedAssemblies.map(p => p.id);
                    setSelectedIds(prev =>
                      checked
                        ? Array.from(new Set([...prev, ...currentPageIds]))
                        : prev.filter(id => !currentPageIds.includes(id))
                    );
                  }}
                />
              )}
              <Button
                variant="danger"
                onClick={handleDeleteSelected}
                disabled={selectedIds.length === 0}
              >
                선택 삭제
              </Button>
              <Button
                variant="outline-danger"
                onClick={handleDeleteAllFiltered}>
                전체 삭제
              </Button>
            </Col>
          )}
          <Button
            variant={deleteMode ? "danger" : "danger"}
            onClick={() => {
              setDeleteMode(prev => {
                if (prev) setSelectedIds([]);
                return !prev;
              });
            }}
          >
            {deleteMode ? <MdOutlineCancel /> : <FiTrash2 />}
          </Button>
          <Button onClick={handleOpenModal}>< MdOutlineAdd /></Button>
        </Col>
      </Row>

      <Row className="d-flex align-items-center mb-2">
        <Col md={3}>
          <Form.Control
            placeholder="검색어를 입력하세요"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Col>
        <Col md={3}>
          <InputGroup>
            <Form.Select
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
            >
              <option value="update_date">수정일</option>
              <option value="assembly_name">이름</option>
              <option value="quantity_to_build">수량</option>
            </Form.Select>
            <Button
              variant="outline-secondary"
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '▲' : '▼'}
            </Button>
          </InputGroup>
        </Col>
        <Col md={2}>
          <Form.Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">전체 상태</option>
            <option value="Planned">Planned</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </Form.Select>
        </Col>
        <Col className="d-flex" md={4}>
          <Col>
            <Form.Control
              type="file"
              accept=".csv"
              onChange={(e) => setCsvFile(e.target.files[0])}
            />
          </Col>
          <Col md="auto">
            <Button
              variant="success"
              disabled={!csvFile || isUploading}
              onClick={handleCsvUpload}
            >
              {isUploading ? "업로드 중..." : "CSV 업로드"}
            </Button>
          </Col>
        </Col>
      </Row>

      {viewMode === 'list' ? (
        <Table
          striped
          bordered
          hover
          size="sm"
          responsive
          style={{
            tableLayout: 'fixed',
            width: '100%',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <thead>
            <tr>
              {deleteMode && <th style={{ width: '60px' }}>선택</th>}
              <th className="text-center" style={{ width: '80px' }}>이미지</th>
              <th className="text-center">이름</th>
              <th className="text-center" style={{ width: '80px' }}>수량</th>
              <th className="text-center" style={{ width: '120px' }}>상태</th>
              <th className="text-center" style={{ width: '110px' }}>수정일</th>
            </tr>
          </thead>

          <tbody>
            {paginatedAssemblies.map(asm => {
              const statusText = asm.status || 'Planned';
              const statusColor = {
                'Planned': 'secondary',
                'In Progress': 'info',
                'Completed': 'success'
              }[statusText] || 'secondary';

              return (
                <tr
                  key={asm.id}
                  onClick={() => navigate(`/buildDetail/${asm.id}`)}
                  style={{
                    cursor: 'pointer',
                    verticalAlign: 'middle',
                  }}
                >
                  {deleteMode && (
                    <td
                      onClick={(e) => e.stopPropagation()}
                      className="text-center"
                    >
                      <Form.Check
                        type="checkbox"
                        checked={selectedIds.includes(asm.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedIds(prev =>
                            checked
                              ? [...prev, asm.id]
                              : prev.filter(id => id !== asm.id)
                          );
                        }}
                      />
                    </td>
                  )}

                  {/* 이미지 */}
                  <td className="text-center" style={{ padding: '6px' }}>
                    <img
                      src={getImageSrc(asm.image_url)}
                      alt={asm.assembly_name}
                      style={{
                        width: '40px',
                        height: '40px',
                        objectFit: 'contain',
                        background: '#f8f9fa',
                        borderRadius: '6px',
                      }}
                    />
                  </td>

                  {/* 이름 */}
                  <td
                    title={asm.assembly_name}
                    style={{
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      maxWidth: '240px',
                      fontWeight: 500,
                    }}
                  >
                    {asm.assembly_name}
                  </td>

                  {/* 수량 */}
                  <td className="text-end text-center" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {asm.quantity_to_build ?? 0}
                  </td>

                  {/* 상태 */}
                  <td className="text-center">
                    <Badge bg={statusColor}>{statusText}</Badge>
                  </td>

                  {/* 수정일 */}
                  <td className="text-center" style={{ color: '#777' }}>
                    {formatDate(asm.update_date)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : (
        /* 기존 grid view 유지 */
        <div
          className="d-flex flex-wrap mt-4"
          style={{
            gap: '12px',
            justifyContent: 'flex-start',
            flexDirection: 'row',
          }}
        >
          {paginatedAssemblies.map(asm => {
            const statusText = asm.status || 'Planned';
            const statusColor = {
              'Planned': 'secondary',
              'In Progress': 'info',
              'Completed': 'success'
            }[statusText] || 'secondary';
            return (
              <Card
                key={asm.id}
                style={{
                  width: '220px',
                  height: '210px',
                  maxWidth: '100%',
                }}
              >
                <Badge
                  bg={statusColor}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    zIndex: 10,
                    fontSize: '0.75rem',
                    padding: '0.35em 0.6em',
                  }}
                >
                  {statusText}
                </Badge>
                <div className="d-flex justify-content-center">
                  <Card.Img
                    variant="top"
                    src={getImageSrc(asm.image_url)}
                    alt="preview"
                    loading="lazy"
                    style={{
                      height: '140px',
                      maxWidth: '200px',
                      objectFit: 'contain',
                      padding: '10px',
                      backgroundColor: '#f8f9fa',
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate(`/buildDetail/${asm.id}`)}
                  />
                </div>
                <Card.Body className="px-3 py-2">
                  <div className="d-flex justify-content-between align-items-center">
                    <div
                      className="fw-bold mb-0 text-truncate"
                      style={{
                        fontSize: '1rem',
                        cursor: 'pointer',
                        flexGrow: 1,
                        marginRight: '10px',
                      }}
                    >
                      {asm.assembly_name}
                    </div>
                    <div>
                      <Card.Text className="mb-0" style={{ fontSize: '0.9rem', color: '#666', whiteSpace: 'nowrap' }}>
                        {asm.quantity_to_build ?? 0}개
                      </Card.Text>
                    </div>
                  </div>
                  <div className="mb-1 d-flex flex-row-reverse">
                    <Card.Text className="mb-0" style={{ fontSize: '0.8rem', color: '#666', whiteSpace: 'nowrap' }}>
                      {formatDate(asm.update_date)}
                    </Card.Text>
                  </div>
                </Card.Body>
              </Card>
            );
          })}
        </div>
      )}

      {
        totalPages > 1 && (
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
        )
      }
      <Modal show={showModal} onHide={handleCloseModal} centered>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateAssembly();
          }}
        >
          <Modal.Header closeButton>
            <Modal.Title>새 pcb 생성</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group>
              <Form.Label>이름</Form.Label>
              <Form.Control
                type="text"
                value={newAssemblyName}
                onChange={(e) => setNewAssemblyName(e.target.value)}
                autoFocus
              />
              <Form.Label className="mt-3">수량</Form.Label>
              <Form.Control
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={assemblyAmount}
                onChange={handleAmountChange}
                placeholder="1"
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal} disabled={creating}>
              취소
            </Button>
            <Button variant="primary" type="submit" disabled={creating}>
              {creating ? "생성 중..." : "생성"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div >
  );
};

export default BOMPage;
