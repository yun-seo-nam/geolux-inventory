// src/components/UploadPart.js
import React, { useEffect, useRef, useState } from "react";

const UploadPart = ({ show, handleClose, onPartAdded, presetName }) => {
  const [form, setForm] = useState({
    part_name: "",
    quantity: "",
    price: "",
    supplier: "",
    purchase_date: "",
    location: "",
    description: "",
    manufacturer: "",
    mounting_type: "",
    package: "",
    purchase_url: "",
    memo: "",
    category_large: "미정",
    category_medium: "미정",
    category_small: "미정",
  });
  const [errors, setErrors] = useState({});
  const [touchedName, setTouchedName] = useState(false);

  const SERVER_URL =
    process.env.REACT_APP_SERVER_URL || "http://localhost:8000";

  const panelRef = useRef(null);

  useEffect(() => {
    if (show) {
      // 배경 스크롤 잠금 + 첫 필드 포커스
      document.body.style.overflow = "hidden";
      setTimeout(() => {
        panelRef.current
          ?.querySelector('input[name="part_name"]')
          ?.focus();
      }, 0);
    } else {
      document.body.style.overflow = "";
      setTouchedName(false);
    }
    return () => (document.body.style.overflow = "");
  }, [show]);

  useEffect(() => {
    if (!show) return;
    if (touchedName) return;
    setForm((s) => ({ ...s, part_name: presetName || "" }));
  }, [presetName, show, touchedName]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
    setErrors((s) => ({ ...s, [name]: "" }));
    if (name === "part_name" && !touchedName) setTouchedName(true);
  };

  const handleKeyDown = (e) => {
    const isTextArea = e.target.tagName.toLowerCase() === "textarea";
    if (!isTextArea && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    const newErrors = {};
    if (!form.part_name.trim())
      newErrors.part_name = "부품 이름은 필수입니다.";

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    // 숫자 보정
    const payload = {
      ...form,
      quantity: form.quantity === "" ? 0 : Number(form.quantity),
      price: form.price === "" ? 0 : Number(form.price),
    };

    try {
      const res = await fetch(`${SERVER_URL}/api/parts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || "등록 실패");
      }
      onPartAdded?.();
      handleClose?.();
      setForm({
        part_name: "",
        quantity: "",
        price: "",
        supplier: "",
        purchase_date: "",
        location: "",
        description: "",
        manufacturer: "",
        mounting_type: "",
        package: "",
        purchase_url: "",
        memo: "",
        category_large: "미정",
        category_medium: "미정",
        category_small: "미정",
      });
      setErrors({});
    } catch (err) {
      alert("등록 중 오류가 발생했습니다.\n" + (err.message || err));
      console.error(err);
    }
  };

  if (!show) return null;

  const closeIfBackdrop = (e) => {
    if (e.target === e.currentTarget) handleClose?.();
  };

  const handleClose_Reset = async () => {
    handleClose()
    setForm({
      part_name: "",
      quantity: "",
      price: "",
      supplier: "",
      purchase_date: "",
      location: "",
      description: "",
      manufacturer: "",
      mounting_type: "",
      package: "",
      purchase_url: "",
      memo: "",
      category_large: "미정",
      category_medium: "미정",
      category_small: "미정",
    });
  }

  return (
    <div className="up-overlay" onClick={closeIfBackdrop} onKeyDown={handleKeyDown}>
      <div className="up-panel" ref={panelRef}>
        <div className="up-header">
          <h3 className="up-title">부품 등록</h3>
          <div className="up-actions">
            <button className="up-btn up-ghost" onClick={handleClose_Reset}>
              닫기
            </button>
            <button className="up-btn up-primary" onClick={handleSubmit}>
              저장
            </button>
          </div>
        </div>

        <div className="up-form">
          {/* 한 줄: 라벨 + 입력 (세로 여백 최소) */}
          <div className={`up-row ${errors.part_name ? "up-error" : ""}`}>
            <label htmlFor="part_name">품명*</label>
            <input
              id="part_name"
              name="part_name"
              type="text"
              value={form.part_name}
              onChange={handleChange}
            />
            {errors.part_name && <div className="up-msg">{errors.part_name}</div>}
          </div>

          <div className="up-row">
            <label htmlFor="quantity">수량</label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              inputMode="numeric"
              value={form.quantity}
              onChange={handleChange}
            />
          </div>

          <div className="up-row">
            <label htmlFor="price">가격</label>
            <input
              id="price"
              name="price"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={form.price}
              onChange={handleChange}
            />
          </div>

          <div className="up-row">
            <label htmlFor="supplier">공급업체</label>
            <input
              id="supplier"
              name="supplier"
              type="text"
              value={form.supplier}
              onChange={handleChange}
            />
          </div>

          <div className="up-row">
            <label htmlFor="purchase_date">구매일</label>
            <input
              id="purchase_date"
              name="purchase_date"
              type="date"
              value={form.purchase_date}
              onChange={handleChange}
            />
          </div>

          <div className="up-row">
            <label htmlFor="location">위치</label>
            <input
              id="location"
              name="location"
              type="text"
              value={form.location}
              onChange={handleChange}
            />
          </div>

          <div className="up-row">
            <label htmlFor="description">설명</label>
            <textarea
              id="description"
              name="description"
              rows={2}
              value={form.description}
              onChange={handleChange}
            />
          </div>

          <div className="up-row">
            <label htmlFor="manufacturer">제조사</label>
            <input
              id="manufacturer"
              name="manufacturer"
              type="text"
              value={form.manufacturer}
              onChange={handleChange}
            />
          </div>

          <div className="up-row">
            <label htmlFor="mounting_type">Type</label>
            <input
              id="mounting_type"
              name="mounting_type"
              type="text"
              value={form.mounting_type}
              onChange={handleChange}
            />
          </div>

          <div className="up-row">
            <label htmlFor="package">패키지</label>
            <input
              id="package"
              name="package"
              type="text"
              value={form.package}
              onChange={handleChange}
            />
          </div>

          <div className="up-row">
            <label htmlFor="purchase_url">URL</label>
            <input
              id="purchase_url"
              name="purchase_url"
              type="url"
              value={form.purchase_url}
              onChange={handleChange}
              placeholder="https://…"
            />
          </div>

          <div className="up-row">
            <label htmlFor="memo">Memo</label>
            <textarea
              id="memo"
              name="memo"
              rows={2}
              value={form.memo}
              onChange={handleChange}
            />
          </div>

          <div className="up-row">
            <label htmlFor="category_large">대분류</label>
            <input
              id="category_large"
              name="category_large"
              type="text"
              value={form.category_large}
              onChange={handleChange}
            />
          </div>

          <div className="up-row">
            <label htmlFor="category_medium">중분류</label>
            <input
              id="category_medium"
              name="category_medium"
              type="text"
              value={form.category_medium}
              onChange={handleChange}
            />
          </div>

          <div className="up-row">
            <label htmlFor="category_small">소분류</label>
            <input
              id="category_small"
              name="category_small"
              type="text"
              value={form.category_small}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      {/* 컴포넌트 내부에 스타일 주입 (부트스트랩 무시) */}
      <style>{`
        .up-overlay {
          position: fixed;
          inset: 0;
          z-index: 2050;
          display: grid;
          place-items: center;
        }
        .up-panel {
          --label-w: 140px;
          --row-h: 34px;
          --gap: 8px;
          --font: 14px;
          --radius: 12px;

          width: min(1180px, 96vw);
          height: min(88vh, 900px);
          background: #101214;
          color: #e6e6e6;
          border-radius: var(--radius);
          box-shadow: 0 10px 40px rgba(0,0,0,0.35);
          display: grid;
          grid-template-rows: auto 1fr auto;
          overflow: hidden;
          font-size: var(--font);
          line-height: 1.2;
        }
        .up-header, .up-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: rgba(255,255,255,0.03);
        }
        .up-title { margin: 0; font-size: 18px; font-weight: 600; }
        .up-actions { display: flex; gap: 8px; }
        .up-form {
          padding: 10px 14px;
          display: grid;
          grid-auto-rows: min-content;
          gap: var(--gap);
          overflow: auto; /* 화면 작을 때만 스크롤 */
          background: transparent;
        }
        .up-row {
          display: grid;
          grid-template-columns: var(--label-w) 1fr;
          align-items: center;
          gap: 10px;
          min-height: var(--row-h);
        }
        .up-row > label {
          white-space: nowrap;
          opacity: 0.9;
        }
        .up-row input, .up-row textarea {
          width: 100%;
          height: var(--row-h);
          box-sizing: border-box;
          padding: 6px 10px;
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.06);
          color: inherit;
          border-radius: 8px;
          outline: none;
        }
        .up-row textarea {
          height: calc(var(--row-h) * 1.6);
          resize: vertical;
          min-height: var(--row-h);
        }
        .up-row input:focus, .up-row textarea:focus {
          border-color: #7aa2ff;
          box-shadow: 0 0 0 2px rgba(122,162,255,0.25);
        }
        .up-row.up-error .up-msg {
          grid-column: 2 / 3;
          margin-top: 4px;
          font-size: 12px;
          color: #ff8a8a;
        }
        .up-btn {
          appearance: none;
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.06);
          color: inherit;
          padding: 8px 14px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 14px;
        }
        .up-btn:hover { background: rgba(255,255,255,0.12); }
        .up-btn.up-primary {
          background: #3b82f6;
          border-color: #3b82f6;
          color: #fff;
        }
        .up-btn.up-primary:hover { background: #2563eb; }
        .up-btn.up-ghost { background: transparent; border: 1px solid #999999ff; }
        @media (prefers-color-scheme: light) {
          .up-panel { background: #f8fafc; color: #0b1220; }
          .up-row input, .up-row textarea { background: #fff; border-color: rgba(0,0,0,0.15); }
        }
      `}</style>
    </div>
  );
};

export default UploadPart;
