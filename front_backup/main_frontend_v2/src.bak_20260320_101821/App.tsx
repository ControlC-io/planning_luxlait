import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@shared/auth';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import TwoFactorChallenge from './pages/TwoFactorChallenge';
import EmailOtpChallenge from './pages/EmailOtpChallenge';
import Navbar from './components/Navbar';

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen flex flex-col bg-gray-50">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/auth/2fa-challenge" element={<TwoFactorChallenge />} />
              <Route path="/auth/email-otp" element={<EmailOtpChallenge />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
