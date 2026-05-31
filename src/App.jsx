
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { StoreProvider } from "@/context/StoreContext";
import { ThemeProvider } from "@/context/ThemeContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import "./theme.css";
import "./styles/glass.css";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ChangePassword from "./pages/ChangePassword";
import CompleteProfile from "./pages/CompleteProfile";
import AuthSuccess from "./pages/AuthSuccess";
import PaymentSuccess from "./pages/PaymentSuccess";
import Catalog from "./pages/Catalog";
import ProductDetail from "./pages/ProductDetail.jsx";
import Cart from "./pages/Cart";
import VirtualTryOn from "./pages/VirtualTryOn";
import SkinToneAnalysis from "./pages/SkinToneAnalysis";
import Measurements from "./pages/Measurements";
import AIMeasurements from "./pages/AIMeasurements";
import AdminDashboard from "./pages/AdminDashboard";
import DeliveryDashboard from "./pages/DeliveryDashboard";
import Tracking from "./pages/Tracking";
import Invoices from "./pages/Invoices";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <StoreProvider>
            <ThemeProvider>
              <CartProvider>
                <TooltipProvider>
                  <Toaster />
                <Sonner />
                <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<Index />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/complete-profile" element={<CompleteProfile />} />
                    <Route path="/auth-success" element={<AuthSuccess />} />
                    <Route path="/catalog" element={<Catalog />} />
                    <Route path="/product/:id" element={<ProductDetail />} />
                    <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />

                    {/* Auth-gated customer routes */}
                    <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
                    <Route path="/payment-success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
                    <Route path="/tracking" element={<ProtectedRoute><Tracking /></ProtectedRoute>} />
                    <Route path="/virtual-try-on" element={<ProtectedRoute><VirtualTryOn /></ProtectedRoute>} />
                    <Route path="/skin-tone" element={<ProtectedRoute><SkinToneAnalysis /></ProtectedRoute>} />
                    <Route path="/measurements" element={<ProtectedRoute><Measurements /></ProtectedRoute>} />
                    <Route path="/ai-measurements" element={<ProtectedRoute><AIMeasurements /></ProtectedRoute>} />
                    <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />

                    {/* Role-gated routes */}
                    <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
                    <Route path="/delivery" element={<ProtectedRoute requiredRole="delivery"><DeliveryDashboard /></ProtectedRoute>} />

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </TooltipProvider>
              </CartProvider>
            </ThemeProvider>
          </StoreProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
