import React, { useState } from 'react';
import { Form, Button, Alert } from 'react-bootstrap';
import { useCsvUploader } from '../hooks/UploadCsv';

// 환경변수에서 서버 URL 불러오기
// CRA에서는 반드시 "REACT_APP_" prefix가 있어야 합니다.
const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:8000";

const UploadBuildParts = () => {
  const [partName, setPartName] = useState('');
  const [quantity, setQuantity] = useState('');
  const {
    file, handleFileChange, handleUploadWithData, message
  } = useCsvUploader(`${SERVER_URL}/api/upload/buildParts`);

  const handleSubmit = () => {
    handleUploadWithData({ part_name: partName, quantity });
  };

  return (
    <>
      <Form.Group controlId="formFile" className="mb-3">
        <Form.Label>CSV 파일 선택</Form.Label>
        <Form.Control type="file" accept=".csv" onChange={handleFileChange} />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>BOM Name</Form.Label>
        <Form.Control
          type="text"
          placeholder="예: Generic Part"
          value={partName}
          onChange={(e) => setPartName(e.target.value)}
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Quantity</Form.Label>
        <Form.Control
          type="number"
          placeholder="예: 10"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </Form.Group>

      <Button onClick={handleSubmit} disabled={!file || !partName || !quantity}>
        업로드
      </Button>

      {message && (
        <Alert variant="info" className="mt-3" style={{ whiteSpace: 'pre-wrap' }}>
          {message}
        </Alert>
      )}
    </>
  );
};

export default UploadBuildParts;
