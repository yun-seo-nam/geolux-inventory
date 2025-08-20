import React, { useState, useEffect } from 'react';
import { Row, Col, Table, Button, Form, InputGroup, Badge, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { FiTrash2 } from 'react-icons/fi';
import CustomButton from '../components/CustomButton';

const API_URL = process.env.REACT_APP_API_URL || '';

const ProjectPage = () => {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('전체');

  const [showModal, setShowModal] = useState(false);
  const [newProject, setNewProject] = useState({
    project_name: '',
    description: '',
    status: 'Planned'
  });

  const fetchProjects = () => {
    fetch(`${API_URL}/projects`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setProjects(data);
        } else {
          console.error("서버에서 배열이 아닌 데이터를 받음:", data);
          setProjects([]);
        }
      })
      .catch(err => {
        console.error("프로젝트 목록을 불러오는 데 실패했습니다:", err);
      });
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleSearchChange = (e) => setFilter(e.target.value);
  const handleStatusFilterChange = (e) => setStatusFilter(e.target.value);

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    fetch(`${API_URL}/projects/${id}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error('삭제 실패');
        setProjects(projects.filter((proj) => proj.id !== id));
      })
      .catch(err => {
        console.error('삭제 중 오류:', err);
        alert('삭제 실패');
      });
  };

  const getStatusBadge = (status, end_date) => {

    const statusMap = {
      'Planned': '대기',
      'In Progress': '진행 중',
      'Completed': '완료'
    };
    const colorMap = {
      'Planned': 'secondary',
      'In Progress': 'info',
      'Completed': 'success',
    };
    return <Badge bg={colorMap[status]}>{statusMap[status]}</Badge>;
  };

  const filteredProjects = projects
    .filter((proj) =>
      (proj.project_name?.toLowerCase().includes(filter.toLowerCase()) ||
        proj.description?.toLowerCase().includes(filter.toLowerCase())) &&
      (statusFilter === '전체' || getStatusBadge(proj.status).props.children === statusFilter)
    )
    .sort((a, b) => new Date(a.create_date) - new Date(b.create_date));

  const handleCreateProject = () => {
    fetch(`${API_URL}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProject),
    })
      .then(async res => {
        const result = await res.json();
        if (!res.ok) {
          throw new Error(result.error || '프로젝트 생성 실패');
        }
        return result;
      })
      .then(() => {
        setShowModal(false);
        setNewProject({ project_name: '', description: '', status: 'Planned' });
        fetchProjects();
      })
      .catch(err => {
        console.error('프로젝트 생성 중 에러:', err);
        alert(err.message);
      });
  };

  return (
    <div className="content-wrapper">
      <Row className="mb-3"></Row>

      <Row className="mb-3">
        <Col md={4}>
          <InputGroup>
            <Form.Control
              type="text"
              placeholder="프로젝트명 또는 설명 검색"
              value={filter}
              onChange={handleSearchChange}
            />
          </InputGroup>
        </Col>
        <Col md={3}>
          <Form.Select value={statusFilter} onChange={handleStatusFilterChange}>
            <option value="전체">전체 상태</option>
            <option value="대기">대기</option>
            <option value="진행 중">진행 중</option>
            <option value="완료">완료</option>
          </Form.Select>
        </Col>
        <Col className="text-end">
          <CustomButton variant="primary" onClick={() => setShowModal(true)}>새 프로젝트</CustomButton>
        </Col>
      </Row>

      <Table striped bordered hover size="sm">
        <thead>
          <tr className='text-center'>
            <th>프로젝트명</th>
            <th>설명</th>
            <th>진행 상태</th>
            <th>생성일</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {filteredProjects.length === 0 ? (
            <tr>
              <td colSpan="5" className="text-center text-muted">검색 결과 없음</td>
            </tr>
          ) : (
            filteredProjects.map((proj) => (
              <tr className='text-center' key={proj.id}>
                <td style={{ cursor: 'pointer' }} onClick={() => navigate(`/projectPage/${proj.id}`)}>
                  {proj.project_name}
                </td>
                <td>{proj.description || '-'}</td>
                <td>{getStatusBadge(proj.status, proj.end_date)}</td>
                <td>{proj.create_date?.split(' ')[0]}</td>
                <td>
                  <Button variant="outline-danger" size="sm" onClick={() => handleDelete(proj.id)}><FiTrash2 /></Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>새 프로젝트 등록</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-2">
              <Form.Label>프로젝트명</Form.Label>
              <Form.Control
                value={newProject.project_name}
                onChange={(e) => setNewProject({ ...newProject, project_name: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>설명</Form.Label>
              <Form.Control
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>취소</Button>
          <Button variant="primary" onClick={handleCreateProject}>등록</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ProjectPage;
