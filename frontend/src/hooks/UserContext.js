import React, { createContext, useState, useEffect, useContext } from 'react';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [userList, setUserList] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [user, setUser] = useState(null); // 현재 로그인 유저 상태 추가

  // 사용자 목록 불러오기
  const fetchUsers = async () => {
    try {
      const res = await fetch('http://localhost:8000/users', { credentials: 'include' });
      const data = await res.json();
      setUserList(data);
    } catch (err) {
      console.error(err);
    }
  };

  // 사용자 추가
  const addUser = async (username, password) => {
    const res = await fetch('http://localhost:8000/users', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      fetchUsers();
      return true;
    } else {
      alert(data.msg || '추가 실패');
      return false;
    }
  };

  // 사용자 삭제
  const deleteUser = async (userId) => {
    const res = await fetch(`http://localhost:8000/users/${userId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    const data = await res.json();
    if (res.ok) {
      fetchUsers();
    } else {
      alert(data.msg || '삭제 실패');
    }
  };

  // 로그인
  const login = async (username, password) => {
    const res = await fetch('http://localhost:8000/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      setUser(data.user);
      return true;
    } else {
      alert(data.msg || '로그인 실패');
      return false;
    }
  };

  // 로그아웃
  const logout = async () => {
    await fetch('http://localhost:8000/logout', {
      method: 'POST',
      credentials: 'include'
    });
    setUser(null);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <UserContext.Provider
      value={{
        userList,
        setUserList,
        selectedUser,
        setSelectedUser,
        addUser,
        deleteUser,
        login,   // login 추가
        logout,  // logout 추가
        user,    // 현재 로그인 유저 정보
        setUser
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  return useContext(UserContext);
};
