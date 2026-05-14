import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, History, LogOut, Rocket } from 'lucide-react';

const Navbar = ({ user, onLogout }) => {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="py-4">
      <div className="container flex items-center justify-between">
        {/* Logo Section */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500 text-white rounded-lg flex items-center justify-center">
            <Rocket size={20} />
          </div>
          <span className="text-xl font-bold tracking-tight md:block hidden">
            APK Builder <span className="text-indigo-500">Pro</span>
          </span>
        </div>

        {/* Links & User Section */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-6">
            <Link 
              to="/" 
              className={`flex items-center gap-2 nav-link ${isActive('/') ? 'active' : ''}`}
            >
              <LayoutDashboard size={18} />
              <span className="font-medium hidden md:block">Dashboard</span>
            </Link>
            <Link 
              to="/history" 
              className={`flex items-center gap-2 nav-link ${isActive('/history') ? 'active' : ''}`}
            >
              <History size={18} />
              <span className="font-medium hidden md:block">Builds</span>
            </Link>
          </div>

          <div className="flex items-center gap-4 border-l border-slate-800 pl-6">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold leading-none text-white">{user.email}</p>
              <p className="text-xs text-slate-400 mt-1">Administrator</p>
            </div>
            <button 
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-danger transition-colors bg-transparent border-none cursor-pointer"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
