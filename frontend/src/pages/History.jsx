import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { History as HistoryIcon, Download, ExternalLink, Smartphone, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const History = () => {
  const [builds, setBuilds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get(`https://backend.cloudedata.in/api/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBuilds(res.data);
    } catch (err) {
      console.error('History fetch error:', err);
      if (err.response?.status === 401) {
          window.location.href = '/login';
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      completed: 'badge-completed',
      failed: 'badge-failed',
      queued: 'badge-waiting',
      active: 'badge-active'
    };
    return <span className={`badge ${statusClasses[status] || 'badge-waiting'}`}>{status}</span>;
  };

  return (
    <div className="container py-8 animate-fade-in">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl text-white">Build History</h1>
          <p className="text-slate-400 mt-1">View and manage all your generated applications.</p>
        </div>
        <button 
          onClick={fetchHistory}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors border-none cursor-pointer"
        >
          Refresh List
        </button>
      </header>

      <div className="glass-card !p-0 overflow-hidden">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.5)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Project</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Configuration</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Key Properties</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>Downloads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="5" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                    <Loader2 className="animate-spin inline mr-2" size={20} />
                    Loading history...
                  </td>
                </tr>
              ) : builds.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                    No builds found. Start by creating a new project.
                  </td>
                </tr>
              ) : builds.map((build) => (
                <tr key={build._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="hover-row">
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                        <Smartphone size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-white">{build.appName}</p>
                        <p className="text-xs text-slate-500 font-mono">{build.packageName} (v{build.versionName})</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <ExternalLink size={12} />
                        <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{build.url}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock size={12} />
                        {new Date(build.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div className="space-y-1 text-[10px] font-mono">
                      <p className="text-slate-400"><span className="text-indigo-400">Alias:</span> {build.keyAlias || 'N/A'}</p>
                      <p className="text-slate-400"><span className="text-indigo-400">Key Pass:</span> {build.keyPassword || 'N/A'}</p>
                      <p className="text-slate-400"><span className="text-indigo-400">Store Pass:</span> {build.storePassword || 'N/A'}</p>
                    </div>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    {getStatusBadge(build.status)}
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                    {build.status === 'completed' && (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2 justify-end">
                          <a 
                            href={`https://backend.cloudedata.in${build.apkUrl}`} 
                            download
                            className="inline-flex items-center justify-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold transition-all no-underline"
                          >
                            <Download size={14} /> APK
                          </a>
                          <a 
                            href={`https://backend.cloudedata.in${build.aabUrl}`} 
                            download
                            className="inline-flex items-center justify-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold transition-all no-underline"
                          >
                            <Download size={14} /> AAB
                          </a>
                        </div>
                        <a 
                          href={`https://backend.cloudedata.in${build.jksUrl}`} 
                          download
                          className="inline-flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all no-underline hover:bg-slate-600 hover:text-white"
                        >
                          <Download size={14} /> JKS (Keystore)
                        </a>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <style>{`
        .hover-row:hover { background: rgba(255,255,255,0.02); }
        .no-underline { text-decoration: none; }
      `}</style>
    </div>
  );
};

export default History;
