import React, { useState, useEffect } from "react";
import { useUser } from "../hooks/UserContext";

export default function LoginPage({ api }) {
  const { setUser } = useUser();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 로그인 페이지 뜰 때 스크롤 차단
    document.body.style.overflow = "hidden";
    return () => {
      // 컴포넌트 사라지면 다시 스크롤 복구
      document.body.style.overflow = "auto";
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/login", { username, password });
      setUser(res.data.user);
    } catch (err) {
      alert("로그인 실패: " + (err.response?.data?.msg || "서버 오류"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h2 className="login-title mb-4">GeoluxStock</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group floating-label">
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <label htmlFor="username">아이디</label>
          </div>
          <div className="form-group floating-label">
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <label htmlFor="password">비밀번호</label>
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
