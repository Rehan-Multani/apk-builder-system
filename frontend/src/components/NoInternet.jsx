import React from 'react';
import { WifiOff } from 'lucide-react';

const NoInternet = () => {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center p-4">
      <div className="bg-[#1e293b] p-8 rounded-2xl shadow-xl border border-slate-700/50 flex flex-col items-center max-w-md w-full text-center">
        <div className="bg-red-500/10 p-4 rounded-full mb-6">
          <WifiOff className="w-16 h-16 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold mb-3">No Internet Connection</h1>
        <p className="text-slate-400 mb-8">
          It looks like you're offline. Please check your network connection and try again.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors w-full flex justify-center items-center gap-2"
        >
          Try Again
        </button>
      </div>
    </div>
  );
};

export default NoInternet;
