import React, { useEffect, useState, useRef, useContext, useCallback } from 'react';
import { UserContext } from '../../hooks/UserContext';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, ListGroup, Button, Spinner, Form, Row, Col, Badge, Table, ButtonGroup, Modal } from 'react-bootstrap';
import { FiEdit, FiTrash2, FiSave, FiX, FiUpload } from 'react-icons/fi';

const PartDetailPage = () => {
  const { selectedUser } = useContext(UserContext);
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [part, setPart] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPart, setEditedPart] = useState({});
  const fileInputRef = useRef(null);

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [newOrderDate, setNewOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [newOrderQty, setNewOrderQty] = useState(1);
  const [deliveryOrders, setDeliveryOrders] = useState([
    { id: 1, orderDate: new Date(), quantity: 0 },
  ]);

  const fetchPart = useCallback(() => {
    setLoading(true);
    fetch(`${process.env.REACT_APP_API_URL}/api/parts/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(`서버 에러: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        console.log("받아온 Part 데이터:", data);
        setPart(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("부품 가져오기 실패:", err);
        setLoading(false);
      });
  }, [id]);

  // 부품 발주
  const fetchDeliveryOrders = useCallback(() => {
    fetch(`${process.env.REACT_APP_API_URL}/api/parts/${id}/orders`)
      .then(res => res.json())
      .then(data => {
        setDeliveryOrders(data);
      })
      .catch(err => {
        console.error("배송 정보 로딩 실패:", err);
      });
  }, [id]);

  const saveOrder = (order) => {
    fetch(`${process.env.REACT_APP_API_URL}/api/part_orders`, {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        part_id: part.id,
        order_date: order.order_date || new Date().toISOString().slice(0, 10),
        quantity_ordered: parseInt(order.quantity_ordered || order.quantity),
      }),
    })
      .then(res => {
        if (!res.ok) throw new Error('POST 실패');
        return res.json();
      })
      .then(() => {
        alert('배송 정보가 저장되었습니다.');
        fetchPart();
        fetchDeliveryOrders();
      })
      .catch((err) => {
        console.error('배송 저장 실패:', err);
        alert('배송 저장에 실패했습니다.');
      });
  };

  const fulfillOrder = (orderId, qty) => {
    fetch(`${process.env.REACT_APP_API_URL}/api/part_orders/${orderId}/fulfill`, {
      method: 'PATCH'
    })
      .then(res => {
        if (!res.ok) throw new Error("배송 완료 실패");
        return res.json();
      })
      .then(() => {
        alert("배송이 완료 처리되었습니다.");
        fetchPart();
        fetchDeliveryOrders();
      })
      .catch(err => {
        console.error("배송 완료 처리 실패:", err);
        alert("처리 중 오류가 발생했습니다.");
      });
  };

  useEffect(() => {
    fetchPart();
    fetchDeliveryOrders();
  }, [fetchPart, fetchDeliveryOrders]);

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validExt = ['png', 'jpg', 'jpeg'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!validExt.includes(ext)) {
      alert("png/jpg/jpeg/gif만 업로드 가능합니다.");
      return;
    }

    const safeName = encodeURIComponent(part.part_name || `part_${id}`);
    const filename = `${safeName}.${ext}`;

    const formData = new FormData();
    formData.append('image', file, filename);

    fetch(`${process.env.REACT_APP_API_URL}/api/parts/${id}/upload-image`, {
      method: 'POST',
      body: formData,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`이미지 업로드 실패: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        alert("이미지가 업로드되었습니다.");
        fetchPart();
      })
      .catch((err) => {
        console.error("이미지 업로드 중 오류:", err);
        alert("이미지 업로드에 실패했습니다.");
      });
  };

  const renderRow = (label, key, isTextarea = false) => (
    <tr key={key}>
      <th style={{ width: '30%' }}>{label}</th>
      <td>
        {isEditing ? (
          <Form.Control
            size="sm"
            type={isTextarea ? undefined : "text"}
            as={isTextarea ? "textarea" : undefined}
            rows={isTextarea ? 2 : undefined}
            value={editedPart[key] ?? part[key] ?? ""}
            onChange={(e) => onChangeField(key, e.target.value)}
          />
        ) : (
          part[key] || "-"
        )}
      </td>
    </tr>
  );

  const onChangeField = (key, value) => {
    setEditedPart((prev) => ({ ...prev, [key]: value }));
  };

  const formatDate = (isoString) => {
    if (!isoString) return "-";
    return new Date(isoString).toLocaleDateString();
  };

  const handleSave = useCallback(() => {
    const payload = {
      ...part,
      ...editedPart,
      quantity: (editedPart.quantity ?? part.quantity ?? 0),
      category_medium: editedPart.category_medium ?? part.category_medium ?? "",
      category_small: editedPart.category_small ?? part.category_small ?? "",
      mounting_type: editedPart.mounting_type ?? part.mounting_type ?? "",
      location: editedPart.location ?? part.location ?? "",
      memo: editedPart.memo ?? part.memo ?? "",
      description: editedPart.description ?? part.description ?? "",
      last_modified_user: selectedUser?.value || 'Unknown',
    };

    fetch(`${process.env.REACT_APP_API_URL}/api/parts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`서버 응답 오류: ${res.status}`);
        return res.json();
      })
      .then(() => {
        setIsEditing(false);
        setEditedPart({});
        console.log(payload)
        alert("수정이 완료되었습니다.");
        fetchPart();
      })
      .catch((err) => {
        console.error("수정 실패:", err);
        alert("수정에 실패했습니다. 잠시 후 다시 시도해주세요.");
      });
  }, [part, editedPart, selectedUser, id, fetchPart]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter" && isEditing) {
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditing, handleSave]);

  // 부품 삭제
  const handleDeleteSingle = (partId) => {
    if (!window.confirm(`부품 ${partId}를 삭제하시겠습니까?`)) return;

    fetch(`${process.env.REACT_APP_API_URL}/api/parts`, {
      method: "DELETE",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [partId] })
    })
      .then(res => {
        if (!res.ok) throw new Error(`삭제 실패: ${res.status}`);
        return res.json();
      })
      .then(() => {
        alert("부품이 삭제되었습니다.");
        navigate('/partsPage');
      })
      .catch((err) => {
        console.error("삭제 중 오류:", err);
        alert("삭제 중 오류가 발생했습니다.");
      });
  };

  // 에러
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: "60vh" }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }
  if (!part || part.error) {
    return <div className="text-center mt-5">부품을 찾을 수 없습니다.</div>;
  }

  return (
    <div className="container mt-4">
      <Row className="align-items-center mb-3">
        <Col className="d-flex gap-2 align-items-center">
          <h2 className="fw-bold fs-3 mb-1">{part.part_name || "부품 상세"}</h2>
          <Badge bg="secondary" className="me-1">{part.category_large || "대분류 없음"}</Badge>
        </Col>
        <Col className="text-end">
          <ButtonGroup>
            {!isEditing && (
              <Button variant="outline-primary" onClick={() => {
                setEditedPart(part);
                setIsEditing(true);
              }}>
                <FiEdit size={18} />
              </Button>
            )}
            {isEditing && (
              <Button variant="outline-success" onClick={handleSave}>
                <FiSave size={18} />
              </Button>
            )}
            {isEditing && (
              <Button variant="outline-secondary" onClick={() => setIsEditing(false)}>
                <FiX size={18} />
              </Button>
            )}
            <Button variant="outline-danger" onClick={() => handleDeleteSingle(part.id)}>
              <FiTrash2 size={18} />
            </Button>
          </ButtonGroup>
        </Col>
      </Row>

      <Card className="shadow-sm mb-4">
        <Card.Body>
          <Row>
            <Col md={3} className="d-flex justify-content-center align-items-center">
              <div className="image-upload-container">
                <img
                  src={
                    part.image_url
                      ? `${process.env.REACT_APP_API_URL}${part.image_url}`
                      : '/default-part-icon.png'
                  }
                  alt="부품 이미지"
                  className="img-fluid"
                  style={{
                    width: "200px",
                    minHeight: "160px",
                    objectFit: "contain",
                    backgroundColor: "#f8f9fa",
                    borderRadius: "8px",
                    position: "relative",
                    zIndex: 1,
                  }}
                />

                {isEditing && (
                  <div className="image-upload-overlay" onClick={handleUploadClick}>
                    <FiUpload size={28} className="upload-icon" />
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </div>
            </Col>

            <Col md={9}>
              <ListGroup variant="flush">
                <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                  <strong>부품명</strong>
                  {isEditing ? (
                    <Form.Control
                      size="sm"
                      type="text"
                      value={editedPart.part_name || ""}
                      onChange={(e) => onChangeField("part_name", e.target.value)}
                      style={{ maxWidth: "200px" }}
                    />
                  ) : (
                    <span>{part.part_name || "-"}</span>
                  )}
                </ListGroup.Item>

                <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                  <strong>보관 위치</strong>
                  {isEditing ? (
                    <Form.Control
                      size="sm"
                      type="text"
                      value={editedPart.location || ""}
                      onChange={(e) => onChangeField("location", e.target.value)}
                      style={{ maxWidth: "200px" }}
                    />
                  ) : (
                    <Badge bg="primary" className="me-1">{part.location || "-"}</Badge>
                  )}
                </ListGroup.Item>

                <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                  <strong>패키지</strong>
                  {isEditing ? (
                    <Form.Control
                      size="sm"
                      type="text"
                      value={editedPart.package || ""}
                      onChange={(e) => onChangeField("package", e.target.value)}
                      style={{ maxWidth: "200px" }}
                    />
                  ) : (
                    <span>{part.package || "-"}</span>
                  )}
                </ListGroup.Item>

                <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                  <strong>value</strong>
                  {isEditing ? (
                    <Form.Control
                      size="sm"
                      type="text"
                      value={editedPart.value || ""}
                      onChange={(e) => onChangeField("value", e.target.value)}
                      style={{ maxWidth: "200px" }}
                    />
                  ) : (
                    <span>{part.value || "-"}</span>
                  )}
                </ListGroup.Item>

                <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                  <strong>가격</strong>
                  {isEditing ? (
                    <Form.Control
                      size="sm"
                      type="number"
                      value={editedPart.price || ""}
                      onChange={(e) => onChangeField("price", e.target.value)}
                      style={{ maxWidth: "120px" }}
                    />
                  ) : (
                    <span>{part.price ? `${part.price}원` : "-"}</span>
                  )}
                </ListGroup.Item>

                <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                  <strong>수량</strong>
                  {isEditing ? (
                    <Form.Control
                      size="sm"
                      type="number"
                      value={editedPart.quantity || ""}
                      onChange={(e) => onChangeField("quantity", e.target.value)}
                      style={{ maxWidth: "100px" }}
                    />
                  ) : (
                    <span>{part.quantity ?? "-"}</span>
                  )}
                </ListGroup.Item>

                <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                  <strong>총 주문 수량</strong>
                  <span>{part.ordered_quantity ?? "-"}</span>
                </ListGroup.Item>

                <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                  <strong>구매 링크</strong>
                  {isEditing ? (
                    <Form.Control
                      size="sm"
                      type="text"
                      value={editedPart.purchase_url || ""}
                      onChange={(e) => onChangeField("purchase_url", e.target.value)}
                      style={{ maxWidth: "300px" }}
                    />
                  ) : (
                    part.purchase_url ? (
                      <a href={part.purchase_url} target="_blank" rel="noopener noreferrer">
                        {part.purchase_url}
                      </a>
                    ) : (
                      <span>-</span>
                    )
                  )}
                </ListGroup.Item>
              </ListGroup>
            </Col>
          </Row>
          <Row>
            {isEditing ? (
              <div></div>
            ) : (
              <Col>
                {deliveryOrders.map(order => (
                  <Card className="mt-3" key={order.id}>
                    <Card.Body className="d-flex justify-content-between align-items-center">
                      <div>
                        <strong>날짜:</strong> {order.order_date} &nbsp;
                        <strong>수량:</strong> {order.quantity_ordered}
                      </div>
                      <Button
                        variant="outline-success"
                        size="sm"
                        onClick={() => {
                          if (!window.confirm("배송을 완료 처리하시겠습니까?")) return;
                          fulfillOrder(order.id, order.quantity_ordered);
                        }}
                      >
                        배송 완료
                      </Button>
                    </Card.Body>
                  </Card>
                ))}
                <div className='d-flex flex-row-reverse mt-3'>
                  <Button variant="outline-primary" onClick={() => setShowOrderModal(true)}>
                    발주하기
                  </Button>
                </div>
              </Col>
            )}
          </Row>
        </Card.Body>
      </Card>

      <Card className="mb-2">
        <Card.Body className="p-0">
          <Table striped bordered hover responsive className="mb-0 shadow-sm rounded table-custom">
            <tbody>
              {renderRow("대분류", "category_large")}
              {renderRow("중분류", "category_medium")}
              {renderRow("소분류", "category_small")}
              {renderRow("제조사", "manufacturer")}
              {renderRow("장착 타입", "mounting_type")}
              {renderRow("메모", "memo", true)}
              {renderRow("설명", "description", true)}
              <tr>
                <th>등록일</th>
                <td>{formatDate(part.create_date)}</td>
              </tr>
              <tr>
                <th>수정일</th>
                <td>{formatDate(part.update_date)}</td>
              </tr>
              <tr>
                <th>마지막 수정자</th>
                <td>{part.last_modified_user}</td>
              </tr>
            </tbody>
          </Table>
        </Card.Body>
      </Card>
      <Modal show={showOrderModal} onHide={() => setShowOrderModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>발주 입력</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>날짜</Form.Label>
            <Form.Control
              type="date"
              value={newOrderDate}
              onChange={(e) => setNewOrderDate(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>수량</Form.Label>
            <Form.Control
              type="number"
              min="1"
              value={newOrderQty}
              onChange={(e) => setNewOrderQty(parseInt(e.target.value))}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowOrderModal(false)}>취소</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (newOrderQty <= 0) {
                alert("수량은 1 이상이어야 합니다.");
                return;
              }
              saveOrder({
                order_date: newOrderDate,
                quantity_ordered: newOrderQty
              });
              setShowOrderModal(false);
              setNewOrderQty(1);
            }}
          >
            발주
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};
export default PartDetailPage;
