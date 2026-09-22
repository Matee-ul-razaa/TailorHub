
import React, { Suspense } from "react";
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

// ── Lazy-loaded pages (code-split into separate chunks) ──
const Index = React.lazy(() => import("./pages/Index"));
const Login = React.lazy(() => import("./pages/Login"));
const ForgotPassword = React.lazy(() => import("./pages/ForgotPassword"));
const ChangePassword = React.lazy(() => import("./pages/ChangePassword"));
const CompleteProfile = React.lazy(() => import("./pages/CompleteProfile"));
const AuthSuccess = React.lazy(() => import("./pages/AuthSuccess"));
const PaymentSuccess = React.lazy(() => import("./pages/PaymentSuccess"));
const Catalog = React.lazy(() => import("./pages/Catalog"));
const ProductDetail = React.lazy(() => import("./pages/ProductDetail.jsx"));
const Cart = React.lazy(() => import("./pages/Cart"));
const VirtualTryOn = React.lazy(() => import("./pages/VirtualTryOn"));
const SkinToneAnalysis = React.lazy(() => import("./pages/SkinToneAnalysis"));
const Measurements = React.lazy(() => import("./pages/Measurements"));
const AdminDashboard = React.lazy(() => import("./pages/AdminDashboard"));
const DeliveryDashboard = React.lazy(() => import("./pages/DeliveryDashboard"));
const Tracking = React.lazy(() => import("./pages/Tracking"));
const Invoices = React.lazy(() => import("./pages/Invoices"));
const NotFound = React.lazy(() => import("./pages/NotFound"));

// ── Lightweight loading fallback ──
const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <div className="spinner-border text-accent" role="status" style={{ width: '2.5rem', height: '2.5rem' }}>
      <span className="visually-hidden">Loading...</span>
    </div>
  </div>
);

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
                  <Suspense fallback={<PageLoader />}>
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
                      <Route path="/tracking/:orderId" element={<ProtectedRoute><Tracking /></ProtectedRoute>} />
                      <Route path="/virtual-try-on" element={<ProtectedRoute><VirtualTryOn /></ProtectedRoute>} />
                      <Route path="/skin-tone" element={<ProtectedRoute><SkinToneAnalysis /></ProtectedRoute>} />
                      <Route path="/measurements" element={<ProtectedRoute><Measurements /></ProtectedRoute>} />

                      <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />

                      {/* Role-gated routes */}
                      <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
                      <Route path="/delivery" element={<ProtectedRoute requiredRole="delivery"><DeliveryDashboard /></ProtectedRoute>} />

                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
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

