import { useState } from 'react';
import axios from 'axios';

// CRA/Vite에서 환경변수 읽기
const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:8000";

export const useCsvUploader = (uploadPath) => {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUploadWithData = async (extraData = {}) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    // JSON 필드를 같이 보내는 경우
    for (const key in extraData) {
      formData.append(key, extraData[key]);
    }

    try {
      // uploadPath는 "/api/assemblies/upload_csv" 같은 상대경로만 받음
      const res = await axios.post(`${SERVER_URL}${uploadPath}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage(`업로드 성공: ${res.data.inserted || 0}개 등록됨`);
    } catch (err) {
      setMessage(`오류: ${err.response?.data?.error || err.message}`);
    }
  };

  return {
    file,
    message,
    handleFileChange,
    handleUploadWithData,
  };
};
