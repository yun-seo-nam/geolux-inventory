import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Row, Col, Card, Table, Button, Badge, Form, Modal } from 'react-bootstrap';
import { MdOutlineBuild } from "react-icons/md";
import { FaCartShopping } from "react-icons/fa6";

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
          <Card>
            <Card.Header>자재 현황 요약</Card.Header>
            <Card.Body>
              <Table striped bordered hover size="sm">
                <thead>
                  <tr>
                    <th>품목명</th>
                    <th>필요 수량</th>
                    <th>현재 재고</th>
                    <th>상태</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((mat, index) => (
                    <tr key={index}>
                      <td style={{ cursor: 'pointer', textDecoration: 'underline', color: '#007bff' }}
                        onClick={() => navigate(`/partsPage/${mat.part_id}`)}>{mat.part_name}</td>
                      <td>{mat.total_required}</td>
                      <td>{mat.current_stock}</td>
                      <td>{getStockStatus(mat.total_required, mat.current_stock)}</td>
                      <td>
                        <Button size="sm" variant={mat.current_stock >= mat.total_required ? 'success' : 'warning'}>
                          {mat.current_stock >= mat.total_required ? '할당' : '발주'}
                        </Button>
                      </td>
                    </tr>
                  ))}
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
