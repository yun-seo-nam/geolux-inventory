import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Row, Col, Card, Table, Button, Badge, Form, Modal, ProgressBar, Tooltip, OverlayTrigger } from 'react-bootstrap';
import { MdOutlineBuild } from "react-icons/md";
import { FiSave, FiX, FiEdit, FiTrash2 } from 'react-icons/fi';
import { FaBox, FaDeleteLeft, FaCartShopping } from 'react-icons/fa6';

const ProjectPageDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [assemblies, setAssemblies] = useState([]);
  const [orders, setOrders] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBO, setNewBO] = useState({
    assembly_name: '',
    quantity_to_build: 1,
    description: '',
  });
  const [showAssemblySearchModal, setShowAssemblySearchModal] = useState(false);
  const [assemblySearch, setAssemblySearch] = useState('');
  const [allAssemblies, setAllAssemblies] = useState([]);
  const [parts, setParts] = useState([]);
  const [filteredParts, setFilteredParts] = useState([]);
  const [partSearch, setPartSearch] = useState('');
  const [selectedPartIds, setSelectedPartIds] = useState([]);
  const [editingRowId, setEditingRowId] = useState(null);
  const [editedRowData, setEditedRowData] = useState({});
  const [selectedPart, setSelectedPart] = useState(null);
  const [isDeallocate, setIsDeallocate] = useState(false);
  const [allocAmount, setAllocAmount] = useState(0);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [showDeallocateModal, setShowDeallocateModal] = useState(false);

  const computeProjectStatus = (end_date, status) => {
    const today = new Date();
    if (status === 'Completed') return 'Completed';
    if (!end_date) return 'Planned';

    const dueDate = new Date(end_date);
    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Overdue';
    if (diffDays <= 3) return 'Due Soon';
    return 'Planned';
  };

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/projects/${id}`)
      .then(res => res.json())
      .then(data => setProject(data))
      .catch(err => console.error("프로젝트 상세 불러오기 실패:", err));
  }, [id]);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/api/assemblies`)
      .then(res => res.json())
      .then(data => setAllAssemblies(data))
      .catch(err => console.error('어셈블리 목록 로드 실패:', err));
  }, []);

  const fetchSummary = async (projectId) => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/projects/${projectId}/summary`);
      const data = await res.json();
      setAssemblies(data.assemblies || []);
      setOrders(data.orders || []);
      setMaterials(data.materials || []);
    } catch (err) {
      console.error("요약 정보 불러오기 실패:", err);
    }
  };

  useEffect(() => {
    fetchSummary(id);
  }, [id]);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/projects/${id}/parts`)
      .then(res => res.json())
      .then(data => {
        setParts(data);
        setFilteredParts(data);
      });
  }, [id]);

  useEffect(() => {
    if (partSearch.trim() === '') {
      setFilteredParts(parts);
    } else {
      setFilteredParts(
        parts.filter(p =>
          p.part_name.toLowerCase().includes(partSearch.toLowerCase())
        )
      );
    }
  }, [partSearch, parts]);

  const getStockStatus = (required, stock) => {
    return stock >= required ? (
      <Badge bg="success">충분</Badge>
    ) : (
      <Badge bg="danger">부족</Badge>
    );
  };

  const handleCreateBO = async () => {
    const { assembly_name, quantity_to_build, description } = newBO;
    if (!assembly_name || quantity_to_build <= 0) {
      alert("제품명과 수량을 정확히 입력해주세요.");
      return;
    }

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/projects/${id}/assemblies/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assembly_name,
          quantity_to_build,
          description,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '생성 실패');
      }

      setShowCreateModal(false);
      setNewBO({ assembly_name: '', quantity_to_build: 1, description: '' });
      fetchSummary(id);
    } catch (err) {
      console.error(err);
      alert(`Build Order 생성 중 오류: ${err.message}`);
    }
  };

  const getStatusBadge = (status, end_date) => {
    const computedStatus = computeProjectStatus(end_date, status);

    const statusMap = {
      'Planned': '대기',
      'In Progress': '진행 중',
      'Completed': '완료',
      'Due Soon': '마감 임박',
      'Overdue': '지연됨',
    };

    const colorMap = {
      'Planned': 'secondary',
      'In Progress': 'info',
      'Completed': 'success',
      'Due Soon': 'warning',
      'Overdue': 'danger',
    };

    return <Badge bg={colorMap[computedStatus]}>{statusMap[computedStatus]}</Badge>;
  };

  const handleAutoAllocate = (targetParts) => {
    const requests = targetParts.map(p => {
      const required = p.quantity_to_build * p.quantity_per;
      const alreadyAllocated = p.allocated_quantity || 0;
      const remaining = required - alreadyAllocated;
      const available = p.quantity || 0;
      const toAllocate = Math.min(remaining, available);

      if (toAllocate <= 0) return null;

      return fetch(`${process.env.REACT_APP_API_URL}/api/assemblies/${p.assembly_id}/bom/${p.part_id}/allocate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: toAllocate,
        }),
      });
    }).filter(Boolean);

    if (requests.length === 0) {
      alert("할당 가능한 부품이 없습니다.");
      return;
    }

    Promise.all(requests)
      .then(() => {
        alert("자동 할당 완료");
        setSelectedPartIds([]);
        fetchSummary(id); // ✅ refreshData 대신 요약 갱신
        // 필요시 부품도 재요청
        fetch(`${process.env.REACT_APP_API_URL}/projects/${id}/parts`)
          .then(res => res.json())
          .then(data => {
            setParts(data);
            setFilteredParts(data);
          });
      })
      .catch((err) => {
        console.error(err);
        alert("자동 할당 중 오류 발생");
      });
  };

  const ReusableTooltip = ({ message, children }) => (
    <OverlayTrigger
      placement="top"
      overlay={<Tooltip>{message}</Tooltip>}
    >
      {children}
    </OverlayTrigger>
  );

  const handleEditRow = (row) => {
    setEditingRowId(row.part_id);
    setEditedRowData({ reference: row.reference, quantity_per: row.quantity_per });
  };

  const handleSaveRow = (partId) => {
    // 실제 저장 로직 필요
    setEditingRowId(null);
  };

  const handleCancelEdit = () => {
    setEditingRowId(null);
  };

  const handleDeleteRow = (partId) => {
    if (window.confirm("정말 삭제하시겠습니까?")) {
      // 실제 삭제 로직 필요
      alert(`부품 ${partId} 삭제`);
    }
  };

  return (
    <div className="content-wrapper">
      {project && (
        <div className="mb-3">
          <div className="d-flex align-items-start gap-4">
            {getStatusBadge(project.status, project.end_date)}
            <h2 className="mb-0">{project.project_name}</h2>
          </div>
        </div>
      )}

      <Row className="mb-4">
        <Col md={6}>
          <Card>
            <Card.Header className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <MdOutlineBuild />
                PCB
              </div>
              <Button variant="primary" onClick={() => setShowAssemblySearchModal(true)}>
                + PCB 생성
              </Button></Card.Header>
            <Card.Body>
              <Table striped bordered hover size="sm">
                <thead>
                  <tr className='text-center'>
                    <th>제품명</th>
                    <th>수량</th>
                    <th>상태</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {assemblies.map((asm) => (
                    <tr className='text-center' key={asm.id}>
                      <td style={{ cursor: 'pointer', textDecoration: 'underline', color: '#007bff' }}
                        onClick={() => navigate(`/partsBuildPage/${asm.id}`)}>{asm.assembly_name}</td>
                      <td>{asm.quantity_to_build}</td>
                      <td>{getStatusBadge(asm.status)}</td>
                      <td><Button size="sm" variant="outline-primary">보기</Button></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card>
            <Card.Header className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <FaCartShopping /> 구매 목록
              </div>
            </Card.Header>
            <Card.Body>
              <Table striped bordered hover size="sm">
                <thead>
                  <tr className='text-center'>
                    <th>이름</th>
                    <th>수량</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((po) => (
                    <tr className='text-center' key={po.id}>
                      <td>{po.part_name}</td>
                      <td>{po.quantity_ordered}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        <Col>
          <Card className="mt-3">
            <Card.Header className="d-flex align-items-center justify-content-between ">
              <div className='d-flex align-items-center w-100 gap-3'>
                <h3 className="fs-4">부품 리스트</h3>
                <Form.Control
                  className="mb-3 mt-2 w-75"
                  placeholder="부품명을 검색하세요"
                  value={partSearch}
                  onChange={(e) => setPartSearch(e.target.value)}
                />
              </div>

              <div className="mb-3 d-flex flex-row-reverse gap-3 w-50">
                <Button
                  variant="secondary"
                  onClick={() => {
                    const selectedParts = parts.filter(p => selectedPartIds.includes(p.part_id));
                    if (selectedParts.length === 0) return alert("선택된 부품이 없습니다.");
                    handleAutoAllocate(selectedParts);
                  }}
                >
                  선택 자동 할당
                </Button>
                <Button
                  variant="success"
                  onClick={() => {
                    if (!window.confirm("모든 부품을 자동 할당하시겠습니까?")) return;
                    handleAutoAllocate(parts);
                  }}
                >
                  전체 자동 할당
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              <Table striped bordered hover>
                <thead className="text-center">
                  <tr>
                    <th>
                      <Form.Check
                        type="checkbox"
                        checked={selectedPartIds.length === filteredParts.length && filteredParts.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPartIds(filteredParts.map(p => p.part_id));
                          } else {
                            setSelectedPartIds([]);
                          }
                        }}
                      />
                    </th>
                    <th>부품명</th>
                    <th>참조번호</th>
                    <th>개당 필요수</th>
                    <th>할당 / 필요 수</th>
                    <th>재고</th>
                    <th>할당량</th>
                    <th>할당</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody className="text-center">
                  {filteredParts.map((p) => {
                    const requiredQty = p.quantity_to_build * p.quantity_per;
                    const currentQty = (p.quantity || 0) + (p.allocated_quantity || 0);
                    const isStockShort = currentQty < requiredQty;

                    const allocated = p.allocated_quantity || 0;

                    if (editingRowId === p.part_id) {
                      return (
                        <tr key={p.part_id}>
                          <td>
                            <Form.Check
                              type="checkbox"
                              checked={selectedPartIds.includes(p.part_id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPartIds(prev => [...prev, p.part_id]);
                                } else {
                                  setSelectedPartIds(prev => prev.filter(id => id !== p.part_id));
                                }
                              }}
                            />
                          </td>
                          <td
                            style={{ cursor: 'pointer', textDecoration: 'underline', color: '#007bff' }}
                            onClick={() => navigate(`/partsPage/${p.part_id}`)}
                          >
                            {p.part_name}
                          </td>
                          <td>
                            <Form.Control
                              value={editedRowData.reference}
                              onChange={(e) => setEditedRowData(prev => ({ ...prev, reference: e.target.value }))}
                            />
                          </td>
                          <td>
                            <Form.Control
                              type="number"
                              value={editedRowData.quantity_per}
                              onChange={(e) => setEditedRowData(prev => ({ ...prev, quantity_per: Number(e.target.value) }))}
                            />
                          </td>
                          <td>
                            <p>{allocated} / {requiredQty}</p>
                          </td>
                          <td>{p.quantity}</td>
                          <td>
                            <ProgressBar
                              now={allocated}
                              max={requiredQty}
                              label={`${allocated} / ${requiredQty}`}
                              variant={allocated >= requiredQty ? 'success' : 'warning'}
                            />
                          </td>
                          <td></td>
                          <td>
                            <Button variant="outline-success" size="sm" onClick={() => handleSaveRow(p.part_id)}><FiSave /></Button>{' '}
                            <Button variant="outline-secondary" size="sm" onClick={handleCancelEdit}><FiX /></Button>
                          </td>
                        </tr>
                      );
                    } else {
                      return (
                        <tr key={p.part_id}>
                          <td>
                            <Form.Check
                              type="checkbox"
                              checked={selectedPartIds.includes(p.part_id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPartIds(prev => [...prev, p.part_id]);
                                } else {
                                  setSelectedPartIds(prev => prev.filter(id => id !== p.part_id));
                                }
                              }}
                            />
                          </td>
                          <td
                            style={{ cursor: 'pointer', textDecoration: 'underline', color: '#007bff' }}
                            onClick={() => navigate(`/partsPage/${p.part_id}`)}
                          >
                            {p.part_name}
                          </td>
                          <td>{p.reference}</td>
                          <td>{p.quantity_per}</td>
                          <td>
                            <p>{allocated} / {requiredQty}</p>
                          </td>
                          <td style={{ color: isStockShort ? 'red' : 'inherit' }}>
                            {isStockShort ? (
                              <ReusableTooltip message="재고가 부족합니다">
                                <span>{p.quantity}</span>
                              </ReusableTooltip>
                            ) : (
                              <span>{p.quantity}</span>
                            )}
                          </td>
                          <td style={{ minWidth: 150 }}>
                            <ProgressBar
                              now={allocated}
                              max={requiredQty}
                              label={`${allocated} / ${requiredQty}`}
                              variant={allocated >= requiredQty ? 'success' : 'warning'}
                            />
                          </td>
                          <td>
                            <Button
                              variant="success"
                              size="sm"
                              disabled={allocated >= requiredQty}
                              onClick={() => {
                                setSelectedPart(p);
                                setIsDeallocate(false);
                                const requiredQty = p.quantity_to_build * p.quantity_per;
                                const allocated = p.allocated_quantity || 0;
                                const remaining = requiredQty - allocated;
                                const availableStock = p.quantity || 0;

                                const defaultAlloc = Math.min(remaining, availableStock);
                                setAllocAmount(defaultAlloc > 0 ? defaultAlloc : 0);
                                setShowAllocateModal(true);
                              }}
                            >
                              <FaBox />
                            </Button>{' '}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setSelectedPart(p);
                                setIsDeallocate(true);
                                setAllocAmount(allocated);
                                setShowDeallocateModal(true);
                              }}
                            >
                              <FaDeleteLeft />
                            </Button>
                          </td>
                          <td>
                            <Button variant="outline-primary" size="sm" onClick={() => handleEditRow(p)}><FiEdit /></Button>{' '}
                            <Button variant="outline-danger" size="sm" onClick={() => handleDeleteRow(p.part_id)}><FiTrash2 /></Button>
                          </td>
                        </tr>
                      );
                    }
                  })}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* 어셈블리 선택 모달 */}
      <Modal show={showAssemblySearchModal} onHide={() => setShowAssemblySearchModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>PCB 검색 및 선택</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="align-items-end">
            <Col md={10}>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-0">
                    <Form.Label>어셈블리명 : </Form.Label>
                    <Form.Control
                      value={newBO.assembly_name}
                      onChange={(e) => setNewBO({ ...newBO, assembly_name: e.target.value })}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-0">
                    <Form.Label>수량 : </Form.Label>
                    <Form.Control
                      type="number"
                      min="1"
                      value={newBO.quantity_to_build}
                      onChange={(e) => setNewBO({ ...newBO, quantity_to_build: Number(e.target.value) })}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Col>

            <Col md={2} className="text-end">
              <Button
                variant="primary"
                onClick={() => {
                  setShowAssemblySearchModal(false);
                  setShowCreateModal(true);
                }}
                disabled={!newBO.assembly_name}
              >
                직접 추가
              </Button>
            </Col>
          </Row>
          <hr />
          <Form.Control
            placeholder="어셈블리명 검색"
            value={assemblySearch}
            onChange={(e) => setAssemblySearch(e.target.value)}
            className="mb-3"
          />
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <Table striped hover>
              <thead>
                <tr className="text-center">
                  <th>이름</th>
                  <th>설명</th>
                  <th>선택</th>
                </tr>
              </thead>
              <tbody>
                {allAssemblies
                  .filter(a => a.assembly_name.toLowerCase().includes(assemblySearch.toLowerCase()))
                  .map((asm) => (
                    <tr className="text-center" key={asm.id}>
                      <td>{asm.assembly_name}</td>
                      <td>{asm.description || '-'}</td>
                      <td>
                        <Button size="sm" onClick={() => {
                          setNewBO({
                            assembly_name: asm.assembly_name,
                            quantity_to_build: 1,
                            description: asm.description || '',
                          });
                          setShowAssemblySearchModal(false);
                          setShowCreateModal(true);
                        }}>
                          선택
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
      </Modal>

      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>PCB 생성</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>제품명</Form.Label>
            <Form.Control
              value={newBO.assembly_name}
              disabled
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>수량</Form.Label>
            <Form.Control
              type="number"
              min="1"
              value={newBO.quantity_to_build}
              onChange={(e) => setNewBO(prev => ({ ...prev, quantity_to_build: Number(e.target.value) }))}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>설명</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={newBO.description}
              onChange={(e) => setNewBO(prev => ({ ...prev, description: e.target.value }))}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCreateModal(false)}>취소</Button>
          <Button variant="primary" onClick={handleCreateBO}>생성</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ProjectPageDetail;
