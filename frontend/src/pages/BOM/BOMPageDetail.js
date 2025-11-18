import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Row, Col, Button, Spinner, ProgressBar, Form, Modal } from 'react-bootstrap';
import { FiEdit, FiTrash2, FiSave, FiX } from 'react-icons/fi';
import { FaSearch, FaBox } from "react-icons/fa";
import { FaDeleteLeft } from "react-icons/fa6";
import ReusableTooltip from '../../components/ReusableTooltip';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:8000";

const BOMPageDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assembly, setAssembly] = useState(null);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);

  const [editingRowId, setEditingRowId] = useState(null);
  const [editedRowData, setEditedRowData] = useState({});

  const [newPart, setNewPart] = useState({ part_name: '', reference: '', quantity_per: 1 });

  const [partSearch, setPartSearch] = useState('');
  const filteredParts = parts.filter(p =>
    p.part_name.toLowerCase().includes(partSearch.toLowerCase())
  );

  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');

  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [allParts, setAllParts] = useState([]);

  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [showDeallocateModal, setShowDeallocateModal] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [allocAmount, setAllocAmount] = useState(0);
  const [isDeallocate, setIsDeallocate] = useState(false);

  const [selectedPartIds, setSelectedPartIds] = useState([]);

  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({});

  const [, setDeletingId] = useState(null);

  useEffect(() => {
    if (assembly) {
      setEditValues({ ...assembly });
    }
  }, [assembly]);

  const handleChange = (key, value) => {
    setEditValues(prev => ({ ...prev, [key]: value }));
  };

  const saveAllEdits = () => {
    fetch(`${SERVER_URL}/api/assemblies/${assembly.id}/edit`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editValues,
      }),
    })
      .then(res => res.json())
      .then(() => {
        setIsEditing(false);
        refreshData();
      });
  };

  const cancelAllEdits = () => {
    setEditValues({ ...assembly });
    setIsEditing(false);
  };

  const setEditValuesFromAssembly = () => {
    if (assembly) {
      setEditValues({ ...assembly });
    }
  };

  useEffect(() => {
    fetch(`${SERVER_URL}/api/assemblies/${id}/detail`)
      .then(res => res.json())
      .then(data => {
        setAssembly(data.assembly);
        setParts(data.parts);
        setLoading(false);
      });

    fetch(`${SERVER_URL}/api/parts`)
      .then(res => res.json())
      .then(data => setAllParts(data));
  }, [id]);

  const refreshData = useCallback(() => {
    setLoading(true);
    fetch(`${SERVER_URL}/api/assemblies/${id}/detail`)
      .then((res) => res.json())
      .then((data) => {
        setAssembly(data.assembly);
        setParts(data.parts);
        setLoading(false);
      });
  }, [id]);

  const handleConfirm = useCallback(() => {
    if (!selectedPart) return;

    const requiredQty = assembly.quantity_to_build * selectedPart.quantity_per;
    const allocated = selectedPart.allocated_quantity || 0;
    const remaining = requiredQty - allocated;
    const availableStock = selectedPart.quantity || 0;
    const maxAllocatable = isDeallocate
      ? allocated
      : Math.min(remaining, availableStock);
    if (
      allocAmount < 0 ||
      allocAmount > maxAllocatable ||
      (!isDeallocate && allocAmount > availableStock)
    ) {
      alert(`유효하지 않은 수량입니다.\n${isDeallocate ? '최대 할당 취소 수량은' : '할당 가능한 최대 수량은'} ${maxAllocatable}개입니다.`);
      return;
    }
    if (
      !window.confirm(`${isDeallocate ? '할당 취소' : '할당'} 수량 ${allocAmount}개를 확정할까요?`))
      return;
    fetch(`${SERVER_URL}/api/assemblies/${id}/bom/${selectedPart.part_id}/${isDeallocate ? 'deallocate' : 'allocate'}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: allocAmount,
        }),
      }
    )
      .then((res) => res.json())
      .then(() => {
        setShowAllocateModal(false);
        setShowDeallocateModal(false);
        refreshData();
      })
      .catch((err) => {
        console.error(err);
        alert('처리에 실패했습니다.');
      });
  }, [allocAmount, selectedPart, isDeallocate, assembly?.quantity_to_build, id, refreshData]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && (showAllocateModal || showDeallocateModal)) {
        e.preventDefault();
        handleConfirm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showAllocateModal, showDeallocateModal, allocAmount, selectedPart, handleConfirm]);

  const handleDeleteRow = async (part_id) => {
    // 행 찾기
    const row = parts.find(p => p.part_id === part_id);
    if (!row) {
      alert('행 정보를 찾을 수 없어요.');
      return;
    }
    const allocated = Number(row.allocated_quantity || 0);

    // 기본 확인 문구
    let msg = '정말 삭제하시겠습니까?';
    if (allocated > 0) {
      msg = `부품을 삭제하면 할당된 부품의 개수(${allocated}개)만큼 기존 재고가 증가합니다. 진행하시겠습니까?`;
    }
    if (!window.confirm(msg)) return;

    try {
      setDeletingId(part_id);

      // 1) 할당 취소(필요 시)
      if (allocated > 0) {
        const resDealloc = await fetch(
          `${SERVER_URL}/api/assemblies/${id}/bom/${part_id}/deallocate`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: allocated }),
          }
        );

        if (!resDealloc.ok) {
          const text = await resDealloc.text().catch(() => '');
          throw new Error(`할당 취소 실패: ${resDealloc.status} ${text}`);
        }
      }

      // 2) 실제 삭제
      const resDel = await fetch(`${SERVER_URL}/api/assemblies/${id}/bom/${part_id}`, {
        method: 'DELETE',
      });
      if (!resDel.ok) {
        const text = await resDel.text().catch(() => '');
        throw new Error(`삭제 실패: ${resDel.status} ${text}`);
      }

      alert('삭제되었습니다.');
      refreshData();
    } catch (err) {
      console.error(err);
      alert(err.message || '삭제 처리 중 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddPart = () => {
    if (!newPart.part_name) return alert('부품명을 입력해주세요.');

    fetch(`${SERVER_URL}/api/assemblies/${id}/bom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newPart,
      })
    })
      .then(res => {
        if (!res.ok) return res.json().then(err => { throw new Error(err.error || '추가 실패'); });
        return res.json();
      })
      .then(() => {
        setNewPart({ part_name: '', reference: '', quantity_per: 1 });
        refreshData();
      })
      .catch(err => {
        console.error(err);
        if (err.message.includes('존재하는 부품')) {
          alert('동일한 이름의 부품이 이미 존재합니다.');
        } else {
          alert('부품 추가에 실패했습니다.');
        }
      });
  };

  const handleEditRow = (p) => {
    setEditingRowId(p.part_id);
    setEditedRowData({
      part_name: p.part_name,
      reference: p.reference,
      quantity_per: p.quantity_per,
    });
  };

  const handleSaveRow = (part_id) => {
    fetch(`${SERVER_URL}/api/assemblies/${id}/bom/${part_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editedRowData,
      }),
    })
      .then(res => {
        if (!res.ok) throw new Error('수정 실패');
        return res.json();
      })
      .then(() => {
        setEditingRowId(null);
        refreshData();
      })
      .catch(err => {
        console.error(err);
        alert('수정 실패');
      });
  };

  const handleCancelEdit = () => {
    setEditingRowId(null);
    setEditedRowData({});
  };

  const isAliasName = async (name) => {
    const a = await getAliasByName((name || '').toUpperCase());
    return a ? a : null;
  };

  const handleAliasToggleOn = async (rowPart) => {
    try {
      // 이미 있으면 재사용, 없으면 생성
      const Name = (rowPart.part_name || '');
      let alias = await getAliasByName(Name);
      if (!alias) {
        alias = await createAlias(Name);
      }
      alert('대표부품으로 지정되었습니다. \n 대체부품을 연결할 수 있습니다.');
    } catch (e) {
      console.error(e);
      alert('대표부품으로 연결하는데 실패했습니다.');
    }
  };

  // alias 토글 OFF: alias 삭제
  const handleAliasToggleOff = async (rowPart) => {
    try {
      const alias = await isAliasName(rowPart.part_name);
      if (!alias) return; // 없으면 할 일 없음
      if (!window.confirm('이 별칭을 삭제할까요? 연결된 링크도 함께 삭제됩니다.')) return;
      await deleteAliasById(alias.id);
      alert('별칭 해제 완료');
    } catch (e) {
      console.error(e);
      alert('별칭 해제에 실패했습니다.');
    }
  };

  const replaceRowNameWithLinkedPart = async (rowPart, linkedPartName, linkedPartId) => {
    try {
      // 이미 같은 part가 있으면 즉시 차단
      if ((parts || []).some(p => p.part_id === linkedPartId)) {
        alert('이미 같은 부품이 PCB 내에 있습니다.');
        await refreshData(); // 또는 window.location.reload();
        return;
      }

      // 서버의 안전 스왑 API 호출 (삭제 금지)
      const res = await fetch(`${SERVER_URL}/api/assemblies/${id}/bom/${rowPart.part_id}/swap`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_part_id: linkedPartId }),
      });

      if (res.status === 409) {
        alert('이미 같은 부품이 PCB 내에 있습니다.');
        await refreshData();
        return;
      }
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        alert(`안전 교체 실패: ${res.status} ${errText || ''}`);
        await refreshData();
        return;
      }

      await refreshData();
      alert('부품을 안전하게 교체했습니다.');
    } catch (e) {
      console.error(e);
      alert(e?.message || '부품 교체에 실패했습니다.');
    }
  };

  async function fetchJson(url, opts) {
    const res = await fetch(url, opts);
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new Error(msg || `HTTP ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
  }

  // 1) alias 검색(이름으로 정확히 찾기)
  async function getAliasByName(name) {
    if (!name) return null;
    const q = encodeURIComponent(name);
    const rows = await fetchJson(`${SERVER_URL}/api/aliases/search?q=${q}&limit=50&offset=0`);
    const up = (name || '').trim().toUpperCase();
    return (rows || []).find(r => (r.alias_name || '').toUpperCase() === up) || null;
  }

  // 2) alias 생성
  async function createAlias(alias_name) {
    return fetchJson(`${SERVER_URL}/api/aliases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias_name })
    });
  }

  // 3) alias 삭제
  async function deleteAliasById(aliasId) {
    await fetchJson(`${SERVER_URL}/api/aliases/${aliasId}`, { method: 'DELETE' });
  }

  // 4) alias 링크들 조회
  async function getAliasLinks(aliasId) {
    return fetchJson(`${SERVER_URL}/api/aliases/${aliasId}/links`);
  }

  // 5) alias에 part 링크 추가
  async function addAliasLink(aliasId, part_id) {
    return fetchJson(`${SERVER_URL}/api/aliases/${aliasId}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ part_id })
    });
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '60vh' }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (!assembly) {
    return <div className="text-center mt-5">PCB를 찾을 수 없습니다.</div>;
  }

  const imageUrl = assembly?.image_filename
    ? `${SERVER_URL}/static/images/assemblies/${assembly.image_filename}`
    : '/default-part-icon.png';

  const totalNeeded = parts.reduce((sum, p) => sum + assembly.quantity_to_build * p.quantity_per, 0);
  const totalAllocated = parts.reduce((sum, p) => sum + (p.allocated_quantity || 0), 0);
  const allocationPercent = totalNeeded === 0 ? 0 : (totalAllocated / totalNeeded) * 100;

  let statusText = 'Planned';
  let statusColor = 'secondary';
  if (allocationPercent === 100) {
    statusText = 'Completed';
    statusColor = 'success';
  } else if (allocationPercent > 0) {
    statusText = 'In Progress';
    statusColor = 'info';
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleAutoAllocate = (targetParts) => {
    const requests = targetParts.map(p => {
      const required = assembly.quantity_to_build * p.quantity_per;
      const alreadyAllocated = p.allocated_quantity || 0;
      const remaining = required - alreadyAllocated;
      const available = p.quantity || 0;
      const toAllocate = Math.min(remaining, available);

      if (toAllocate <= 0) return null;

      return fetch(`${SERVER_URL}/api/assemblies/${id}/bom/${p.part_id}/allocate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: toAllocate,
        }),
      });
    }).filter(Boolean);

    if (requests.length === 0) {
      alert("할당 가능한 부품이 없습니다.");
      return;
    }

    Promise.all(requests)
      .then(() => {
        alert("자동 할당 완료");
        setSelectedPartIds([]);
        refreshData();
      })
      .catch((err) => {
        console.error(err);
        alert("자동 할당 중 오류 발생");
      });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validExt = ['png', 'jpg', 'jpeg'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!validExt.includes(ext)) {
      alert("png/jpg/jpeg 형식만 업로드 가능합니다.");
      return;
    }

    const safeName = encodeURIComponent(assembly.assembly_name || `assembly_${id}`);
    const filename = `${safeName}.${ext}`;

    const formData = new FormData();
    formData.append('image', file, filename);

    fetch(`${SERVER_URL}/api/assemblies/${id}/upload-image`, {
      method: 'POST',
      body: formData,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`업로드 실패: ${res.status}`);
        return res.json();
      })
      .then(() => {
        alert("이미지 업로드 완료");
        setLoading(true);
        fetch(`${SERVER_URL}/api/assemblies/${id}/detail`)
          .then(res => res.json())
          .then(data => {
            setAssembly(data.assembly);
            setParts(data.parts);
            setLoading(false);
          });
      })
      .catch((err) => {
        console.error("이미지 업로드 오류:", err);
        alert("이미지 업로드에 실패했습니다.");
      });
  };

  const saveEdit = (field) => {
    let payload = {};

    if (field === 'quantity') {
      payload.quantity_to_build = Number(editValue);
    } else if (field === 'description') {
      payload.description = editValue;
    } else if (field === 'version') {
      payload.version = editValue;
    } else if (field === 'manufacturing_method') {
      payload.manufacturing_method = editValue;
    } else if (field === 'work_date') {
      payload.work_date = editValue;
    } else if (field === 'work_duration') {
      payload.work_duration = editValue;
    } else if (field === 'is_soldered') {
      payload.is_soldered = editValue;
    } else if (field === 'is_tested') {
      payload.is_tested = editValue;
    }

    fetch(`${SERVER_URL}/api/assemblies/${id}/edit`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
      }),
    })
      .then((res) => res.json())
      .then(() => {
        setEditingField(null);
        refreshData();
      });
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  // === 별칭 토글/드롭다운 셀 (이 파일 내부 전용) ===
  const AliasToggleCell = ({ rowPart }) => {
    const [open, setOpen] = useState(false);
    const [loadingAlias, setLoadingAlias] = useState(false);
    const [aliasInfo, setAliasInfo] = useState(null); // { id, alias_name }
    const [links, setLinks] = useState([]);           // [{ part_id, part_name, link_id }]
    const boxRef = useRef(null);

    // 현재 행 이름이 alias인지 확인
    useEffect(() => {
      let alive = true;
      (async () => {
        try {
          const a = await getAliasByName((rowPart.part_name || '').toUpperCase());
          if (!alive) return;
          setAliasInfo(a || null);
        } catch {
          setAliasInfo(null);
        }
      })();
      return () => { alive = false; };
    }, [rowPart.part_name]);

    // 드롭다운 열릴 때 연결 링크 로딩
    useEffect(() => {
      if (!open || !aliasInfo) return;
      let alive = true;
      (async () => {
        try {
          setLoadingAlias(true);
          const rows = await getAliasLinks(aliasInfo.id);
          if (!alive) return;
          const mapped = (rows || []).map(r => ({
            part_id: r.part_id,
            part_name: r.part_name,
            link_id: r.id ?? r.link_id ?? r.linkId,
          }));
          setLinks(mapped);
        } catch {
          setLinks([]);
        } finally {
          if (alive) setLoadingAlias(false);
        }
      })();
      return () => { alive = false; };
    }, [open, aliasInfo]);

    // 바깥 클릭 시 드롭다운 닫기
    useEffect(() => {
      const onDown = (e) => {
        if (!boxRef.current) return;
        if (!boxRef.current.contains(e.target)) setOpen(false);
      };
      document.addEventListener('mousedown', onDown);
      return () => document.removeEventListener('mousedown', onDown);
    }, []);

    const onToggleChange = async (e) => {
      const checked = e.target.checked;
      if (checked) {
        await handleAliasToggleOn(rowPart);
        const a = await getAliasByName((rowPart.part_name || '').toUpperCase());
        setAliasInfo(a || null);
      } else {
        await handleAliasToggleOff(rowPart);
        setAliasInfo(null);
        setOpen(false);
      }
    };

    const onPickLinked = async (nm, pid) => {
      await replaceRowNameWithLinkedPart(rowPart, nm, pid);
      setAliasInfo(null);
      setOpen(false);
    };

    const isOn = !!aliasInfo;

    return (
      <div className="d-inline-flex align-items-center position-relative" ref={boxRef}>
        <Form.Check
          type="switch"
          checked={isOn}
          onChange={onToggleChange}
          id={`alias-switch-${rowPart.part_id}`}
        // label={isOn ? 'ON' : 'OFF'}
        />
        {isOn && (
          <Button
            variant="outline-secondary"
            size="sm"
            className="ms-2"
            onClick={() => setOpen(v => !v)}
            title="연결된 부품명으로 변경"
          >
            ▾
          </Button>
        )}
        {isOn && open && (
          <div
            className="bg-white border rounded shadow-sm mt-1"
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              zIndex: 1050,
              minWidth: 220,
              maxHeight: '40vh',
              overflowY: 'auto'
            }}
          >
            <div className="p-2 border-bottom fw-bold">연결된 부품명 선택</div>
            {loadingAlias ? (
              <div className="p-2 text-muted">불러오는 중…</div>
            ) : links.length === 0 ? (
              <div className="p-2 text-muted">연결된 부품 없음</div>
            ) : (
              <Table hover size="sm" className="mb-0">
                <tbody>
                  {links.map(l => (
                    <tr
                      key={l.part_id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => onPickLinked(l.part_name, l.part_id)}
                    >
                      <td className="py-1 px-2">{l.part_name}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="content-wrapper">
      <Card className="mb-5">
        <Card.Header className="d-flex justify-content-between">
          {editingField === 'name' ? (
            <div className="d-flex align-items-center gap-2">
              <Form.Control
                value={editValue ?? ''}
                onChange={(e) => setEditValue(e.target.value)}
                style={{ maxWidth: '250px' }}
              />
              <Button size="sm" style={{ whiteSpace: 'nowrap' }} onClick={() => saveEdit('name')}>저장</Button>
              <Button size="sm" style={{ whiteSpace: 'nowrap' }} variant="secondary" onClick={() => cancelEdit()}>취소</Button>
            </div>
          ) : (
            <h3
              className="d-flex align-items-center gap-2"
              onMouseEnter={() => setEditingField('hover-name')}
              onMouseLeave={() => setEditingField(null)}
            >
              {assembly.assembly_name}
              {editingField === 'hover-name' && (
                <FiEdit
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setEditingField('name');
                    setEditValue(assembly.assembly_name);
                  }}
                />
              )}
            </h3>
          )}
          {isEditing ? (
            <>
              <div className="d-flex gap-3">
                <Button variant="primary" onClick={saveAllEdits}>저장</Button>
                <Button variant="secondary" onClick={cancelAllEdits}>취소</Button>
              </div>
            </>
          ) : (
            <Button variant="outline-primary" onClick={() => {
              setIsEditing(true);
              setEditValuesFromAssembly();
            }}>편집</Button>
          )}
        </Card.Header>
        <Card.Body>
          <Row className='d-flex align-items-center'>
            <Col xs={12} md={2}>
              <div
                className="position-relative image-container"
                style={{
                  width: "100%",
                  maxWidth: "220px",
                  margin: "0 auto",
                }}
                onMouseEnter={() => {
                  const overlay = document.getElementById('upload-overlay');
                  if (overlay) overlay.style.opacity = '1';
                }}
                onMouseLeave={() => {
                  const overlay = document.getElementById('upload-overlay');
                  if (overlay) overlay.style.opacity = '0';
                }}
              >
                <Zoom>
                  <img
                    src={imageUrl}
                    alt="Assembly"
                    className="img-fluid rounded"
                    style={{
                      width: "100%",
                      maxHeight: "170px",
                      objectFit: "contain",
                      border: "1px solid #eee",
                    }}
                  />
                </Zoom>

                <div
                  id="upload-overlay"
                  className="position-absolute bottom-0 end-0 p-2"
                  style={{
                    opacity: 0,
                    transition: "opacity 0.3s",
                    width: "auto",
                    height: "auto",
                    borderRadius: "8px",
                    zIndex: 3,
                    pointerEvents: "none",
                  }}
                >
                  {/* 이미지 변경 버튼 */}
                  <button
                    className="btn btn-sm btn-dark shadow-sm"
                    onClick={handleUploadClick}
                    style={{ pointerEvents: "auto", fontWeight: "bold" }}
                  >
                    이미지 변경
                  </button>
                </div>

                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
              </div>
            </Col>
            <Col md={5}>
              <p><strong>이름:</strong> {isEditing ? (
                <Form.Control
                  value={editValues.assembly_name ?? '-'}
                  onChange={(e) => handleChange('assembly_name', e.target.value)}
                />
              ) : assembly.assembly_name}</p>

              <p><strong>수량:</strong> {isEditing ? (
                <Form.Control
                  type="number"
                  value={editValues.quantity_to_build ?? '-'}
                  onChange={(e) => handleChange('quantity_to_build', e.target.value)}
                />
              ) : assembly.quantity_to_build}</p>

              <p><strong>버전:</strong> {isEditing ? (
                <Form.Control
                  value={editValues.version ?? '-'}
                  onChange={(e) => handleChange('version', e.target.value)}
                />
              ) : assembly.version || '-'}</p>

              <p><strong>설명:</strong> {isEditing ? (
                <Form.Control
                  value={editValues.description ?? '-'}
                  onChange={(e) => handleChange('description', e.target.value)}
                />
              ) : assembly.description || '-'}</p>

              <p><strong>작업 일자:</strong> {isEditing ? (
                <Form.Control
                  type="date"
                  value={editValues.work_date ?? '-'}
                  onChange={(e) => handleChange('work_date', e.target.value)}
                />
              ) : assembly.work_date || '-'}</p>

              <p><strong>작업 시간:</strong> {isEditing ? (
                <Form.Control
                  value={editValues.work_duration ?? '-'}
                  onChange={(e) => handleChange('work_duration', e.target.value)}
                />
              ) : assembly.work_duration || '-'}</p>

              <p><strong>제작 방식:</strong> {isEditing ? (
                <Form.Control
                  value={editValues.manufacturing_method}
                  onChange={(e) => handleChange('manufacturing_method', e.target.value)}
                />
              ) : assembly.manufacturing_method || '-'}</p>
            </Col>

            <Col md={5}>
              <p><strong>납땜 여부:</strong> {isEditing ? (
                <Form.Check
                  type="switch"
                  checked={!!editValues.is_soldered}
                  onChange={(e) => handleChange('is_soldered', e.target.checked)}
                  label={editValues.is_soldered ? 'O' : 'X'}
                />
              ) : (assembly.is_soldered ? 'O' : 'X')}</p>

              <p><strong>테스트 여부:</strong> {isEditing ? (
                <Form.Check
                  type="switch"
                  checked={!!editValues.is_tested}
                  onChange={(e) => handleChange('is_tested', e.target.checked)}
                  label={editValues.is_tested ? 'O' : 'X'}
                />
              ) : (assembly.is_tested ? 'O' : 'X')}</p>

              <p><strong>상태:</strong> <span className={`badge bg-${statusColor}`}>{statusText}</span></p>
              <ProgressBar
                now={allocationPercent}
                variant={statusColor}
                label={`${totalAllocated} / ${totalNeeded} (${Math.round(allocationPercent)}%)`}
                className="mb-2"
              />
              <p><strong>수정일:</strong> {new Date(assembly.update_date).toLocaleDateString()}</p>
            </Col>
          </Row>
        </Card.Body>
      </Card>
      {allocationPercent < 100 && (
        <div className="alert alert-danger">완료 조건을 충족하지 못했습니다</div>
      )}

      <Card>
        <Card.Header>부품 추가</Card.Header>
        <Card.Body>
          <Row>
            <Col md={4}><Form.Control placeholder="부품명" value={newPart.part_name} onChange={(e) => setNewPart(prev => ({ ...prev, part_name: e.target.value }))} /></Col>
            <Col md={4}><Form.Control placeholder="참조번호" value={newPart.reference} onChange={(e) => setNewPart(prev => ({ ...prev, reference: e.target.value }))} /></Col>
            <Col md={2}><Form.Control type="number" value={newPart.quantity_per} onChange={(e) => setNewPart(prev => ({ ...prev, quantity_per: Number(e.target.value) }))} /></Col>
            <Col md={1}><Button onClick={handleAddPart}>추가</Button></Col>
            <Col md={1}><Button variant="secondary" onClick={() => setShowSearchModal(true)}><FaSearch /></Button></Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="mt-3">
        <Card.Header className="d-flex align-items-center justify-content-between ">
          <div className='d-flex align-items-center w-100 gap-3'>
            <h3 className="fs-4">부품 리스트</h3>
            <Form.Control
              className="mb-3 mt-2 w-75"
              placeholder="부품명을 검색하세요"
              value={partSearch}
              onChange={(e) => setPartSearch(e.target.value)}
            />
          </div>

          <div className="mb-3 d-flex flex-row-reverse gap-3 w-50">
            <Button
              variant="secondary"
              onClick={() => {
                const selectedParts = parts.filter(p => selectedPartIds.includes(p.part_id));
                if (selectedParts.length === 0) return alert("선택된 부품이 없습니다.");
                handleAutoAllocate(selectedParts);
              }}
            >
              선택 자동 할당
            </Button>
            <Button
              variant="success"
              onClick={() => {
                if (!window.confirm("모든 부품을 자동 할당하시겠습니까?")) return;
                handleAutoAllocate(parts);
              }}
            >
              전체 자동 할당
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          <Table striped bordered hover>
            <thead className="text-center">
              <tr>
                <th>
                  <Form.Check
                    type="checkbox"
                    checked={selectedPartIds.length === filteredParts.length && filteredParts.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPartIds(filteredParts.map(p => p.part_id));
                      } else {
                        setSelectedPartIds([]);
                      }
                    }}
                  />
                </th>
                <th>부품명</th>
                <th>참조번호</th>
                <th>개당 필요수</th>
                <th>재고</th>
                <th>할당량</th>
                <th>할당</th>
                <th>작업</th>
                <th>대표부품 지정</th>
              </tr>
            </thead>
            <tbody className="text-center">
              {filteredParts.map((p) => {
                const requiredQty = assembly.quantity_to_build * p.quantity_per;
                const currentQty = (p.quantity || 0) + (p.allocated_quantity || 0);
                const isStockShort = currentQty < requiredQty;

                const allocated = p.allocated_quantity || 0;

                if (editingRowId === p.part_id) {
                  return (
                    <tr key={p.part_id}>
                      <td>
                        <Form.Check
                          type="checkbox"
                          checked={selectedPartIds.includes(p.part_id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPartIds(prev => [...prev, p.part_id]);
                            } else {
                              setSelectedPartIds(prev => prev.filter(id => id !== p.part_id));
                            }
                          }}
                        />
                      </td>
                      <td
                        style={{ cursor: 'pointer', textDecoration: 'underline', color: '#007bff' }}
                        onClick={() => navigate(`/partDetail/${p.part_id}`)}
                      >
                        {p.part_name}
                      </td>
                      <td>
                        <Form.Control
                          value={editedRowData.reference}
                          onChange={(e) => setEditedRowData(prev => ({ ...prev, reference: e.target.value }))}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          value={editedRowData.quantity_per}
                          onChange={(e) => setEditedRowData(prev => ({ ...prev, quantity_per: Number(e.target.value) }))}
                        />
                      </td>
                      <td>{p.quantity}</td>
                      <td>
                        <ProgressBar
                          now={allocated}
                          max={requiredQty}
                          label={`${allocated} / ${requiredQty}`}
                          variant={allocated >= requiredQty ? 'success' : 'warning'}
                        />
                      </td>
                      <td></td>
                      <td>
                        <Button variant="outline-success" size="sm" onClick={() => handleSaveRow(p.part_id)}><FiSave /></Button>{' '}
                        <Button variant="outline-secondary" size="sm" onClick={handleCancelEdit}><FiX /></Button>
                      </td>
                      <td>
                        <AliasToggleCell rowPart={p} />
                      </td>
                    </tr>
                  );
                } else {
                  return (
                    <tr key={p.part_id}>
                      <td>
                        <Form.Check
                          type="checkbox"
                          checked={selectedPartIds.includes(p.part_id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPartIds(prev => [...prev, p.part_id]);
                            } else {
                              setSelectedPartIds(prev => prev.filter(id => id !== p.part_id));
                            }
                          }}
                        />
                      </td>
                      <td
                        style={{ cursor: 'pointer', color: '#007bff' }}
                        onClick={() => navigate(`/partdetail/${p.part_id}`)}
                      >
                        {p.part_name}
                      </td>
                      <td>{p.reference}</td>
                      <td>{p.quantity_per}</td>
                      <td style={{ color: isStockShort ? 'red' : 'inherit' }}>
                        {isStockShort ? (
                          <ReusableTooltip message="재고가 부족합니다">
                            <span>{p.quantity}</span>
                          </ReusableTooltip>
                        ) : (
                          <span>{p.quantity}</span>
                        )}
                      </td>
                      <td style={{ minWidth: 150 }}>
                        <ProgressBar
                          now={allocated}
                          max={requiredQty}
                          label={`${allocated} / ${requiredQty}`}
                          variant={allocated >= requiredQty ? 'success' : 'warning'}
                        />
                      </td>
                      <td>
                        <Button
                          variant="success"
                          size="sm"
                          disabled={allocated >= requiredQty}
                          onClick={() => {
                            setSelectedPart(p);
                            setIsDeallocate(false);
                            const requiredQty = assembly.quantity_to_build * p.quantity_per;
                            const allocated = p.allocated_quantity || 0;
                            const remaining = requiredQty - allocated;
                            const availableStock = p.quantity || 0;

                            const defaultAlloc = Math.min(remaining, availableStock);
                            setAllocAmount(defaultAlloc > 0 ? defaultAlloc : 0);
                            setShowAllocateModal(true);
                          }}
                        >
                          <FaBox />
                        </Button>{' '}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedPart(p);
                            setIsDeallocate(true);
                            setAllocAmount(allocated);
                            setShowDeallocateModal(true);
                          }}
                        >
                          <FaDeleteLeft />
                        </Button>
                      </td>
                      <td>
                        <Button variant="outline-primary" size="sm" onClick={() => handleEditRow(p)}><FiEdit /></Button>{' '}
                        <Button variant="outline-danger" size="sm" onClick={() => handleDeleteRow(p.part_id)}><FiTrash2 /></Button>
                      </td>
                      <td>
                        <AliasToggleCell rowPart={p} />
                      </td>
                    </tr>
                  );
                }
              })}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
      <Modal show={showSearchModal} onHide={() => setShowSearchModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>부품 검색</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control
            className="mb-3"
            placeholder="부품명 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>부품명</th>
                  <th>재고</th>
                </tr>
              </thead>
              <tbody>
                {allParts
                  .filter(p => p.part_name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((p) => (
                    <tr key={p.id}>
                      <td
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setNewPart(prev => ({
                            ...prev,
                            part_name: p.part_name,
                            reference: p.reference || '',
                          }));
                          setShowSearchModal(false);
                        }}>
                        {p.part_name}
                      </td>
                      <td>{p.quantity}</td>
                    </tr>
                  ))}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
      </Modal>

      <Modal
        show={showAllocateModal || showDeallocateModal}
        onHide={() => {
          setShowAllocateModal(false);
          setShowDeallocateModal(false);
        }}
      >
        <Modal.Header closeButton>
          <Modal.Title>{isDeallocate ? '할당 취소' : '부품 할당'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedPart && (
            <>
              <p><strong>부품명:</strong> {selectedPart.part_name}</p>
              <Form.Label>수량</Form.Label>
              <Form.Control
                type="number"
                min="0"
                max={
                  isDeallocate
                    ? selectedPart.allocated_quantity
                    : Math.min(
                      assembly.quantity_to_build * selectedPart.quantity_per - (selectedPart.allocated_quantity || 0),
                      selectedPart.quantity || 0
                    )
                }
                value={allocAmount}
                onChange={(e) => setAllocAmount(Number(e.target.value))}
              />
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowAllocateModal(false);
            setShowDeallocateModal(false);
          }}>취소</Button>
          <Button variant="primary" onClick={handleConfirm}>
            {isDeallocate ? '할당 취소' : '할당'}
          </Button>
        </Modal.Footer>
      </Modal>

    </div>
  );
};

export default BOMPageDetail;
