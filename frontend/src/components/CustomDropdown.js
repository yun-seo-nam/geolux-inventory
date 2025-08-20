import React, { useState, useEffect, useContext } from 'react';
import { Dropdown } from 'react-bootstrap';
import AddUserModal from './AddUserModal';
import { UserContext } from '../hooks/UserContext';
// import { FiTrash2 } from 'react-icons/fi';

const CustomDropdown = ({ defaultLabel = "선택", variant = "primary", icon = null, renderExtra = null }) => {
  const { selectedUser, setSelectedUser, addUser, logout } = useContext(UserContext);
  const [selectedLabel, setSelectedLabel] = useState(defaultLabel);
  const [showAddModal, setShowAddModal] = useState(false);


  useEffect(() => {
    if (selectedUser) {
      setSelectedLabel(selectedUser.label);
    } else {
      setSelectedLabel(defaultLabel);
    }
  }, [selectedUser, defaultLabel]);

  // const handleSelect = (user) => {
  //   setSelectedUser(user);
  // };

  const handleAddUser = async (newUser) => {
    const success = await addUser(newUser.value, newUser.password);
    if (success) {
      setSelectedUser(newUser);
      return true;
    }
    return false;
  };

  // const handleDeleteUser = (userToDelete) => {
  //   if (window.confirm(`사용자 '${userToDelete.label}' 을(를) 삭제하시겠습니까?`)) {
  //     deleteUser(userToDelete.value);
  //     if (selectedUser && selectedUser.value === userToDelete.value) {
  //       setSelectedUser(null);
  //     }
  //   }
  // };

  return (
    <div className="custom-dropdown-wrapper d-flex align-items-center px-2 py-1 rounded">
      <Dropdown>
        <Dropdown.Toggle variant={variant} id="custom-dropdown" className="d-flex align-items-center gap-1">
          {icon && <span className="icon-wrapper mb-1">{icon}</span>}
          {selectedUser}
        </Dropdown.Toggle>

        <Dropdown.Menu>
          {/* {userList.map((user, idx) => (
            <Dropdown.Item key={idx} className="d-flex justify-content-between align-items-center" onClick={() => handleSelect(user)}>
              <span>{user.label}</span>
              <Button
                variant="light"
                size="sm"
                onClick={e => {
                  e.stopPropagation();
                  handleDeleteUser(user);
                }}
              >
                <FiTrash2 />
              </Button>
            </Dropdown.Item>
          ))} */}

          <div className="d-flex justify-content-center">
            <div style={{cursor: 'pointer', fontSize: '12px', margin: '0px'}} onClick={logout}>
              로그아웃
            </div>
          </div>
        </Dropdown.Menu>
      </Dropdown>

      <AddUserModal
        show={showAddModal}
        onHide={() => setShowAddModal(false)}
        onAddUser={handleAddUser}
      />
    </div>
  );
};

export default CustomDropdown;
