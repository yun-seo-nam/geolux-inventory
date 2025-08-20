import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { Row, Col, Form, Card, Pagination, ToggleButtonGroup, ToggleButton, Button, InputGroup } from 'react-bootstrap';
import { FiGrid, FiList, FiTrash2 } from 'react-icons/fi';
import { MdOutlineAdd, MdOutlineCancel } from "react-icons/md";

import UploadPart from '../../components/UploadPart';

const PartsPage = () => {
  const navigate = useNavigate();
  const [parts, setParts] = useState([]);
  const [viewMode, setViewMode] = useState('list');
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

  const fetchParts = () => {
    fetch("/api/parts")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setParts(data);
        } else {
          console.error("서버에서 배열이 아닌 데이터를 받음:", data);
          setParts([]);
        }
      })
      .catch(err => {
        console.error("부품 목록을 불러오는 데 실패했습니다:", err);
      });
  };

  const fetchCategories = () => {
    fetch("/api/categories/large")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setLargeCategories(data);
      });

    fetch("/api/categories/medium")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setMediumCategories(data);
      });

    fetch("/api/categories/small")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setSmallCategories(data);
      });
  };

  useEffect(() => {
    fetchCategories();
    fetchParts();
  }, []);

  const filteredParts = parts.filter(part => {
    return (
      part.part_name.toLowerCase().includes(search.toLowerCase()) &&
      (!selectedLarge || part.category_large === selectedLarge) &&
      (!selectedMedium || part.category_medium === selectedMedium) &&
      (!selectedSmall || part.category_small === selectedSmall)
    );
  });

  const sortedParts = [...filteredParts].sort((a, b) => {
    const fieldA = a[sortField];
    const fieldB = b[sortField];

    if (fieldA === null) return 1;
    if (fieldB === null) return -1;

    if (sortOrder === 'asc') {
      return fieldA > fieldB ? 1 : fieldA < fieldB ? -1 : 0;
    } else {
      return fieldA < fieldB ? 1 : fieldA > fieldB ? -1 : 0;
    }
  });

  const paginatedParts = sortedParts.slice(
    (currentPage - 1) * partsPerPage,
    currentPage * partsPerPage
  );

  const totalPages = Math.ceil(filteredParts.length / partsPerPage);

  const handleDeleteSelected = () => {
    if (!window.confirm(`선택한 ${selectedIds.length}개의 부품을 삭제하시겠습니까?`)) return;

    fetch("/api/parts", {
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

    fetch("/api/parts", {
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
      (i === currentPage - visiblePageRange - 1) ||
      (i === currentPage + visiblePageRange + 1)
    ) {
      pageNumbers.push('ellipsis');
    }
  }
  const getImageSrc = (url) => {
    return url ? url : "/default-part-icon.png";
  };

  return (
    <div className="content-wrapper">
      <Row className="d-flex justify-content-between align-items-center mb-3">
        <Col xs="auto" className="d-flex gap-2 align-items-center">
          <ToggleButtonGroup type="radio" name="viewMode" value={viewMode} onChange={setViewMode}>
            <ToggleButton id="grid" value="grid" variant="outline-secondary">
              <FiGrid />
            </ToggleButton>
            <ToggleButton id="list" value="list" variant="outline-secondary">
              <FiList />
            </ToggleButton>
          </ToggleButtonGroup>
        </Col>
        {deleteMode && (
          <Col className="d-flex justify-content-center gap-3">
            {deleteMode && (
              <Form.Check
                type="checkbox"
                id="select-all"
                className="mt-2"
                checked={paginatedParts.every(p => selectedIds.includes(p.id))}
                onChange={(e) => {
                  const checked = e.target.checked;
                  const currentPageIds = paginatedParts.map(p => p.id);
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
            <Button variant="outline-danger" onClick={handleDeleteAllFiltered}>
              전체 삭제
            </Button>
          </Col>
        )}
        <Col xs="auto" className="d-flex gap-2">
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

      <Row className="g-2 d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom pb-2">
        <Col md={8}>
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
              <option value="part_name">이름</option>
              <option value="quantity">수량</option>
            </Form.Select>
            <Button
              variant="outline-secondary"
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '▲' : '▼'}
            </Button>
          </InputGroup>
        </Col>
      </Row>

      <Row className="mb-2 mt-4">
        <Col md={4}>
          <Form.Select value={selectedLarge} onChange={(e) => setSelectedLarge(e.target.value)}>
            <option value="">대분류 선택</option>
            {largeCategories.map((cat, idx) => (
              <option key={idx} value={cat}>{cat}</option>
            ))}
          </Form.Select>
        </Col>
        <Col md={4}>
          <Form.Select value={selectedMedium} onChange={(e) => setSelectedMedium(e.target.value)}>
            <option value="">중분류 선택</option>
            {mediumCategories.map((cat, idx) => (
              <option key={idx} value={cat}>{cat}</option>
            ))}
          </Form.Select>
        </Col>
        <Col md={4}>
          <Form.Select value={selectedSmall} onChange={(e) => setSelectedSmall(e.target.value)}>
            <option value="">소분류 선택</option>
            {smallCategories.map((cat, idx) => (
              <option key={idx} value={cat}>{cat}</option>
            ))}
          </Form.Select>
        </Col>
      </Row>

      <div
        className="d-flex flex-wrap"
        style={{
          gap: '12px',
          justifyContent: 'flex-start',
          flexDirection: viewMode === 'grid' ? 'row' : 'column',
        }}
      >
        {paginatedParts.map(part => (
          <Card
            key={part.id}
            style={{
              width: viewMode === 'grid' ? '220px' : '100%',
              height: viewMode === 'grid' ? '210px' : 'auto',
              maxWidth: '100%',
            }}
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

            {viewMode === 'grid' && (
              <div className="d-flex justify-content-center">
                <Card.Img
                  variant="top"
                  src={getImageSrc(part.image_url)}
                  alt="part preview"
                  loading="lazy"
                  style={{
                    height: '140px',
                    maxWidth: '200px',
                    objectFit: 'contain',
                    padding: '10px',
                    backgroundColor: '#f8f9fa',
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate(`/partsPage/${part.id}`)}
                />
              </div>
            )}
            <Card.Body className="px-3 py-2">
              {/* 첫 번째 줄: 부품 이름 + 수량 */}
              <div className="d-flex justify-content-between align-items-center">
                <div
                  title={part.part_name}
                  className="fw-bold mb-0 text-truncate"
                  style={{
                    fontSize: '1rem',
                    cursor: 'pointer',
                    flexGrow: 1,
                    marginRight: '10px',
                    maxWidth: '200px'
                  }}
                  onClick={() => navigate(`/parts/${part.id}`)}
                >
                  {part.part_name}
                </div>
                <div>
                  <Card.Text className="mb-0" style={{ fontSize: '0.9rem', color: '#666', whiteSpace: 'nowrap' }}>
                    {part.quantity ?? 0}개
                  </Card.Text>
                </div>
              </div>
              {/* 두 번째 줄: 날짜 */}
              <div className="mb-1 d-flex flex-row-reverse">
                <Card.Text className="mb-0" style={{ fontSize: '0.8rem', color: '#666', whiteSpace: 'nowrap' }}>
                  {part.update_date ? part.update_date.split(' ')[0] : '날짜 없음'}
                </Card.Text>
              </div>
            </Card.Body>
          </Card>
        ))}
      </div>

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
