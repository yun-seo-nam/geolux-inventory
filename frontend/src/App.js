import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import BuildList from "./pages/BOM/BOMPage";
import BuildDetail from "./pages/BOM/BOMPageDetail";
import PartList from "./pages/Part/PartsPage";
import PartDetail from "./pages/Part/PartsPageDetail";
import ProjectList from "./pages/DashBoard";
import ProjectDetail from "./pages/ProjectPageDetail";
import OverView from "./pages/OverView";
import AliasName from './pages/AliasName';

import "bootstrap/dist/css/bootstrap.min.css";
import "../src/components/style.css";

function App() {
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<PartList />} />
            <Route path="buildList" element={<BuildList />} />
            <Route path="buildDetail/:id" element={<BuildDetail />} />
            <Route path="partList" element={<PartList />} />
            <Route path="partDetail/:id" element={<PartDetail />} />
            <Route path="project" element={<ProjectList />} />
            <Route path="projectDetail/:id" element={<ProjectDetail />} />
            <Route path="overView" element={<OverView />} />
            <Route path="aliasName" element={<AliasName />} />
          </Route>
        </Routes>
      </div>
    </Router>
  );
}

export default App;
