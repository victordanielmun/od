import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { CharacterIdleRenderer } from '../components/dashboard/CharacterIdleRenderer';
import api from '../services/api';
import { 
  LogOut, 
  Users, 
  UserPlus, 
  X, 
  Gamepad2, 
  BookOpen, 
  Shield, 
  Swords, 
  Zap, 
  Coins, 
  Award, 
  Heart, 
  Sparkles,
  Brain
} from 'lucide-react';

export const Dashboard = () => {
  const { user, logout, isGuest } = useAuthStore();
  const navigate = useNavigate();

  // RPG stats state
  const [rpgStats, setRpgStats] = useState(null);
  const [rpgLoading, setRpgLoading] = useState(true);
  const [rpgError, setRpgError] = useState(null);

  // Learning stats state
  const [learningProfile, setLearningProfile] = useState(null);

  // Friends state
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [friendUsername, setFriendUsername] = useState('');
  const [friendsError, setFriendsError] = useState(null);
  const [friendsLoading, setFriendsLoading] = useState(false);

  const guestStatus = isGuest();

  // Load RPG Stats
  useEffect(() => {
    const fetchRPGStats = async () => {
      try {
        setRpgLoading(true);
        const response = await api.get('/player/stats');
        setRpgStats(response.data);
      } catch (err) {
        console.error('Failed to load RPG stats:', err);
        setRpgError(err.response?.data?.error || 'Failed to load stats');
      } finally {
        setRpgLoading(false);
      }
    };
    fetchRPGStats();
  }, []);

  // Load Learning Profile
  useEffect(() => {
    if (!guestStatus) {
      api.get('/learning/profile')
        .then(res => setLearningProfile(res.data))
        .catch(err => console.error('Failed to load learning profile:', err));
    }
  }, [guestStatus]);

  // Load Friends & Requests
  const fetchFriendsData = useCallback(async () => {
    if (guestStatus) return;
    setFriendsLoading(true);
    setFriendsError(null);
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        api.get('/friends'),
        api.get('/friends/requests')
      ]);
      setFriends(friendsRes.data?.friends || []);
      setIncomingRequests(requestsRes.data?.incoming || []);
    } catch (err) {
      console.error('Failed to fetch friends data:', err);
      setFriendsError(err.response?.data?.error || 'Failed to load friends');
    } finally {
      setFriendsLoading(false);
    }
  }, [guestStatus]);

  useEffect(() => {
    fetchFriendsData();
  }, [fetchFriendsData]);

  // Handle friend request operations
  const handleSendFriendRequest = async (e) => {
    e.preventDefault();
    if (!friendUsername.trim()) return;
    setFriendsError(null);
    try {
      await api.post('/friends/requests', { target_username: friendUsername.trim() });
      setFriendUsername('');
      fetchFriendsData();
    } catch (err) {
      setFriendsError(err.response?.data?.error || 'Failed to send request');
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await api.post(`/friends/requests/${requestId}/accept`);
      fetchFriendsData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await api.post(`/friends/requests/${requestId}/reject`);
      fetchFriendsData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveFriend = async (friendId) => {
    if (window.confirm('Are you sure you want to remove this friend?')) {
      try {
        await api.delete(`/friends/${friendId}`);
        fetchFriendsData();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleLogoutClick = () => {
    logout();
    navigate('/login');
  };

  const getExperiencePercentage = () => {
    if (!rpgStats) return 0;
    // Standard RPG curve or simplified percent for styling
    // Let's say XP needed per level is Level * 100
    const nextLevelXP = (rpgStats.level || 1) * 100;
    return Math.min(100, Math.round((rpgStats.experience / nextLevelXP) * 100));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 text-white font-sans selection:bg-yellow-500 selection:text-black py-8 px-4 sm:px-6 lg:px-8 relative">
      {/* Decorative backdrop glow elements */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Floating Close Button to return to the Lobby */}
      <button
        onClick={() => navigate('/lobby')}
        className="absolute top-6 right-6 z-50 p-2.5 bg-black/40 backdrop-blur-md border border-white/10 hover:border-yellow-500/30 text-gray-400 hover:text-white rounded-xl shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center"
        title="Back to Lobby"
      >
        <X size={20} />
      </button>

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 pb-6 border-b border-white/10 gap-4">
          <div className="flex items-center gap-3">
            <img src="/banners/logo.png" alt="Odisea Logo" className="w-24 h-auto object-contain" />
            <div>
              <h1 className="text-3xl font-extrabold tracking-wider bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent uppercase font-medieval">
                Odyssey Adventurer Card
              </h1>
              <p className="text-gray-400 text-sm mt-0.5">
                Prepare your stats before venturing into the game lobby
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/learn')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 transition-all hover:scale-105"
            >
              <Brain size={18} />
              <span>Practice English</span>
            </button>

            <button
              onClick={handleLogoutClick}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all hover:scale-105"
            >
              <LogOut size={18} />
              <span>Log Out</span>
            </button>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
          
          {/* Column 1: Character Portrait & RPG Stats (6 cols) */}
          <section className="lg:col-span-7 space-y-6">
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 bg-yellow-500/10 border-b border-l border-white/10 text-yellow-400 text-xs font-mono uppercase rounded-bl-xl tracking-widest">
                {rpgStats?.class || 'Adventurer'}
              </div>
              
              <h2 className="text-xl font-bold text-yellow-400 border-b border-white/10 pb-3 mb-6 font-medieval tracking-wide flex items-center gap-2">
                <Sparkles size={20} className="text-yellow-500" />
                Character & Base Stats
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Spritesheet Idle Animation Frame */}
                <div className="md:col-span-5 flex flex-col items-center justify-center bg-gray-950/60 border border-white/5 rounded-xl p-4 min-h-[220px]">
                  <CharacterIdleRenderer 
                    characterId={user?.character_id || '1'} 
                    scale={3.2} 
                    className="mb-4"
                  />
                  <div className="text-center">
                    <p className="text-lg font-bold text-white font-medieval">{user?.username}</p>
                    {guestStatus && (
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Guest Traveler
                      </span>
                    )}
                  </div>
                </div>

                {/* HP, MP & Primary stats */}
                <div className="md:col-span-7 space-y-5">
                  {rpgLoading ? (
                    <div className="space-y-4 py-8">
                      <div className="h-4 bg-white/5 rounded animate-pulse w-3/4"></div>
                      <div className="h-4 bg-white/5 rounded animate-pulse w-full"></div>
                      <div className="h-4 bg-white/5 rounded animate-pulse w-5/6"></div>
                    </div>
                  ) : rpgError ? (
                    <div className="text-red-400 text-sm py-8 text-center">{rpgError}</div>
                  ) : (
                    <>
                      {/* Health Points (HP) */}
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1.5 text-emerald-400">
                          <span className="flex items-center gap-1"><Heart size={14} /> Health Points (HP)</span>
                          <span>{rpgStats.hp_current} / {rpgStats.hp_max}</span>
                        </div>
                        <div className="w-full h-3 bg-gray-900 rounded-full border border-white/5 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-emerald-600 to-green-400 transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                            style={{ width: `${Math.min(100, Math.round((rpgStats.hp_current / rpgStats.hp_max) * 100))}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Mana Points (MP) */}
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1.5 text-blue-400">
                          <span className="flex items-center gap-1"><Sparkles size={14} /> Mana Points (MP)</span>
                          <span>{rpgStats.mp_current} / {rpgStats.mp_max}</span>
                        </div>
                        <div className="w-full h-3 bg-gray-900 rounded-full border border-white/5 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                            style={{ width: `${Math.min(100, Math.round((rpgStats.mp_current / rpgStats.mp_max) * 100))}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Experience Points (XP) */}
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1.5 text-amber-400">
                          <span className="flex items-center gap-1"><Award size={14} /> Experience & Level {rpgStats.level}</span>
                          <span>{rpgStats.experience} / {rpgStats.level * 100} XP</span>
                        </div>
                        <div className="w-full h-3 bg-gray-900 rounded-full border border-white/5 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 transition-all duration-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                            style={{ width: `${getExperiencePercentage()}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Combat core stats */}
                      <div className="grid grid-cols-3 gap-3 pt-2">
                        <div className="bg-gray-950/40 border border-white/5 rounded-xl p-3 text-center">
                          <Swords className="mx-auto text-red-400 mb-1 w-5 h-5" />
                          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Attack</span>
                          <p className="text-lg font-bold text-white mt-0.5">{rpgStats.attack}</p>
                        </div>

                        <div className="bg-gray-950/40 border border-white/5 rounded-xl p-3 text-center">
                          <Shield className="mx-auto text-blue-400 mb-1 w-5 h-5" />
                          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Defense</span>
                          <p className="text-lg font-bold text-white mt-0.5">{rpgStats.defense}</p>
                        </div>

                        <div className="bg-gray-950/40 border border-white/5 rounded-xl p-3 text-center">
                          <Zap className="mx-auto text-amber-400 mb-1 w-5 h-5" />
                          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Speed</span>
                          <p className="text-lg font-bold text-white mt-0.5">{rpgStats.speed}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>

              </div>

              {/* Gold Indicator */}
              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-gray-400 text-sm">Bag Gold</span>
                <div className="flex items-center gap-1.5 text-yellow-400 font-bold text-lg font-mono">
                  <Coins size={18} className="text-yellow-500 animate-bounce" />
                  <span>{rpgStats?.gold ?? 0}g</span>
                </div>
              </div>
            </div>
          </section>

          {/* Column 2: Learning Stats & Friends (5 cols) */}
          <section className="lg:col-span-5 space-y-6">
            
            {/* Learning Profile */}
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-indigo-400 border-b border-white/10 pb-3 mb-4 font-medieval tracking-wide flex items-center gap-2">
                <BookOpen size={20} className="text-indigo-400" />
                English Training Profile
              </h2>

              {guestStatus ? (
                <div className="py-6 text-center text-sm text-gray-400">
                  <p>Register an account to unlock complete English training tracking and quests.</p>
                </div>
              ) : learningProfile ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-indigo-950/30 border border-indigo-500/10 rounded-xl p-3">
                    <span className="text-gray-400 text-sm">English Level</span>
                    <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-bold uppercase tracking-wider">
                      {learningProfile.english_level}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-950/40 border border-white/5 rounded-xl p-3">
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Training XP</span>
                      <span className="text-xl font-bold text-white mt-1 block">{learningProfile.total_xp} XP</span>
                    </div>

                    <div className="bg-gray-950/40 border border-white/5 rounded-xl p-3">
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Weekly Score</span>
                      <span className="text-xl font-bold text-white mt-1 block">{learningProfile.weekly_score} pts</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-950/40 border border-white/5 rounded-xl p-3">
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Weekly Attempts</span>
                      <span className="text-xl font-bold text-white mt-1 block">{learningProfile.weekly_attempts}</span>
                    </div>

                    <div className="bg-gray-950/40 border border-white/5 rounded-xl p-3">
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Correct Answers</span>
                      <span className="text-xl font-bold text-green-400 mt-1 block">{learningProfile.weekly_correct}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-gray-400">
                  <p>No learning profile loaded yet.</p>
                </div>
              )}
            </div>

            {/* Guild / Friends */}
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-emerald-400 border-b border-white/10 pb-3 mb-4 font-medieval tracking-wide flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={20} className="text-emerald-400" />
                  <span>Companions Guild</span>
                </div>
                {!guestStatus && (
                  <button 
                    onClick={fetchFriendsData}
                    className="text-[10px] font-mono text-emerald-400/60 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 border border-emerald-500/20 rounded"
                  >
                    Refresh
                  </button>
                )}
              </h2>

              {guestStatus ? (
                <div className="py-6 text-center text-sm text-gray-400">
                  <p>Social features and guilds require a registered account.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  
                  {/* Friend invitation form */}
                  <form onSubmit={handleSendFriendRequest} className="flex gap-2">
                    <input 
                      value={friendUsername} 
                      onChange={(e) => setFriendUsername(e.target.value)} 
                      placeholder="Username to invite..." 
                      className="flex-1 bg-gray-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500" 
                    />
                    <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/30 text-white rounded-xl px-3 py-1.5 text-xs font-bold transition flex items-center gap-1">
                      <UserPlus size={14} />
                      <span>Invite</span>
                    </button>
                  </form>

                  {friendsError && (
                    <p className="text-red-400 text-xs mt-1 text-center font-mono">{friendsError}</p>
                  )}

                  {/* Incoming Requests */}
                  {incomingRequests.length > 0 && (
                    <div className="border border-yellow-500/30 bg-yellow-500/5 p-3 rounded-xl space-y-2">
                      <p className="text-xs font-bold text-yellow-400 tracking-wide uppercase">Incoming Petitions</p>
                      {incomingRequests.map(req => (
                        <div key={req.id} className="flex justify-between items-center text-xs bg-gray-950/60 border border-white/5 p-2 rounded-lg">
                          <span className="font-bold text-gray-300 font-mono">{req.requester_username}</span>
                          <div className="flex gap-1.5">
                            <button onClick={() => handleAcceptRequest(req.id)} className="px-2 py-0.5 bg-green-600 text-white rounded text-[10px] font-bold">Accept</button>
                            <button onClick={() => handleRejectRequest(req.id)} className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold">Decline</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Friends List */}
                  {friendsLoading ? (
                    <div className="space-y-2 py-4">
                      <div className="h-8 bg-white/5 rounded animate-pulse"></div>
                      <div className="h-8 bg-white/5 rounded animate-pulse"></div>
                    </div>
                  ) : friends.length === 0 ? (
                    <p className="text-center text-xs text-gray-500 py-4 italic">No guild companions added yet.</p>
                  ) : (
                    <ul className="space-y-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                      {friends.map(f => (
                        <li key={f.id} className="flex items-center justify-between bg-gray-950/40 hover:bg-gray-950/60 border border-white/5 p-2.5 rounded-xl transition-colors">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="w-2.5 h-2.5 rounded-full bg-gray-600 shadow-md"></span>
                            <span className="text-xs font-medium text-gray-200 truncate">{f.username}</span>
                          </div>
                          <button onClick={() => handleRemoveFriend(f.id)} className="text-red-400/60 hover:text-red-400 transition-colors p-1" title="Remove companion">
                            <X size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                </div>
              )}
            </div>

          </section>

        </div>

        {/* Action Button: Play/Enter Lobby */}
        <div className="flex justify-center mt-10">
          <button
            onClick={() => navigate('/lobby')}
            className="group relative flex items-center gap-3 px-12 py-5 rounded-2xl bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 text-black font-extrabold text-lg uppercase font-medieval tracking-widest shadow-[0_0_30px_rgba(245,158,11,0.3)] transition-all hover:scale-105 active:scale-95 border-2 border-yellow-300 hover:shadow-[0_0_40px_rgba(245,158,11,0.5)] cursor-pointer"
          >
            <Gamepad2 className="w-6 h-6 text-black group-hover:rotate-12 transition-transform" />
            <span>Enter Lobby Realm</span>
          </button>
        </div>

      </div>
    </div>
  );
};
