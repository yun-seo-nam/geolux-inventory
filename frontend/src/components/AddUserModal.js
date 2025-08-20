import React, { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

const AddUserModal = ({ show, onHide, onAddUser }) => {
  const [newUserName, setNewUserName] = useState('');

  const handleAdd = () => {
    const trimmedName = newUserName.trim();
    if (!trimmedName) return;

    const success = onAddUser({ label: trimmedName, value: trimmedName });
    if (success) {
      setNewUserName('');
      onHide();
    }
  };

  const handleClose = () => {
    setNewUserName('');
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>사용자 추가</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Control
          type="text"
          placeholder="새 사용자명 입력"
          value={newUserName}
          onChange={e => setNewUserName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
            if (e.key === 'Escape') {
              handleClose();
            }
          }}
          autoFocus
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          취소
        </Button>
        <Button variant="primary" onClick={handleAdd}>
          추가
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddUserModal;
