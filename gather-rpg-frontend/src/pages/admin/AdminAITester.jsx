import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, Mic, MicOff, Send, MessageSquare, AlertCircle, Loader2, User, Shield, Sparkles, Settings, Copy, Check, Users } from 'lucide-react';
import api from '../../services/api';
import { analyzeAudio } from '../../services/voiceApi';

export const AdminAITester = () => {
    const { t } = useTranslation();
    
    // Data states
    const [definitions, setDefinitions] = useState([]);
    const [selectedNPC, setSelectedNPC] = useState(null);
    const [missionContext, setMissionContext] = useState('Introduce yourself and tell the player about the forest.');
    const [conditionMet, setConditionMet] = useState(false);
    const [conditionInfo, setConditionInfo] = useState('The player does not have the magic herb yet.');
    const [pronTips, setPronTips] = useState('Try to pronounce all words.');
    const [pronDiffs, setPronDiffs] = useState('Expected "forest", heard "foret"');

    // Prompt states
    const [systemPrompt, setSystemPrompt] = useState('');
    const [userPrompt, setUserPrompt] = useState('Hello! Who are you?');
    const [response, setResponse] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);
    
    // Voice/Recording states
    const [isRecording, setIsRecording] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    useEffect(() => {
        const fetchDefinitions = async () => {
            try {
                const res = await api.get('/admin/npc-definitions');
                setDefinitions(res.data);
                if (res.data.length > 0) {
                    handleSelectNPC(res.data[0]);
                }
            } catch (err) {
                console.error("Error fetching definitions:", err);
            }
        };
        fetchDefinitions();
    }, []);

    const generateSystemPrompt = (npc, mission, met, info, tips, diffs) => {
        return `${t('admin.ai_tester.prompt_base', { name: npc?.name || 'an NPC' })}

CONTEXT:
- Mission Knowledge: ${mission}
- Condition Met? (Items/Enemies): ${met}
- Condition Info: ${info}
- PRONUNCIATION ANALYSIS:
  * Tips: ${tips}
  * Errors: ${diffs}

BEHAVIOR RULES:
1. Stay in character. Use English only.
2. If Condition Met is true, you MUST acknowledge it and complete your task if they give/tell you what you needed.
3. If Condition Met is false, gently explain what is missing if they claim they are done.
4. Use the Pronunciation Analysis to give helpful, pedagogical feedback. If they made specific mistakes, point them out kindly.
5. RESPOND ONLY IN JSON.

JSON FORMAT:
{
  "npcResponse": "string",
  "npcState": "talking|happy|thinking|grateful|waiting",
  "pronunciationEval": "excellent|good|needs_work|bad",
  "pronunciationMessage": "string",
  "feedbackSuggestion": "string",
  "taskCompleted": boolean,
  "taskProgress": "string"
}`;
    };

    const handleSelectNPC = (npc) => {
        setSelectedNPC(npc);
        setSystemPrompt(generateSystemPrompt(npc, missionContext, conditionMet, conditionInfo, pronTips, pronDiffs));
    };

    const updatePrompt = (field, value) => {
        let newMission = missionContext;
        let newMet = conditionMet;
        let newInfo = conditionInfo;
        let newTips = pronTips;
        let newDiffs = pronDiffs;

        if (field === 'mission') { newMission = value; setMissionContext(value); }
        if (field === 'met') { newMet = value; setConditionMet(value); }
        if (field === 'info') { newInfo = value; setConditionInfo(value); }
        if (field === 'tips') { newTips = value; setPronTips(value); }
        if (field === 'diffs') { newDiffs = value; setPronDiffs(value); }

        setSystemPrompt(generateSystemPrompt(selectedNPC, newMission, newMet, newInfo, newTips, newDiffs));
    };

    const handleSend = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.post('/admin/ai-test', {
                system_prompt: systemPrompt,
                user_prompt: userPrompt
            });
            setResponse(res.data.response);
        } catch (err) {
            setError(err.response?.data?.error || t('admin.ai_tester.error_api'));
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (!response) return;
        navigator.clipboard.writeText(response);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setIsAnalyzing(true);
                try {
                    const result = await analyzeAudio(audioBlob, "00000000-0000-0000-0000-000000000000");
                    setUserPrompt(result.transcription);
                    
                    setPronTips(result.feedback.tips.join('. '));
                    const diffs = result.feedback.word_differences?.map(d => `Expected "${d.expected}", heard "${d.heard}"`).join('; ') || 'None';
                    setPronDiffs(diffs);
                    
                    setSystemPrompt(generateSystemPrompt(selectedNPC, missionContext, conditionMet, conditionInfo, result.feedback.tips.join('. '), diffs));
                    
                } catch (err) {
                    console.error("Audio analysis failed:", err);
                    setError(t('admin.ai_tester.error_voice'));
                } finally {
                    setIsAnalyzing(false);
                }
            };

            recorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Microphone access denied:", err);
            setError(t('admin.ai_tester.error_mic'));
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <Brain size={28} className="text-blue-400" />
                    <div>
                        <h1 className="text-2xl font-bold text-white">{t('admin.ai_tester.title')}</h1>
                        <p className="text-gray-400 text-sm">{t('admin.ai_tester.subtitle')}</p>
                    </div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-full flex items-center gap-2">
                    <Sparkles size={16} className="text-blue-400" />
                    <span className="text-xs font-bold text-blue-400">{t('admin.ai_tester.connected')}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4 shadow-lg">
                        <div className="flex items-center gap-2 text-blue-400 mb-2">
                            <Users size={18} />
                            <h2 className="text-sm font-bold uppercase tracking-wider">{t('admin.ai_tester.npc_identity')}</h2>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('admin.ai_tester.select_base')}</label>
                            <select 
                                onChange={(e) => handleSelectNPC(definitions.find(d => d.id === parseInt(e.target.value)))}
                                value={selectedNPC?.id || ''}
                                className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                            >
                                {definitions.map(def => (
                                    <option key={def.id} value={def.id}>{def.name} ({def.type})</option>
                                ))}
                            </select>
                        </div>

                        <div className="pt-4 border-t border-gray-800">
                            <div className="flex items-center gap-2 text-purple-400 mb-4">
                                <Shield size={18} />
                                <h2 className="text-sm font-bold uppercase tracking-wider">{t('admin.ai_tester.mission_sim')}</h2>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t('admin.ai_tester.input_label')}</label>
                                    <button 
                                        onClick={isRecording ? stopRecording : startRecording}
                                        disabled={isAnalyzing}
                                        className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                                            isRecording 
                                                ? 'bg-red-500 text-white animate-pulse' 
                                                : isAnalyzing 
                                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                                    : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                                        }`}
                                    >
                                        {isRecording ? <MicOff size={12} /> : <Mic size={12} />}
                                        {isRecording ? t('admin.ai_tester.stop_recording') : isAnalyzing ? t('admin.ai_tester.analyzing') : t('admin.ai_tester.record_voice')}
                                    </button>
                                </div>
                                <div className="relative">
                                    <textarea 
                                        value={userPrompt} 
                                        onChange={(e) => setUserPrompt(e.target.value)}
                                        rows={3} 
                                        className="w-full bg-gray-950 border border-gray-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-blue-500 outline-none resize-none" 
                                        placeholder={isAnalyzing ? t('admin.ai_tester.transcribing') : t('admin.ai_tester.input_placeholder')}
                                    />
                                    {isAnalyzing && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px] rounded-xl">
                                            <Loader2 size={24} className="text-blue-400 animate-spin" />
                                        </div>
                                    )}
                                </div>
                            </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('admin.ai_tester.objective')}</label>
                                    <textarea 
                                        value={missionContext}
                                        onChange={(e) => updatePrompt('mission', e.target.value)}
                                        className="w-full h-20 bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-300 focus:outline-none focus:border-purple-500 resize-none"
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-gray-400">{t('admin.ai_tester.condition_met')}</label>
                                    <button 
                                        onClick={() => updatePrompt('met', !conditionMet)}
                                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition-colors ${
                                            conditionMet ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-800 text-gray-500 border border-gray-700'
                                        }`}
                                    >
                                        {conditionMet ? t('admin.ai_tester.met') : t('admin.ai_tester.pending')}
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('admin.ai_tester.condition_detail')}</label>
                                    <input 
                                        type="text"
                                        value={conditionInfo}
                                        onChange={(e) => updatePrompt('info', e.target.value)}
                                        className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-300 focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-800">
                            <div className="flex items-center gap-2 text-orange-400 mb-4">
                                <Sparkles size={18} />
                                <h2 className="text-sm font-bold uppercase tracking-wider">{t('admin.ai_tester.pronunciation_sim')}</h2>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('admin.ai_tester.pron_tips')}</label>
                                    <input 
                                        type="text"
                                        value={pronTips}
                                        onChange={(e) => updatePrompt('tips', e.target.value)}
                                        className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-orange-200 focus:outline-none focus:border-orange-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('admin.ai_tester.pron_errors')}</label>
                                    <textarea 
                                        value={pronDiffs}
                                        onChange={(e) => updatePrompt('diffs', e.target.value)}
                                        className="w-full h-16 bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-orange-200 focus:outline-none focus:border-orange-500 resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4 shadow-lg">
                            <div className="flex items-center gap-2 text-blue-400 mb-2">
                                <Settings size={18} />
                                <h2 className="text-sm font-bold uppercase tracking-wider">{t('admin.ai_tester.resultant_prompt')}</h2>
                            </div>
                            <textarea 
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                                className="w-full h-80 bg-gray-950 border border-gray-800 rounded-lg p-4 text-[10px] font-mono text-blue-300 focus:outline-none focus:border-blue-500/50 resize-none"
                            />
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 shadow-lg flex-1 flex flex-col">
                                <div className="flex items-center gap-2 text-green-400 mb-4">
                                    <MessageSquare size={18} />
                                    <h2 className="text-sm font-bold uppercase tracking-wider">{t('admin.ai_tester.chat_test')}</h2>
                                </div>
                                
                                <div className="flex-1 space-y-4 flex flex-col">
                                    <textarea 
                                        value={userPrompt}
                                        onChange={(e) => setUserPrompt(e.target.value)}
                                        className="flex-1 bg-gray-950 border border-gray-800 rounded-lg p-4 text-xs font-mono text-green-300 focus:outline-none focus:border-green-500/50 resize-none"
                                        placeholder={t('admin.ai_tester.player_input_placeholder')}
                                    />

                                    <button 
                                        onClick={handleSend}
                                        disabled={loading || !systemPrompt || !userPrompt}
                                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all shadow-xl ${
                                            loading 
                                            ? 'bg-gray-800 text-gray-500' 
                                            : 'bg-blue-600 hover:bg-blue-500 text-white hover:scale-[1.02]'
                                        }`}
                                    >
                                        {loading ? (
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        ) : (
                                            <>
                                                <Send size={18} />
                                                {t('admin.ai_tester.test_button')}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Results Raw Section */}
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-yellow-400">
                                <Sparkles size={18} />
                                <h2 className="text-sm font-bold uppercase tracking-wider">{t('admin.ai_tester.raw_response')}</h2>
                            </div>
                            {response && (
                                <button onClick={copyToClipboard} className="p-2 text-gray-400 hover:text-white transition-colors">
                                    {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                                </button>
                            )}
                        </div>
                        <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 font-mono text-[10px] overflow-auto max-h-48">
                            {response ? (
                                <pre className="text-green-400 whitespace-pre-wrap">{response}</pre>
                            ) : (
                                <p className="text-gray-600 text-center py-4">{t('admin.ai_tester.no_response')}</p>
                            )}
                        </div>
                        {error && (
                            <div className="mt-4 bg-red-900/20 border border-red-900/50 text-red-400 p-3 rounded-lg text-xs flex items-center gap-2">
                                <AlertCircle size={14} /> {error}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
