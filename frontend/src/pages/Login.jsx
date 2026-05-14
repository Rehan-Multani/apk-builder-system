import React, { useState } from 'react';
import axios from 'axios';
import { Rocket, Lock, Mail, Loader2 } from 'lucide-react';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('admin@wapixo.com');
  const [password, setPassword] = useState('adminpassword123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`https://backend.cloudedata.in/api/login`, { email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      onLogin(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full animate-fade-in" style={{ maxWidth: '400px' }}>
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-indigo-500 rounded-2xl shadow-xl shadow-indigo-500/20 text-white flex items-center justify-center">
              <Rocket size={32} />
            </div>
          </div>
          <h1 className="text-4xl text-white">Welcome Back</h1>
          <p className="text-slate-400 mt-2">Sign in to your APK Builder account</p>
        </div>

        <div className="glass-card">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400">Email Address</label>
              <div className="relative-container">
                <Mail className="input-icon" size={18} />
                <div className="input-group">
                  <input 
                    type="email" 
                    className="icon-padding"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400">Password</label>
              <div className="relative-container">
                <Lock className="input-icon" size={18} />
                <div className="input-group">
                  <input 
                    type="password" 
                    className="icon-padding"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="btn-primary"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In Now'}
            </button>
          </form>
        </div>

        <p className="text-center mt-8 text-xs text-slate-500">
          Powered by APK Builder Pro System
        </p>
      </div>

      <style>{`
        .relative-container { position: relative; width: 100%; }
        .input-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-dim); z-index: 10; pointer-events: none; }
        .icon-padding { padding-left: 3rem !important; }
      `}</style>
    </div>
  );
};

export default Login;
