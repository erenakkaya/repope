import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SiteProvider } from "@/context/SiteContext";
import Login from "@/pages/Login";
import Lobby from "@/pages/Lobby";
import Admin from "@/pages/Admin";

const Guard = ({ children, admin }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen" />;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "admin") return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <div className="App grain min-h-screen">
      <SiteProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Guard><Lobby /></Guard>} />
            <Route path="/admin" element={<Guard admin><Admin /></Guard>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      </SiteProvider>
      <Toaster theme="dark" position="top-right" richColors />
    </div>
  );
}

export default App;
