import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Spinner, Form, Row, Col, Badge, Table, ButtonGroup, Modal } from 'react-bootstrap';
import { FiEdit, FiTrash2, FiSave, FiX } from 'react-icons/fi';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:8000";

const PartDetailPage = () => {
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
    fetch(`${SERVER_URL}/api/parts/${id}`)
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
    fetch(`${SERVER_URL}/api/parts/${id}/orders`)
      .then(res => res.json())
      .then(data => {
        setDeliveryOrders(data);
      })
      .catch(err => {
        console.error("배송 정보 로딩 실패:", err);
      });
  }, [id]);

  const saveOrder = (order) => {
    fetch(`${SERVER_URL}/api/part_orders`, {
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
    fetch(`${SERVER_URL}/api/part_orders/${orderId}/fulfill`, {
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

    fetch(`${SERVER_URL}/api/parts/${id}/upload-image`, {
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
      supplier: editedPart.supplier ?? part.supplier ?? ""
    };

    fetch(`${SERVER_URL}/api/parts/${id}`, {
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
  }, [part, editedPart, id, fetchPart]);

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
    if (!window.confirm(`${part.part_name}를 삭제하시겠습니까?`)) return;

    fetch(`${SERVER_URL}/api/parts`, {
      method: "DELETE",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [partId] })
    })
      .then(async (res) => {
        // 서버가 보내준 본문 먼저 읽기
        const body = await res.json();

        if (!res.ok) {
          // 에러일 때 백엔드의 메시지를 그대로 띄우기
          alert(body.error || JSON.stringify(body));
          throw new Error(body.error || '삭제 실패');
        }

        // 정상일 때 body 그대로 리턴
        return body;
      })
      .then(() => {
        alert("부품이 삭제되었습니다.");
        navigate('/partsPage');
      })
      .catch((err) => {
        console.error(err);
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
              <Button variant="primary" onClick={() => {
                setEditedPart(part);
                setIsEditing(true);
              }}>
                <FiEdit size={18} />
              </Button>
            )}
            {isEditing && (
              <Button variant="success" onClick={handleSave}>
                <FiSave size={18} />
              </Button>
            )}
            {isEditing && (
              <Button variant="secondary" onClick={() => setIsEditing(false)}>
                <FiX size={18} />
              </Button>
            )}
            <Button variant="danger" onClick={() => handleDeleteSingle(part.id)}>
              <FiTrash2 size={18} />
            </Button>
          </ButtonGroup>
        </Col>
      </Row>

      <Card className="shadow-sm mb-4">
        <Card.Body>
          <Row>
            <Col md={3}>
              <div
                className="position-relative image-container"
                style={{
                  width: "100%",
                  maxWidth: "220px",
                  margin: "0 auto",
                }}
                onMouseEnter={() => {
                  const overlay = document.getElementById('upload-overlay');
                  if (overlay) overlay.style.opacity = '1';
                }}
                onMouseLeave={() => {
                  const overlay = document.getElementById('upload-overlay');
                  if (overlay) overlay.style.opacity = '0';
                }}
              >
                <Zoom>
                  <img
                    src={
                      part.image_filename
                        ? `${SERVER_URL}/static/images/parts/${part.image_filename}`
                        : '/default-part-icon.png'
                    }
                    alt="part"
                    className="img-fluid rounded"
                    style={{
                      width: "100%",
                      maxHeight: "170px",
                      objectFit: "contain",
                      border: "1px solid #eee",
                    }}
                  />
                </Zoom>

                <div
                  id="upload-overlay"
                  className="position-absolute bottom-0 end-0 p-2"
                  style={{
                    opacity: 0,
                    transition: "opacity 0.3s",
                    width: "auto",
                    height: "auto",
                    borderRadius: "8px",
                    zIndex: 3,
                    pointerEvents: "none",
                  }}
                >
                  {/* 이미지 변경 버튼 */}
                  <button
                    className="btn btn-sm btn-dark shadow-sm"
                    onClick={handleUploadClick}
                    style={{ pointerEvents: "auto", fontWeight: "bold" }}
                  >
                    이미지 변경
                  </button>
                </div>

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
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="mb-2">
        <Card.Body className="p-0">
          <Table striped bordered hover responsive className="mb-0 shadow-sm rounded table-custom">
            <tbody>
              {renderRow("품명", "part_name")}
              {renderRow("수량", "quantity")}
              {renderRow("가격", "price")}
              {renderRow("공급업체", "supplier")}
              {renderRow("위치", "location")}
              {renderRow("설명", "description", true)}
              {renderRow("제조사", "manufacturer")}
              {renderRow("Type", "mounting_type")}
              {renderRow("패키지", "package")}
              {renderRow("URL", "purchase_url")}
              {renderRow("Memo", "memo", true)}

              {renderRow("대분류", "category_large")}
              {renderRow("중분류", "category_medium")}
              {renderRow("소분류", "category_small")}
              <tr>
                <th>등록일</th>
                <td>{formatDate(part.create_date)}</td>
              </tr>
              <tr>
                <th>수정일</th>
                <td>{formatDate(part.update_date)}</td>
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
