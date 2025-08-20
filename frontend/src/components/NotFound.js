// pages/NotFound.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MdWarningAmber } from 'react-icons/md';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="d-flex flex-column align-items-center justify-content-center vh-100 text-center bg-light">
      <MdWarningAmber size={80} />
      <h1 className="mt-3">404 - 페이지를 찾을 수 없습니다</h1>
      <p className="text-muted">요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.</p>
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          color: 'blue',
          textDecoration: 'underline',
          cursor: 'pointer',
        }}
      >
        홈으로 이동
      </button>
    </div>
  );
};

export default NotFound;
