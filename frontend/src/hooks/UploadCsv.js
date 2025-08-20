import { useState } from 'react';
import axios from 'axios';

export const useCsvUploader = (uploadUrl) => {
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
      const res = await axios.post(uploadUrl, formData);
      setMessage(`업로드 성공: ${res.data.inserted}개 등록됨`);
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
