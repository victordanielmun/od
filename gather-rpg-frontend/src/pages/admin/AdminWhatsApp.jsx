import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { 
  QrCode, 
  RefreshCw, 
  Trash2, 
  Wifi, 
  WifiOff, 
  Smartphone, 
  ShieldAlert, 
  Info, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';

export const AdminWhatsApp = () => {
  const [instances, setInstances] = useState([]);
  const [serverHealth, setServerHealth] = useState('unknown'); // 'online' | 'offline' | 'unknown'
  const [globalStatus, setGlobalStatus] = useState(null);
  const [globalQRData, setGlobalQRData] = useState(null);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch all instances
  const fetchInstances = async () => {
    setLoadingInstances(true);
    try {
      const res = await api.get('/admin/whatsapp/instances');
      setInstances(Array.isArray(res.data) ? res.data : []);
      setServerHealth('online');
      setErrorMessage('');
    } catch (err) {
      console.error('Failed to fetch whatsapp instances:', err);
      setServerHealth('offline');
      setErrorMessage('Failed to connect to local Evolution API server.');
    } finally {
      setLoadingInstances(false);
    }
  };

  // Fetch global admin instance status
  const fetchGlobalStatus = async () => {
    try {
      const res = await api.get('/admin/whatsapp/global/status');
      // Evolution API connectionState endpoint usually returns { instance: { state: "open" } }
      // or similar payload. Let's handle various formats
      const state = res.data?.instance?.state || res.data?.state || 'close';
      setGlobalStatus(state);
      
      // If it is open, we can clear any QR code data
      if (state === 'open') {
        setGlobalQRData(null);
      }
    } catch (err) {
      console.error('Failed to fetch global whatsapp status:', err);
      setGlobalStatus('close');
    }
  };

  // Generate QR code for the global admin instance
  const handleGenerateGlobalQR = async () => {
    setLoadingGlobal(true);
    setErrorMessage('');
    try {
      const res = await api.get('/admin/whatsapp/global/qr');
      // Evolution API connect endpoint returns QR code data:
      // { qrcode: { base64: "data:image/png;base64,...", code: "..." } } or similar
      const qrBase64 = res.data?.qrcode?.base64 || res.data?.base64;
      const state = res.data?.instance?.state || res.data?.state || 'close';
      
      setGlobalStatus(state);
      if (qrBase64) {
        setGlobalQRData(qrBase64);
        setSuccessMessage('Global QR code generated successfully. Please scan inside WhatsApp!');
      } else {
        setErrorMessage('Failed to retrieve QR code image from Evolution API.');
      }
    } catch (err) {
      console.error('Failed to generate global QR:', err);
      setErrorMessage('Error communicating with backend to generate QR.');
    } finally {
      setLoadingGlobal(false);
    }
  };

  // Delete/Disconnect any specific instance
  const handleDeleteInstance = async (name) => {
    if (!window.confirm(`Are you sure you want to permanently delete instance "${name}"?`)) {
      return;
    }
    try {
      await api.delete(`/admin/whatsapp/instances/${name}`);
      setSuccessMessage(`Instance "${name}" deleted successfully.`);
      fetchInstances();
      // If we deleted the global instance, reset its status
      if (name === 'admin_global') {
        setGlobalStatus('close');
        setGlobalQRData(null);
      }
    } catch (err) {
      console.error('Failed to delete instance:', err);
      setErrorMessage(`Failed to delete instance "${name}".`);
    }
  };

  // Initial load
  useEffect(() => {
    fetchInstances();
    fetchGlobalStatus();
  }, []);

  // Poll status periodically (every 7 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchInstances();
      fetchGlobalStatus();
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  // Helper to render connection status badge
  const renderStatusBadge = (state) => {
    const s = String(state).toLowerCase();
    if (s === 'open' || s === 'connected') {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 size={12} /> Connected
        </span>
      );
    } else if (s === 'connecting' || s === 'refusing') {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 animate-pulse">
          <RefreshCw size={12} className="animate-spin" /> Connecting
        </span>
      );
    } else if (s === 'qr' || s === 'qrcode') {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <QrCode size={12} /> Pending Scan
        </span>
      );
    } else {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30">
          <AlertCircle size={12} /> Disconnected
        </span>
      );
    }
  };

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-wider bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent uppercase font-medieval mb-2 drop-shadow-md">
          WhatsApp API Management
        </h1>
        <p className="text-gray-400 text-sm">
          Monitor and manage Evolution API instances, connect the global notifier, and force session deletions.
        </p>
      </div>

      {/* Alert Banners */}
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 backdrop-blur-md">
          <ShieldAlert className="shrink-0 mt-0.5" size={18} />
          <div>
            <h4 className="font-bold text-sm">Error Encountered</h4>
            <p className="text-xs text-red-400/90 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-start gap-3 backdrop-blur-md">
          <CheckCircle2 className="shrink-0 mt-0.5" size={18} />
          <div>
            <h4 className="font-bold text-sm">Operation Success</h4>
            <p className="text-xs text-emerald-400/90 mt-0.5">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Grid Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Server Status & Quick Actions */}
        <div className="space-y-8 lg:col-span-1">
          {/* Server Connection Card */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-2xl shadow-2xl relative overflow-hidden">
            <h3 className="text-md font-extrabold text-white font-medieval uppercase tracking-wider mb-4 border-b border-white/10 pb-2">
              Evolution API Server
            </h3>
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm">Status Indicator</span>
              {serverHealth === 'online' ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <Wifi size={14} /> Online
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30">
                  <WifiOff size={14} /> Offline
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 space-y-1 mb-6">
              <p>Host URL: <code className="bg-white/5 px-1 py-0.5 rounded">http://localhost:8080</code></p>
              <p>Security: <span className="text-yellow-500 font-bold">API Key Enabled</span></p>
            </div>
            <button
              onClick={() => {
                fetchInstances();
                fetchGlobalStatus();
              }}
              disabled={loadingInstances}
              className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-2 px-4 rounded-xl transition-all text-xs uppercase tracking-wider font-medieval"
            >
              <RefreshCw size={14} className={loadingInstances ? 'animate-spin' : ''} />
              Refresh Connection
            </button>
          </div>

          {/* Quick Info / Instructions Card */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-2xl shadow-2xl relative overflow-hidden">
            <h3 className="text-md font-extrabold text-white font-medieval uppercase tracking-wider mb-4 border-b border-white/10 pb-2 flex items-center gap-2">
              <Info size={16} className="text-yellow-400" /> WhatsApp Integration
            </h3>
            <div className="text-xs text-gray-400 space-y-4">
              <p>
                This module lets Gather RPG communicate with players via **WhatsApp**. It facilitates mission alerts, interactive commands, and companion NPCs.
              </p>
              <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-2">
                <h4 className="font-bold text-white flex items-center gap-1"><Smartphone size={12} /> Global Session:</h4>
                <p className="text-[11px] leading-relaxed">
                  Used by the server to dispatch automatic notifications, items drops, or lobby announcements. Admins should connect it first.
                </p>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-2">
                <h4 className="font-bold text-white flex items-center gap-1"><QrCode size={12} /> Player Sessions:</h4>
                <p className="text-[11px] leading-relaxed">
                  Players can link their personal WhatsApp accounts from their game client dashboard to sync companion NPCs and complete mobile missions.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Global Instance Connector & Session Manager */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Global Notification Connection Panel */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-2xl shadow-2xl relative overflow-hidden">
            <h3 className="text-md font-extrabold text-white font-medieval uppercase tracking-wider mb-4 border-b border-white/10 pb-2">
              Global Notification Session (`admin_global`)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div>
                <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                  Connect the primary server notification phone number. This account will trigger dialogs and alerts for the entire virtual realm.
                </p>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">Instance ID</span>
                    <code className="text-gray-300 font-mono font-bold bg-white/5 px-1.5 py-0.5 rounded">admin_global</code>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">Link Status</span>
                    {renderStatusBadge(globalStatus)}
                  </div>
                </div>

                <div className="space-y-3">
                  {globalStatus !== 'open' && (
                    <button
                      onClick={handleGenerateGlobalQR}
                      disabled={loadingGlobal || serverHealth === 'offline'}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 hover:shadow-[0_0_15px_rgba(245,158,11,0.2)] text-black font-extrabold py-3 px-4 rounded-xl transition-all text-xs uppercase tracking-wider font-medieval border border-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <QrCode size={14} />
                      {loadingGlobal ? 'Generating QR...' : 'Generate Connection QR'}
                    </button>
                  )}
                  {globalStatus === 'open' && (
                    <button
                      onClick={() => handleDeleteInstance('admin_global')}
                      className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-bold py-3 px-4 rounded-xl transition-all text-xs uppercase tracking-wider font-medieval"
                    >
                      <Trash2 size={14} />
                      Disconnect Global Session
                    </button>
                  )}
                </div>
              </div>

              {/* QR Container */}
              <div className="flex flex-col items-center justify-center bg-black/60 border border-white/5 rounded-2xl p-6 min-h-[220px]">
                {loadingGlobal ? (
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="animate-spin text-yellow-400" size={32} />
                    <p className="text-xs text-gray-500">Requesting QR code image...</p>
                  </div>
                ) : globalStatus === 'open' ? (
                  <div className="flex flex-col items-center text-center gap-3 text-emerald-400 p-4">
                    <CheckCircle2 size={48} className="text-emerald-500 animate-bounce" />
                    <h4 className="font-extrabold text-sm font-medieval uppercase">Session fully linked</h4>
                    <p className="text-xs text-gray-500 max-w-[200px] leading-relaxed">
                      The global notification bot is running and listening for commands.
                    </p>
                  </div>
                ) : globalQRData ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="bg-white p-3 rounded-xl shadow-2xl border-4 border-yellow-500/20">
                      <img src={globalQRData} alt="WhatsApp QR Code" className="w-[160px] h-[160px] object-contain" />
                    </div>
                    <p className="text-[10px] text-gray-500 max-w-[220px] text-center leading-relaxed">
                      Scan this QR code with WhatsApp Linked Devices on your phone.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center gap-2 text-gray-600 p-4">
                    <HelpCircle size={40} />
                    <h4 className="font-bold text-xs uppercase text-gray-500">No QR Generated</h4>
                    <p className="text-[10px] max-w-[180px] leading-relaxed text-gray-500/80">
                      Click the "Generate Connection QR" button to request a pairing code.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Active Sessions List Table */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-2xl shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
              <h3 className="text-md font-extrabold text-white font-medieval uppercase tracking-wider">
                All Active Sessions ({instances.length})
              </h3>
              <button
                onClick={fetchInstances}
                className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all"
                title="Refetch List"
              >
                <RefreshCw size={14} className={loadingInstances ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              {instances.length === 0 ? (
                <div className="text-center py-8 text-gray-600 text-sm">
                  No active WhatsApp instances found. Player profiles will create instances once they link.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="pb-3 pl-2">Instance Name</th>
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Connection State</th>
                      <th className="pb-3 text-right pr-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300 font-sans">
                    {instances.map((inst, index) => {
                      const name = inst.instanceName || inst.name || 'unknown';
                      const isGlobal = name === 'admin_global';
                      const state = inst.connectionState || inst.state || 'close';

                      return (
                        <tr key={index} className="hover:bg-white/5 transition-all">
                          <td className="py-4 pl-2 font-mono font-bold text-gray-200">
                            {name}
                          </td>
                          <td className="py-4">
                            {isGlobal ? (
                              <span className="text-yellow-400 font-medieval font-bold uppercase tracking-wider text-[10px]">System</span>
                            ) : (
                              <span className="text-blue-400 text-[10px] font-bold">Player Session</span>
                            )}
                          </td>
                          <td className="py-4">
                            {renderStatusBadge(state)}
                          </td>
                          <td className="py-4 text-right pr-2">
                            <button
                              onClick={() => handleDeleteInstance(name)}
                              className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-transparent hover:border-red-500/20 transition-all"
                              title="Delete Instance Session"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
