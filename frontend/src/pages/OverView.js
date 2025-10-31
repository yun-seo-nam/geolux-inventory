import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Form, Button, Dropdown, DropdownButton, Spinner } from 'react-bootstrap';
import { FiSave, FiTrash2 } from 'react-icons/fi';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:8000";

const AdminOverview = () => {
  const [entity, setEntity] = useState("parts"); // 기본값: parts
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState({}); // id별 변경된 값 저장
  const [saving, setSaving] = useState(new Set());
  const [q, setQ] = useState(""); // 🔍 검색어
  const [selected, setSelected] = useState(new Set()); // ✅ 선택된 id

  // 수정 가능한 컬럼 정의
  const editableColumns = {
    parts: [
      "part_name", "quantity", "ordered_quantity", "price", "value", "supplier",
      "purchase_url", "manufacturer", "description",
      "mounting_type", "package", "location", "memo",
      "category_large", "category_medium", "category_small",
      "image_filename"
    ],
    assemblies: [
      "assembly_name","quantity_to_build","description",
      "image_filename","version",
      "manufacturing_method","work_date","work_duration",
      "is_soldered","is_tested","status"
    ],
    projects: [
      "project_name","description"
    ]
  };

  // 테이블에 표시하는 컬럼(네가 준 그대로)
  const columns = {
    parts: [...editableColumns.parts],
    assemblies: [...editableColumns.assemblies],
    projects: [...editableColumns.projects]
  };

  const searchFields = {
    parts: [
      "part_name","value","manufacturer","package","location",
      "description","memo","supplier","purchase_url",
      "category_large","category_medium","category_small"
    ],
    assemblies: [
      "assembly_name","status","manufacturing_method","version","description"
    ],
    projects: [
      "project_name","description"
    ]
  };

  // 데이터 불러오기
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/${entity}`);
      const data = await res.json();
      setRows(data);
      setSelected(new Set()); // 엔터티 바꾸면 선택 초기화
    } catch (err) {
      console.error(err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [entity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 셀 변경 처리
  const handleChange = (id, key, value) => {
    // Boolean 처리
    let parsedValue = value;
    if (["is_soldered", "is_tested"].includes(key)) {
      parsedValue = value === "true" || value === true;
    }

    setRows(prev => prev.map(r => r.id === id ? { ...r, [key]: parsedValue } : r));
    setDirty(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [key]: parsedValue }
    }));
  };

  // 행 단위 저장
  const saveRow = async (id) => {
    let changes = dirty[id];
    if (!changes) return;

    // editable 컬럼만 추출
    changes = Object.fromEntries(
      Object.entries(changes).filter(([k]) => editableColumns[entity].includes(k))
    );

    try {
      setSaving(prev => new Set(prev).add(id));
      const res = await fetch(`${SERVER_URL}/api/${entity}/full/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes)
      });
      if (!res.ok) throw new Error(`저장 실패: ${res.status}`);
      setDirty(prev => {
        const cp = { ...prev };
        delete cp[id];
        return cp;
      });
      await fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(prev => {
        const cp = new Set(prev);
        cp.delete(id);
        return cp;
      });
    }
  };

  // 전체 저장
  const saveAll = async () => {
    const ids = Object.keys(dirty);
    if (!ids.length) {
      alert("저장할 변경 사항이 없습니다.");
      return;
    }

    try {
      setSaving(new Set(ids.map(Number)));
      const results = await Promise.allSettled(
        ids.map(id => {
          let changes = dirty[id];
          changes = Object.fromEntries(
            Object.entries(changes).filter(([k]) => editableColumns[entity].includes(k))
          );
          return fetch(`${SERVER_URL}/api/${entity}/full/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(changes),
          });
        })
      );

      const failed = results.filter(r => r.status === "rejected" || (r.value && !r.value.ok));
      if (failed.length) {
        alert(`일부 저장 실패 (${failed.length}/${ids.length})`);
      } else {
        alert("모든 변경사항 저장 완료");
      }

      setDirty({});
      await fetchData();
    } catch (err) {
      console.error(err);
      alert("저장 중 오류 발생");
    } finally {
      setSaving(new Set());
    }
  };

  const filteredRows = useMemo(() => {
    const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return rows;
    const fields = searchFields[entity] || [];
    return rows.filter(row => {
      const hay = fields.map(f => (row && row[f] != null ? String(row[f]) : "")).join(" ").toLowerCase();
      return tokens.every(tk => hay.includes(tk));
    });
  }, [q, rows, entity]);

  const toggleOne = (id) => {
    setSelected(prev => {
      const cp = new Set(prev);
      if (cp.has(id)) cp.delete(id); else cp.add(id);
      return cp;
    });
  };
  const toggleAllFiltered = (checked) => {
    if (checked) {
      setSelected(new Set(filteredRows.map(r => r.id)));
    } else {
      // 필터에 보이는 것만 해제 (다른 선택은 유지)
      setSelected(prev => {
        const cp = new Set(prev);
        filteredRows.forEach(r => cp.delete(r.id));
        return cp;
      });
    }
  };
  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every(r => selected.has(r.id));

  // 🗑️ 개별 삭제
  const deleteOne = async (id) => {
    if (!window.confirm(`이 항목을 삭제할까요? (id=${id})`)) return;
    try {
      // 1) 일단 개별 DELETE 시도
      const res = await fetch(`${SERVER_URL}/api/${entity}/${id}`, { method: "DELETE" });
      if (!res.ok) {
        // 2) 폴백: bulk 형식만 지원하는 서버일 수 있음 → bulk로 재시도
        const bulk = await fetch(`${SERVER_URL}/api/${entity}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [id] })
        });
        if (!bulk.ok) {
          const msg = (await bulk.json().catch(()=>null))?.error || `삭제 실패: ${bulk.status}`;
          throw new Error(msg);
        }
      }
      // 로컬 상태 갱신
      setRows(prev => prev.filter(r => r.id !== id));
      setSelected(prev => { const cp = new Set(prev); cp.delete(id); return cp; });
      setDirty(prev => { const cp = { ...prev }; delete cp[id]; return cp; });
    } catch (err) {
      alert(err.message);
    }
  };

  // 🗑️ 선택 삭제
  const deleteSelected = async () => {
    const ids = Array.from(selected);
    if (!ids.length) {
      alert("선택된 항목이 없습니다.");
      return;
    }
    if (!window.confirm(`선택된 ${ids.length}개 항목을 삭제할까요?`)) return;

    try {
      // 1) bulk delete 먼저 시도
      let bulkOk = false;
      const res = await fetch(`${SERVER_URL}/api/${entity}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });
      if (res.ok) {
        bulkOk = true;
      }

      if (!bulkOk) {
        // 2) 폴백: 개별 DELETE 병렬
        const results = await Promise.allSettled(
          ids.map(id => fetch(`${SERVER_URL}/api/${entity}/${id}`, { method: "DELETE" }))
        );
        const failed = results.filter(r => r.status === "rejected" || (r.value && !r.value.ok));
        if (failed.length) {
          throw new Error(`일부 삭제 실패 (${failed.length}/${ids.length})`);
        }
      }

      // 성공 → 로컬 상태 정리
      setRows(prev => prev.filter(r => !selected.has(r.id)));
      setDirty(prev => {
        const cp = { ...prev };
        ids.forEach(id => delete cp[id]);
        return cp;
      });
      setSelected(new Set());
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="container-fluid">
      <style>{`
        .admin-toolbar {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }
        .admin-viewport {
          height: calc(100vh - 160px);
          min-height: 420px;
        }
        .table-scroll {
          width: 100%;
          height: 100%;
          overflow: auto;
          border-radius: 8px;
          border: 1px solid var(--bs-border-color, #dee2e6);
          background: var(--bs-body-bg);
        }
        .admin-table {
          margin: 0;
          table-layout: fixed;
          white-space: nowrap;
          font-size: 0.925rem;
        }
        .admin-table thead th {
          position: sticky;
          top: 0;
          z-index: 3;
          background: var(--bs-body-bg);
        }
        .admin-table th, .admin-table td {
          vertical-align: middle;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .col-sticky-left {
          position: sticky;
          left: 0;
          z-index: 4;
          background: var(--bs-body-bg);
        }
        .col-actions { min-width: 120px; }
        .cell-input { width: 100%; min-width: 120px; }
        .col-select { width: 44px; min-width: 44px; text-align: center; }
      `}</style>

      <div className="admin-toolbar">
        <DropdownButton id="dropdown-basic-button" title={entity}>
          <Dropdown.Item onClick={() => { setEntity("parts"); setQ(""); }}>Parts</Dropdown.Item>
          <Dropdown.Item onClick={() => { setEntity("assemblies"); setQ(""); }}>Assemblies</Dropdown.Item>
          <Dropdown.Item onClick={() => { setEntity("projects"); setQ(""); }}>Projects</Dropdown.Item>
        </DropdownButton>

        <Button
          variant="primary"
          onClick={saveAll}
          disabled={!Object.keys(dirty).length}
        >
          전체 저장
        </Button>

        {/* 🔍 검색창 */}
        <Form.Control
          size="sm"
          placeholder={`검색 (${entity})`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 420 }}
        />

        {/* 🗑️ 선택 삭제 */}
        <Button
          variant="danger"
          onClick={deleteSelected}
          disabled={selected.size === 0}
        >
          선택 삭제 ({selected.size})
        </Button>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center align-items-center" style={{ height: "50vh" }}>
          <Spinner animation="border" />
        </div>
      ) : (
        <div className="admin-viewport mt-3">
          <div className="table-scroll">
            <Table
              striped
              bordered
              hover
              responsive={false}
              size="sm"
              className="admin-table"
            >
              <thead>
                <tr>
                  <th className="col-select">
                    <Form.Check
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={(e) => toggleAllFiltered(e.target.checked)}
                      title="표시된 항목 전체 선택/해제"
                    />
                  </th>

                  {columns[entity].map((col, idx) => (
                    <th
                      key={col}
                      className={idx === 0 ? 'col-sticky-left' : ''}
                      title={col}
                    >
                      {col}
                    </th>
                  ))}
                  <th className="col-actions">작업</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(row => (
                  <tr key={row.id}>
                    {/* ✅ 행 선택 */}
                    <td className="col-select">
                      <Form.Check
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                        title={`select ${row.id}`}
                      />
                    </td>

                    {columns[entity].map((col, idx) => {
                      const val = row[col] ?? "";
                      const isReadOnly = (col === "id" || col.includes("date"));
                      return (
                        <td
                          key={col}
                          className={idx === 0 ? 'col-sticky-left' : ''}
                          title={String(val)}
                        >
                          {isReadOnly ? (
                            val || "-"
                          ) : (
                            <Form.Control
                              size="sm"
                              className="cell-input"
                              value={val}
                              onChange={(e) => handleChange(row.id, col, e.target.value)}
                            />
                          )}
                        </td>
                      );
                    })}

                    <td className="col-actions">
                      <div className="d-flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => saveRow(row.id)}
                          disabled={saving.has(row.id)}
                        >
                          {saving.has(row.id) ? "..." : <FiSave />}
                        </Button>
                        {/* 🗑️ 개별 삭제 버튼 */}
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => deleteOne(row.id)}
                          title="이 행 삭제"
                        >
                          <FiTrash2 />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOverview;
