import React, { useState, useContext, useEffect } from 'react';
import { UserContext } from '../hooks/UserContext';
import { Modal, Button, Form } from 'react-bootstrap';

const UploadPart = ({ show, handleClose, onPartAdded }) => {
  const [form, setForm] = useState({
    part_name: '',
    category_large: '',
    quantity: '',
    ordered_quantity: '',
    price: '',
    manufacturer: '',
    value: '',
    package: '',
    description: '',
  });

  const [errors, setErrors] = useState({});
  const { selectedUser } = useContext(UserContext);

  // 디버깅용 로그
  useEffect(() => {
    console.log("UploadPart 컴포넌트 렌더링됨");
    console.log("현재 selectedUser 상태:", selectedUser);
  }, [selectedUser]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
  };

  const handleSubmit = async () => {
    const newErrors = {};
    if (!form.part_name) newErrors.part_name = '부품 이름은 필수입니다.';
    if (!form.category_large) newErrors.category_large = '대분류는 필수입니다.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const lastModifiedUser = selectedUser?.label || "Unknown";

    console.log("등록 요청 시 last_modified_user 값:", lastModifiedUser);

    const payload = {
      ...form,
      last_modified_user: selectedUser?.label || "Unknown",
    };

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("서버 응답 실패:", errText);
        throw new Error('등록 실패');
      }

      console.log("등록 성공");
      onPartAdded();
      handleClose();
      setForm({
        part_name: '',
        category_large: '',
        quantity: '',
        ordered_quantity: '',
        price: '',
        manufacturer: '',
        package: '',
        description: '',
      });
      setErrors({});
    } catch (err) {
      console.error("등록 중 오류:", err);
      alert('등록 중 오류가 발생했습니다.');
    }
  };

  return (
    <Modal show={show} onHide={handleClose} centered
      size="md" scrollable>
      <Modal.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label className={errors.part_name ? 'text-danger' : ''}>
              부품 이름 (필수)
            </Form.Label>
            <Form.Control
              type="text"
              name="part_name"
              value={form.part_name}
              onChange={handleChange}
              isInvalid={!!errors.part_name}
            />
            <Form.Control.Feedback type="invalid">{errors.part_name}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className={errors.category_large ? 'text-danger' : ''}>
              대분류 (필수)
            </Form.Label>
            <Form.Control
              type="text"
              name="category_large"
              value={form.category_large}
              onChange={handleChange}
              isInvalid={!!errors.category_large}
            />
            <Form.Control.Feedback type="invalid">{errors.category_large}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>재고 수량</Form.Label>
            <Form.Control
              type="number"
              name="quantity"
              value={form.quantity}
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>주문 수량</Form.Label>
            <Form.Control
              type="number"
              name="ordered_quantity"
              value={form.ordered_quantity}
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>가격</Form.Label>
            <Form.Control
              type="number"
              name="price"
              value={form.price}
              onChange={handleChange}
              step="0.01"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>제조사</Form.Label>
            <Form.Control
              type="text"
              name="manufacturer"
              value={form.manufacturer}
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Value</Form.Label>
            <Form.Control
              type="text"
              name="value"
              value={form.value}
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>패키지</Form.Label>
            <Form.Control
              type="text"
              name="package"
              value={form.package}
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>설명</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              name="description"
              value={form.description}
              onChange={handleChange}
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>닫기</Button>
        <Button variant="primary" onClick={handleSubmit}>저장</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default UploadPart;
