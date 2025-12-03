import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Row, Col, Button, Spinner, ProgressBar, Form, Modal, Badge } from 'react-bootstrap';
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

  const [showMergeSearchModal, setShowMergeSearchModal] = useState(false);
  const [mergeSourcePartId, setMergeSourcePartId] = useState(null);

  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapSource, setSwapSource] = useState(null);
  const [swapTargetId, setSwapTargetId] = useState(null);
  const [swapTargetName, setSwapTargetName] = useState("");
  const [swapQuantity, setSwapQuantity] = useState(0);

  const [highlightIds, setHighlightIds] = useState(new Set());
  const [modifiedIds, setModifiedIds] = useState(new Set());
  const [showModifiedOnly, setShowModifiedOnly] = useState(false);
  const filteredParts = parts.filter(p => {
    const matchesSearch = p.part_name.toLowerCase().includes(partSearch.toLowerCase());

    if (showModifiedOnly) {
      return matchesSearch && modifiedIds.has(p.part_id);
    }
    return matchesSearch;
  });

  const triggerHighlight = useCallback((ids) => {
    setHighlightIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
    setTimeout(() => {
      setHighlightIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    }, 3000);

    setModifiedIds(prev => {
      const next = new Set(prev);
      targetIds.forEach(id => next.add(id));
      return next;
    });
  }, []);

  useEffect(() => {
    if (assembly) {
      setEditValues({ ...assembly });
    }
  }, [assembly]);

  const handleChange = (key, value) => {
    setEditValues(prev => ({ ...prev, [key]: value }));
  };

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

  const saveAllEdits = useCallback(async () => {
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
  }, [assembly, editValues, refreshData]);

  const cancelAllEdits = useCallback(() => {
    setEditValues({ ...assembly });
    setIsEditing(false);
  }, [assembly]);

  const setEditValuesFromAssembly = useCallback(() => {
    if (assembly) {
      setEditValues({ ...assembly });
    }
  }, [assembly]);

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

  const saveEdit = useCallback((field) => {
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
  }, [
    editValue,
    id,
    setEditingField,
    refreshData
  ]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && (showAllocateModal || showDeallocateModal)) {
        e.preventDefault();
        handleConfirm();
        return;
      }

      if (isEditing) {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveAllEdits();
        } else if (e.key === 'ESC') {
          e.preventDefault();
          cancelAllEdits();
        }
        return;
      }

      // 3. 수정 모드도 아니고 모달도 없을 때 F2
      if (e.key === 'F2' && !showAllocateModal && !showDeallocateModal) {
        e.preventDefault();
        setIsEditing(true);
        setEditValuesFromAssembly();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    showAllocateModal,
    showDeallocateModal,
    isEditing,
    saveEdit,
    handleConfirm,
    setEditValuesFromAssembly,
    cancelAllEdits,
    saveAllEdits
  ]);

  const handleDeleteRow = async (part_id) => {
    const row = parts.find(p => p.part_id === part_id);
    if (!row) {
      alert('행 정보를 찾을 수 없어요.');
      return;
    }
    const allocated = Number(row.allocated_quantity || 0);

    let msg = '정말 삭제하시겠습니까?';
    if (allocated > 0) {
      msg = `부품을 삭제하면 할당된 부품의 개수(${allocated}개)만큼 기존 재고가 증가합니다. 진행하시겠습니까?`;
    }
    if (!window.confirm(msg)) return;

    try {
      setDeletingId(part_id);

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

  const handleMergeParts = (targetPartId) => {
    if (!mergeSourcePartId || !targetPartId) return;

    if (window.confirm("두 부품을 호환 그룹으로 묶으시겠습니까?\n(재고나 기존 데이터는 유지됩니다)")) {
      fetch(`${SERVER_URL}/api/parts/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_part_id: mergeSourcePartId,
          target_part_id: targetPartId,
          swap_assemblies: false
        })
      })
        .then(res => res.json())
        .then(data => {
          if (data.error) throw new Error(data.error);
          alert("호환 부품으로 등록되었습니다.");
          setShowMergeSearchModal(false);
          refreshData();
          setModifiedIds(prev => {
            const next = new Set(prev);
            targetIds.forEach(id => next.add(id));
            return next;
          });
        })
        .catch(err => {
          console.error(err);
          alert(err.message || "병합 실패");
        });
    }
  };

  const handleSwapClick = (sourcePart, targetPartId, targetPartName) => {
    setSwapSource(sourcePart);
    setSwapTargetId(targetPartId);
    setSwapTargetName(targetPartName);
    setSwapQuantity(sourcePart.quantity_per); // 기본값은 전체 수량
    setShowSwapModal(true);
  };

  // [NEW] Swap 실행 핸들러 (수량 지정 교체)
  const executeSwap = async () => {
    if (!swapSource || !swapTargetId) return;

    const qty = Number(swapQuantity);
    if (qty <= 0 || qty > swapSource.quantity_per) {
      alert(`1개 이상, 최대 ${swapSource.quantity_per}개까지만 가능합니다.`);
      return;
    }

    try {
      const res = await fetch(`${SERVER_URL}/api/assemblies/${id}/bom/swap-quantity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_part_id: swapSource.part_id,
          target_part_id: swapTargetId,
          swap_quantity: qty
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "교체 실패");
      }

      alert("교체되었습니다.");
      setShowSwapModal(false);
      const targetIds = [swapSource.part_id, swapTargetId];
      refreshData();
      setTimeout(() => triggerHighlight(targetIds), 300);
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  };

  const handleAliasToggleOn = async (rowPart) => {
    try {
      const aliasRes = await fetch(`${SERVER_URL}/api/parts/${rowPart.part_id}/alias`);
      const aliasData = await aliasRes.json();

      if (aliasData) {
        alert('이미 호환 그룹이 존재합니다.');
        return false;
      }

      const name = rowPart.part_name;
      let aliasId = null;

      let newAliasRes = await fetch(`${SERVER_URL}/api/aliases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias_name: name })
      });

      if (newAliasRes.ok) {
        const newAlias = await newAliasRes.json();
        aliasId = newAlias.id;
      } else if (newAliasRes.status === 409) {
        const searchRes = await fetch(`${SERVER_URL}/api/aliases/search?q=${encodeURIComponent(name)}&limit=1`);
        const searchList = await searchRes.json();
        const found = searchList.find(a => a.alias_name.toUpperCase() === name.toUpperCase());

        if (found) {
          aliasId = found.id;
        } else {
          throw new Error("그룹명이 중복되는데 찾을 수 없는 이상한 오류입니다.");
        }
      } else {
        throw new Error("Alias 그룹 생성 실패");
      }

      if (aliasId) {
        await fetch(`${SERVER_URL}/api/aliases/${aliasId}/links`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ part_id: rowPart.part_id })
        });
        alert('대표 호환 그룹이 설정되었습니다.\n이제 [+ 호환 부품 추가] 버튼으로 다른 부품을 묶을 수 있습니다.');
      }

      refreshData();
      return true;
    } catch (e) {
      console.error(e);
      alert('처리 중 오류가 발생했습니다: ' + e.message);
      return false;
    }
  };

  const handleAliasToggleOff = async (rowPart) => {
    if (!window.confirm('이 부품을 호환 그룹에서 제외하시겠습니까?\n(부품 그룹 자체는 삭제되지 않습니다)')) {
      return false;
    }

    try {
      await fetch(`${SERVER_URL}/api/aliases/links/part/${rowPart.part_id}`, {
        method: 'DELETE'
      });

      refreshData();
      return true;
    } catch (e) {
      console.error(e);
      alert('그룹 해제 실패');
      return false;
    }
  };

  const AliasToggleCell = ({ rowPart }) => {
    const [open, setOpen] = useState(false);
    const [loadingAlias, setLoadingAlias] = useState(false);
    const [links, setLinks] = useState([]);
    const boxRef = useRef(null);

    const [hasAlias, setHasAlias] = useState(!!rowPart.alias_id);

    useEffect(() => {
      if (!open || !hasAlias || links.length > 0) return;

      let alive = true;
      (async () => {
        try {
          setLoadingAlias(true);
          const aid = rowPart.alias_id;

          if (aid) {
            const resLinks = await fetch(`${SERVER_URL}/api/aliases/${aid}/links`);
            const linkData = await resLinks.json();
            if (alive) setLinks(linkData || []);
          }
        } catch {
          if (alive) setLinks([]);
        } finally {
          if (alive) setLoadingAlias(false);
        }
      })();
      return () => { alive = false; };
    }, [open, hasAlias, rowPart.alias_id, links.length]);

    useEffect(() => {
      const onDown = (e) => {
        if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
      };
      document.addEventListener('mousedown', onDown);
      return () => document.removeEventListener('mousedown', onDown);
    }, []);

    const onToggleChange = async (e) => {
      const checked = e.target.checked;
      if (checked) {
        const success = await handleAliasToggleOn(rowPart);
        if (success) {
          setHasAlias(true);
        }
      } else {
        const success = await handleAliasToggleOff(rowPart);
        if (success) {
          setHasAlias(false);
          setOpen(false);
        }
      }
    };

    return (
      <div className="d-inline-flex align-items-center position-relative" ref={boxRef}>
        <Form.Check
          type="switch"
          checked={hasAlias}
          onChange={onToggleChange}
        />
        {hasAlias && (
          <Button
            variant="outline-secondary"
            size="sm"
            className="ms-2 py-0 px-1"
            onClick={() => setOpen(!open)}
          >
            ▼
          </Button>
        )}

        {hasAlias && open && (
          <div
            className="bg-white border rounded shadow p-2"
            style={{ position: 'absolute', top: '100%', right: 0, zIndex: 9999, minWidth: '250px' }}
          >
            <h6 className="border-bottom pb-2 mb-2">호환 부품 목록</h6>

            {loadingAlias ? <Spinner size="sm" /> : (
              <ul className="list-unstyled mb-2">
                {links.filter(l => l.part_id !== rowPart.part_id).map(l => (
                  <li key={l.part_id} className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-truncate" style={{ maxWidth: '140px' }} title={l.part_name}>
                      {l.part_name} <small className="text-muted">({l.quantity})</small>
                    </span>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      style={{ fontSize: '0.7rem' }}
                      onClick={() => handleSwapClick(rowPart, l.part_id, l.part_name)}
                    >
                      교체
                    </Button>
                  </li>
                ))}
                {links.length <= 1 && <li className="text-muted small">다른 연결된 부품이 없습니다.</li>}
              </ul>
            )}

            <Button
              variant="light"
              size="sm"
              className="w-100 text-primary fw-bold border-top mt-1"
              onClick={() => {
                setMergeSourcePartId(rowPart.part_id);
                setShowMergeSearchModal(true);
                setOpen(false);
              }}
            >
              + 호환 부품 추가 (Merge)
            </Button>
          </div>
        )}
      </div>
    );
  };

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

  return (
    <div className="content-wrapper">
      <Card className="mb-5">
        <Card.Header className="d-flex justify-content-between">
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

              <div className="mb-3">
                <strong>제작 방식:</strong> {isEditing ? (
                  <Form.Control
                    value={editValues.manufacturing_method || ''}
                    onChange={(e) => handleChange('manufacturing_method', e.target.value)}
                  />
                ) : assembly.manufacturing_method || '-'}
              </div>
            </Col>

            <Col md={5}>
              <div className="mb-3">
                <strong>납땜 여부:</strong> {isEditing ? (
                  <Form.Check
                    type="switch"
                    checked={!!editValues.is_soldered}
                    onChange={(e) => handleChange('is_soldered', e.target.checked)}
                    label={editValues.is_soldered ? 'O' : 'X'}
                  />
                ) : (assembly.is_soldered ? 'O' : 'X')}
              </div>

              <div className="mb-3">
                <strong>테스트 여부:</strong> {isEditing ? (
                  <Form.Check
                    type="switch"
                    checked={!!editValues.is_tested}
                    onChange={(e) => handleChange('is_tested', e.target.checked)}
                    label={editValues.is_tested ? 'O' : 'X'}
                  />
                ) : (assembly.is_tested ? 'O' : 'X')}
              </div>

              <div className="mb-3">
                <strong>상태:</strong> <span className={`badge bg-${statusColor}`}>{statusText}</span>
              </div>

              <ProgressBar
                now={allocationPercent}
                variant={statusColor}
                label={`${totalAllocated} / ${totalNeeded} (${Math.round(allocationPercent)}%)`}
                className="mb-3"
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

          <Button
            variant={showModifiedOnly ? "success" : "outline-secondary"}
            onClick={() => setShowModifiedOnly(!showModifiedOnly)}
            className="d-flex align-items-center gap-2"
          >
            {showModifiedOnly ? <FaBox /> : <FaSearch />}
            {showModifiedOnly ? "전체 보기" : "변경된 항목만 보기"}
            {modifiedIds.size > 0 && <Badge bg="danger" pill>{modifiedIds.size}</Badge>}
          </Button>

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
                <th>호환/교체</th>
              </tr>
            </thead>
            <tbody className="text-center">
              {filteredParts.map((p) => {
                const requiredQty = assembly.quantity_to_build * p.quantity_per;

                // 재고 부족 여부 계산
                const currentQty = (p.quantity || 0) + (p.allocated_quantity || 0);
                const isStockShort = currentQty < requiredQty;

                const allocated = p.allocated_quantity || 0;

                // [NEW] 스타일 클래스 결정 로직
                // 1. 반짝임(highlight)이 있으면 최우선 적용
                // 2. 반짝임이 끝나면 수정됨(modified) 표시 적용
                const isHighlighted = highlightIds.has(p.part_id);
                const isModified = modifiedIds.has(p.part_id);

                let rowClass = "";
                if (isHighlighted) {
                  rowClass = "highlight-row";
                } else if (isModified) {
                  rowClass = "modified-row";
                }

                if (editingRowId === p.part_id) {
                  // ================== [수정 모드] ==================
                  return (
                    <tr key={p.part_id} className={rowClass}>
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
                  // ================== [일반 모드] ==================
                  return (
                    <tr key={p.part_id} className={rowClass}>
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

      <Modal show={showMergeSearchModal} onHide={() => setShowMergeSearchModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>호환(대체) 부품 검색 및 연결</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control className="mb-3" placeholder="연결할 부품명 검색..." onChange={(e) => setSearchTerm(e.target.value)} />
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <Table hover>
              <thead><tr><th>부품명</th><th>재고</th><th>선택</th></tr></thead>
              <tbody>
                {allParts.filter(p => p.part_name.toLowerCase().includes((searchTerm || '').toLowerCase()) && p.id !== mergeSourcePartId)
                  .map(p => (
                    <tr key={p.id}>
                      <td>{p.part_name}</td><td>{p.quantity}</td>
                      <td>
                        <Button size="sm" onClick={() => handleMergeParts(p.id)}>
                          선택하여 연결
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
      </Modal>

      <Modal show={showSwapModal} onHide={() => setShowSwapModal(false)}>
        <Modal.Header closeButton><Modal.Title>호환 부품 교체</Modal.Title></Modal.Header>
        <Modal.Body>
          {swapSource && (
            <div>
              <p><strong>기존 부품:</strong> {swapSource.part_name} (총 {swapSource.quantity_per}개 사용 중)</p>
              <p><strong>교체 대상:</strong> {swapTargetName} (ID: {swapTargetId})</p>
              <Form.Group className="mt-3">
                <Form.Label>교체할 수량</Form.Label>
                <Form.Control type="number" min="1" max={swapSource.quantity_per} value={swapQuantity} onChange={(e) => setSwapQuantity(e.target.value)} />
                <Form.Text className="text-muted">
                  * 전체 수량({swapSource.quantity_per})을 입력하면 기존 부품 행이 사라지고 병합됩니다.<br />
                  * 일부만 입력하면 리스트가 분리됩니다.
                </Form.Text>
              </Form.Group>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSwapModal(false)}>취소</Button>
          <Button variant="primary" onClick={executeSwap}>교체 실행</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default BOMPageDetail;