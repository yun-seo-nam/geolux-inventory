import React from 'react';
import { Row, Col, Card, ProgressBar, ListGroup, Badge } from 'react-bootstrap';
import { Doughnut, Line } from 'react-chartjs-2';
import { FaExclamationTriangle, FaCalendarAlt, FaClipboardList } from 'react-icons/fa';

import {
  Chart as ChartJS,
  ArcElement,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  ArcElement,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
);

const Dashboard = ({
  lowStockItems = [],
  upcomingDeadlines = [],
  topProgressProjects = [],
  delayedProjects = [],
  recentActivities = [],
  overallProgressData = {},
  projectStatusDistribution = {},
  monthlyProjectStats = {},
}) => {
  const defaultDoughnutData = {
    labels: ['데이터 없음'],
    datasets: [
      {
        data: [1],
        backgroundColor: ['#e0e0e0'],
        borderWidth: 1,
      },
    ],
  };

  const defaultLineData = {
    labels: [],
    datasets: [],
  };

  return (
    <div className="content-wrapper">
      {/* 상단 카드 요약 영역 */}
      <Row className="mb-4">
        <Col md={4}>
          <Card className="border border-danger bg-light-subtle">
            <Card.Body>
              <Card.Title className="text-danger"><FaExclamationTriangle /> 재고 부족 ({lowStockItems.length})</Card.Title>
              <ListGroup variant="flush">
                {lowStockItems.slice(0, 3).map((item, idx) => (
                  <ListGroup.Item key={idx}>{item.name} - {item.count}개 남음</ListGroup.Item>
                ))}
              </ListGroup>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="border border-warning bg-light-subtle">
            <Card.Body>
              <Card.Title className="text-warning"><FaCalendarAlt /> 마감 임박 프로젝트</Card.Title>
              <ListGroup variant="flush">
                {upcomingDeadlines.slice(0, 3).map((project, idx) => (
                  <ListGroup.Item key={idx}>{project.name} - {project.dueDate}</ListGroup.Item>
                ))}
              </ListGroup>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="border border-primary bg-light-subtle">
            <Card.Body>
              <Card.Title className="text-primary"><FaClipboardList /> 전체 진행률</Card.Title>
              <div className="chart-container">
                <Doughnut
                  data={overallProgressData?.datasets ? overallProgressData : defaultDoughnutData}
                  options={{ maintainAspectRatio: false }}
                />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* 프로젝트 진행률 비교 영역 */}
      <Row className="mb-4">
        <Col md={6}>
          <Card>
            <Card.Body>
              <Card.Title>진행률 Top 5</Card.Title>
              {topProgressProjects.map((p, idx) => (
                <div key={idx} className="mb-2">
                  <div className="d-flex justify-content-between">
                    <span>{p.name}</span><Badge bg="success">{p.progress}%</Badge>
                  </div>
                  <ProgressBar now={p.progress} />
                </div>
              ))}
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card>
            <Card.Body>
              <Card.Title>지연 프로젝트 Top 5</Card.Title>
              {delayedProjects.map((p, idx) => (
                <div key={idx} className="mb-2">
                  <div className="d-flex justify-content-between">
                    <span>{p.name}</span><Badge bg="danger">{p.daysDelayed}일 지연</Badge>
                  </div>
                  <ProgressBar variant="danger" now={p.progress} />
                </div>
              ))}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* 하단 차트 영역 */}
      <Row>
        <Col md={6}>
          <Card>
            <Card.Body>
              <Card.Title>상태별 프로젝트 분포</Card.Title>
              <div className="chart-container">
                <Doughnut
                  data={projectStatusDistribution?.datasets ? projectStatusDistribution : defaultDoughnutData}
                  options={{ maintainAspectRatio: false }}
                />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card>
            <Card.Body>
              <Card.Title>월별 프로젝트 증가 추이</Card.Title>
              <div className="chart-container">
                <Line
                  data={monthlyProjectStats?.datasets ? monthlyProjectStats : defaultLineData}
                  options={{ maintainAspectRatio: false }}
                />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* 최근 활동 로그 */}
      <Row className="mt-4">
        <Col>
          <Card>
            <Card.Body>
              <Card.Title>최근 업데이트 내역</Card.Title>
              <ListGroup>
                {recentActivities.slice(0, 10).map((log, idx) => (
                  <ListGroup.Item key={idx}>{log}</ListGroup.Item>
                ))}
              </ListGroup>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
