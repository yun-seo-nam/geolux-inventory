// src/pages/ProjectPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Table, Button, Form, InputGroup, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { FiTrash2 } from 'react-icons/fi';
import CustomButton from '../components/CustomButton';

const ProjectPage = () => {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [newProject, setNewProject] = useState({
    project_name: '',
    description: '',
  });

  const API_BASE = process.env.REACT_APP_SERVER_URL;

  const fetchProjects = useCallback(() => {
    fetch(`${API_BASE}/api/projects`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setProjects(data);
        else setProjects([]);
      })
      .catch(err => {
        console.error("프로젝트 목록 불러오기 실패:", err);
      });
  }, [API_BASE]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleSearchChange = (e) => setFilter(e.target.value);

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    fetch(`${API_BASE}/api/projects/${id}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error('삭제 실패');
        setProjects(prev => prev.filter((proj) => proj.id !== id));
      })
      .catch(err => {
        console.error('삭제 중 오류:', err);
        alert('삭제 실패');
      });
  };

  // status 관련 필터 제거 → 텍스트 필터만
  const filteredProjects = projects
    .filter((proj) =>
      (proj.project_name?.toLowerCase().includes(filter.toLowerCase()) ||
        proj.description?.toLowerCase().includes(filter.toLowerCase()))
    )
    .sort((a, b) => new Date(a.create_date) - new Date(b.create_date));

  const handleCreateProject = () => {
    fetch(`${API_BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // status 제거
      body: JSON.stringify({
        project_name: newProject.project_name,
        description: newProject.description,
      }),
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
        setNewProject({ project_name: '', description: '' });
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
        <Col md={6}>
          <InputGroup>
            <Form.Control
              type="text"
              placeholder="프로젝트명 또는 설명 검색"
              value={filter}
              onChange={handleSearchChange}
            />
          </InputGroup>
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
            <th>생성일</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {filteredProjects.length === 0 ? (
            <tr>
              <td colSpan="4" className="text-center text-muted">검색 결과 없음</td>
            </tr>
          ) : (
            filteredProjects.map((proj) => (
              <tr className='text-center' key={proj.id}>
                <td style={{ cursor: 'pointer' }} onClick={() => navigate(`/projectDetail/${proj.id}`)}>
                  {proj.project_name}
                </td>
                <td>{proj.description || '-'}</td>
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
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateProject();
            }}
          >
            <Form.Group className="mb-2">
              <Form.Label>프로젝트명</Form.Label>
              <Form.Control
                value={newProject.project_name}
                onChange={(e) => setNewProject({ ...newProject, project_name: e.target.value })}
                autoFocus
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>설명</Form.Label>
              <Form.Control
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              />
            </Form.Group>
            {/* 엔터로도 등록 가능 */}
            <button type="submit" style={{ display: 'none' }} />
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
