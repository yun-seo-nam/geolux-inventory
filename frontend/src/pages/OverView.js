import React, { useState, useEffect, useCallback } from 'react';
import { Table, Form, Button, Dropdown, DropdownButton, Spinner } from 'react-bootstrap';
import { FiSave } from 'react-icons/fi';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:8000";

const AdminOverview = () => {
  const [entity, setEntity] = useState("parts"); // 기본값: parts
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState({}); // id별 변경된 값 저장
  const [saving, setSaving] = useState(new Set());

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


  const columns = {
    parts: ["id", ...editableColumns.parts],
    assemblies: ["id", ...editableColumns.assemblies],
    projects: ["id", ...editableColumns.projects]
  };

  // 데이터 불러오기
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/${entity}`);
      const data = await res.json();
      setRows(data);
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

  return (
    <div className="container mt-4">
      <h2>총괄 관리 페이지</h2>
      <div className="d-flex gap-3">
        <DropdownButton id="dropdown-basic-button" title={entity}>
          <Dropdown.Item onClick={() => setEntity("parts")}>Parts</Dropdown.Item>
          <Dropdown.Item onClick={() => setEntity("assemblies")}>Assemblies</Dropdown.Item>
          <Dropdown.Item onClick={() => setEntity("projects")}>Projects</Dropdown.Item>
        </DropdownButton>
        <Button
          variant="primary"
          onClick={saveAll}
          disabled={!Object.keys(dirty).length}
        >
          전체 저장
        </Button>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center align-items-center" style={{ height: "50vh" }}>
          <Spinner animation="border" />
        </div>
      ) : (
        <Table striped bordered hover responsive size="lg" className="mt-3">
          <thead>
            <tr>
              {columns[entity].map(col => (
                <th key={col}>{col}</th>
              ))}
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                {columns[entity].map(col => (
                  <td key={col}>
                    {col === "id" || col.includes("date") ? (
                      row[col] || "-"
                    ) : (
                      <Form.Control
                        size="sm"
                        value={row[col] ?? ""}
                        onChange={(e) => handleChange(row.id, col, e.target.value)}
                      />
                    )}
                  </td>
                ))}
                <td>
                  <Button
                    size="sm"
                    onClick={() => saveRow(row.id)}
                    disabled={saving.has(row.id)}
                  >
                    {saving.has(row.id) ? "..." : <FiSave />}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
};

export default AdminOverview;
