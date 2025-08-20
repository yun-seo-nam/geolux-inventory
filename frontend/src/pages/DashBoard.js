import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, ListGroup, Badge, Accordion } from 'react-bootstrap';
import { FaBoxOpen, FaTruck } from 'react-icons/fa';

import ProjectPage from '../pages/ProjectPage';

const Dashboard = () => {
  const [lowStockAssemblies, setLowStockAssemblies] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/api/assemblies/low_stock`)
      .then(res => res.json())
      .then(data => setLowStockAssemblies(data));

    fetch(`${process.env.REACT_APP_API_URL}/api/part_orders/recent`)
      .then(res => res.json())
      .then(data => setPurchaseOrders(data));
  }, []);

  return (
    <div className="content-wrapper">
      <Row className="mb-4">
        <Col md={6}>
          <Card className="border border-danger bg-light-subtle shadow-sm">
            <Card.Body>
              <Card.Title className="text-danger">
                <FaBoxOpen className="me-2" />
                재고 부족 어셈블리 ({lowStockAssemblies.length})
              </Card.Title>
              <ListGroup variant="flush">
                {lowStockAssemblies.length > 0 ? lowStockAssemblies.slice(0, 5).map((item, idx) => (
                  <ListGroup.Item key={idx} className="d-flex justify-content-between align-items-center">
                    <span style={{ cursor: "pointer" }} onClick={() => navigate(`/partsBuildPage/${item.id}`)}>{item.assembly_name}</span>
                    <Badge bg="danger">{Math.round(item.allocation_percent)}%</Badge>
                  </ListGroup.Item>
                )) : (
                  <ListGroup.Item>모든 어셈블리에 충분한 재고가 있습니다.</ListGroup.Item>
                )}
              </ListGroup>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="border border-info bg-light-subtle shadow-sm">
            <Card.Body>
              <Card.Title className="text-info">
                <FaTruck className="me-2" />
                배송 예정 부품
              </Card.Title>
              <ListGroup variant="flush">
                {purchaseOrders.length > 0 ? purchaseOrders.slice(0, 5).map((order, idx) => (
                  <ListGroup.Item
                    key={idx}
                    className="d-flex justify-content-between align-items-center"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/partsPage/${order.part_id}`)}
                  >
                    <span>{order.part_name}</span>
                    <small>{order.quantity_ordered}개 | {order.order_date.split(' ')[0]}</small>
                  </ListGroup.Item>
                )) : (
                  <ListGroup.Item>최근 구매 내역이 없습니다.</ListGroup.Item>
                )}
              </ListGroup>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Accordion defaultActiveKey="0" className="mt-4">
        <Accordion.Item eventKey="0">
          <Accordion.Header>프로젝트 목록</Accordion.Header>
          <Accordion.Body>
            <ProjectPage />
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>
    </div>
  );
};

export default Dashboard;
