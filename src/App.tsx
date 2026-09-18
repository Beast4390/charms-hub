import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';

import { TopBanner } from './components/TopBanner/TopBanner';
import { Header } from './components/Header/Header';
import { Footer } from './components/Footer/Footer';
import { CartDrawer } from './components/Cart/CartDrawer';
import { ChatbotModal } from './components/Chatbot/ChatbotModal';
import { WhatsAppButton } from './components/WhatsAppButton/WhatsAppButton';

import { HomePage } from './pages/Home/HomePage';
import { ProductsPage } from './pages/Products/ProductsPage';
import { ProductDetailsPage } from './pages/ProductDetails/ProductDetailsPage';
import { CategoriesPage } from './pages/Categories/CategoriesPage';
import { CartPage } from './pages/Cart/CartPage';
import { AccountPage } from './pages/Account/AccountPage';
import { LoginPage } from './pages/Auth/LoginPage';
import { RegisterPage } from './pages/Auth/RegisterPage';
import { PolicyPage } from './pages/Policy/PolicyPage';
import { ShopOwnerDashboard } from './pages/ShopOwner/ShopOwnerDashboard';
import { DeveloperDashboard } from './pages/Developer/DeveloperDashboard';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <div className="min-h-screen flex flex-col bg-[#FCF8F5] dark:bg-[#3F070B] text-[#2B1810] dark:text-[#FCF7DC] font-sans transition-colors duration-200">
              {/* Top Announcement Marquee */}
              <TopBanner />

              {/* Main Navigation Header */}
              <Header />

              {/* Main App Content View */}
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/products" element={<ProductsPage />} />
                  <Route path="/products/:productId" element={<ProductDetailsPage />} />
                  <Route path="/categories" element={<CategoriesPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/account" element={<AccountPage />} />
                  <Route path="/owner" element={<ShopOwnerDashboard />} />
                  <Route path="/developer" element={<DeveloperDashboard />} />
                  <Route path="/auth/login" element={<LoginPage />} />
                  <Route path="/auth/register" element={<RegisterPage />} />
                  <Route path="/policy" element={<PolicyPage />} />
                  <Route path="/policy/:type" element={<PolicyPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>

              {/* Storefront Footer */}
              <Footer />

              {/* Slide-out Cart Drawer */}
              <CartDrawer />

              {/* Interactive AI Shopping Assistant */}
              <ChatbotModal />

              {/* Floating WhatsApp Contact Quick Action */}
              <WhatsAppButton />
            </div>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
