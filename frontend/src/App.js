import React, { useEffect, useMemo } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/DashBoard.js";
import BuildList from "./pages/BOM/BOMPage";
import BuildDetail from "./pages/BOM/BOMPageDetail";
import PartList from "./pages/Part/PartsPage";
import PartDetail from "./pages/Part/PartsPageDetail";
import ProjectDetailPage from "./pages/ProjectPageDetail";
import Test from "./pages/test";
import { UserProvider, useUser } from "./hooks/UserContext";
import LoginModal from "./components/LoginModal";
import axios from "axios";

import "bootstrap/dist/css/bootstrap.min.css";
import "../src/components/style.css";

function ProtectedLayout() {
  const { user, setUser } = useUser();

  const api = useMemo(() => axios.create({
    baseURL: "http://192.168.0.3:8000",
    withCredentials: true,
  }), []);

  useEffect(() => {
    async function checkLoginStatus() {
      try {
        const res = await api.get("/profile");
        setUser(res.data.user);
      } catch {
        setUser(null);
      }
    }
    checkLoginStatus();
  }, [api, setUser]);

  return (
    <>
      {!user && <LoginModal api={api} />} 
      <div
        style={{
          filter: !user ? "blur(2px)" : "none",
          pointerEvents: !user ? "none" : "auto",
        }}
      >
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<PartList />} />
            <Route path="buildList" element={<BuildList />} />
            <Route path="buildDetail/:id" element={<BuildDetail />} />
            <Route path="partList" element={<PartList />} />
            <Route path="partDetail/:id" element={<PartDetail />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="dashboard/:id" element={<Dashboard />} />
            <Route path="test" element={<Test />} />
          </Route>
        </Routes>
      </div>
    </>
  );
}

function App() {
  return (
    <UserProvider>
      <Router>
        <ProtectedLayout />
      </Router>
    </UserProvider>
  );
}

export default App;
