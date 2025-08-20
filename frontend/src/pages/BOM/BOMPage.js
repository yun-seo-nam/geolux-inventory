import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../../hooks/UserContext';
import { Row, Col, Form, Card, Pagination, Button, InputGroup, Modal, Badge } from 'react-bootstrap';
import { FiGrid, FiList, FiTrash2 } from 'react-icons/fi';
import { MdOutlineAdd, MdOutlineCancel } from "react-icons/md";

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

  const { selectedUser } = useContext(UserContext);

  const [showModal, setShowModal] = useState(false);
  const [newAssemblyName, setNewAssemblyName] = useState('');

  const [statusFilter, setStatusFilter] = useState('');

  const fetchAssemblies = () => {
    fetch(`${process.env.REACT_APP_API_URL}/api/assemblies`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAssemblies(data);
        else setAssemblies([]);
      });
  };

  useEffect(() => {
    fetchAssemblies();
  }, []);

  const filteredAssemblies = assemblies.filter(a =>
    a.assembly_name.toLowerCase().includes(search.toLowerCase()) &&
    (statusFilter === '' || a.status === statusFilter)
  );

  const sortedAssemblies = [...filteredAssemblies].sort((a, b) => {
    const fieldA = a[sortField];
    const fieldB = b[sortField];
    if (fieldA === null) return 1;
    if (fieldB === null) return -1;
    return sortOrder === 'asc'
      ? (fieldA > fieldB ? 1 : -1)
      : (fieldA < fieldB ? 1 : -1);
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
    if (!window.confirm(`선택한 ${selectedIds.length}개의 어셈블리를 삭제하시겠습니까?`)) return;

    try {
      await fetch(`${process.env.REACT_APP_API_URL}/api/assemblies`, {
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

    if (!window.confirm(`현재 필터링된 ${idsToDelete.length}개의 어셈블리를 모두 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;

    fetch(`${process.env.REACT_APP_API_URL}/api/assemblies`, {
      method: "DELETE",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: idsToDelete })
    })
      .then(res => res.json())
      .then(() => {
        fetchAssemblies();
        setSelectedIds([]);
        setDeleteMode(false);
      });
  };

  const handleCsvUpload = async () => {
    if (!csvFile) return alert("CSV 파일을 선택해주세요.");

    const formData = new FormData();
    formData.append("file", csvFile);
    formData.append("username", selectedUser?.value || 'Unknown');

    setIsUploading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/assemblies/upload_csv`, {
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

  const getImageSrc = (url) => {
    return url ? `${process.env.REACT_APP_API_URL}${url}` : '/default-part-icon.png';
  };
  const handleOpenModal = () => setShowModal(true);
  const handleCloseModal = () => {
    setShowModal(false);
    setNewAssemblyName('');
  };

  const handleCreateAssembly = async () => {
    if (!newAssemblyName.trim()) {
      alert('어셈블리 이름을 입력해주세요.');
      return;
    }

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/assemblies/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assembly_name: newAssemblyName.trim(),
          username: selectedUser?.value || 'Unknown',
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '생성 실패');

      alert(result.message || '어셈블리 생성 완료');
      handleCloseModal();
      fetchAssemblies();
    } catch (err) {
      console.error('어셈블리 생성 실패:', err);
      alert('어셈블리 생성에 실패했습니다.');
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
        {deleteMode && (
          <Col className="d-flex justify-content-center gap-3">
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
        <Col xs="auto" className="d-flex gap-2 justify-content-end">
          <Button
            variant={deleteMode ? "danger" : "outline-danger"}
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

      <Row className="d-flex justify-content-between align-items-center mb-3">

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

      <div
        className="d-flex flex-wrap mt-4"
        style={{
          gap: '12px',
          justifyContent: 'flex-start',
          flexDirection: viewMode === 'grid' ? 'row' : 'column',
        }}>
        {paginatedAssemblies.map(asm => {
          let statusText = asm.status || 'Planned';
          let statusColor = {
            'Planned': 'secondary',
            'In Progress': 'info',
            'Completed': 'success'
          }[statusText] || 'secondary';

          return (
            <Card
              key={asm.id}
              style={{
                width: viewMode === 'grid' ? '220px' : '100%',
                height: viewMode === 'grid' ? '210px' : 'auto',
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

              {viewMode === 'grid' && (
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
                    onClick={() => navigate(`/partsBuildPage/${asm.id}`)}
                  />
                </div>
              )}

              <Card.Body className="px-3 py-2">
                <div className="d-flex justify-content-between align-items-center">
                  <div
                    title={asm.part_name}
                    className="fw-bold mb-0 text-truncate"
                    style={{
                      fontSize: '1rem',
                      cursor: 'pointer',
                      flexGrow: 1,
                      marginRight: '10px',
                      maxWidth: '200px',
                    }}
                    onClick={() => navigate(`/partsBuildPage/${asm.id}`)}
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
                    {asm.update_date ? asm.update_date.split(' ')[0] : '날짜 없음'}
                  </Card.Text>
                </div>
              </Card.Body>
            </Card>
          );
        })}
      </div>

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
        <Modal.Header closeButton>
          <Modal.Title>새 어셈블리 생성</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>이름</Form.Label>
            <Form.Control
              type="text"
              value={newAssemblyName}
              onChange={(e) => setNewAssemblyName(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>취소</Button>
          <Button variant="primary" onClick={handleCreateAssembly}>생성</Button>
        </Modal.Footer>
      </Modal>
    </div >
  );
};

export default BOMPage;
