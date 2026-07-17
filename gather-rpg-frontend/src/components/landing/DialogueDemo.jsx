import { useEffect, useRef, useState } from 'react';
import { Mic, AlertCircle, Sparkles, Gamepad2, RotateCcw } from 'lucide-react';

// Coaches disponibles en el demo. Son los mismos templates de NPC del juego
// (/npcs/{id}a.png), pero esta lista vive solo en la landing: cambiarla no
// afecta al juego. Cualquier id 1-15 sirve; todos los atlas comparten los
// frames portrait-idle / portrait-talking / portrait-happy.
const DEMO_COACHES = [
    { id: '1', name: 'Maya' },
    { id: '3', name: 'Connor' },
    { id: '5', name: 'Will' },
    { id: '14', name: 'Toby' },
];

// Guion de la conversación simulada. Los mensajes del NPC se "escriben" con
// efecto typewriter; los del jugador aparecen tras una fase de "grabación" con
// el mic pulsando, imitando el flujo real de voz del juego.
const SCRIPT = [
    {
        from: 'npc',
        state: 'portrait-talking',
        text: "Hi! I'm {name}, your English coach. Today's quest: order food at the tavern. Ready?",
        translation: '¡Hola! Soy {name}, tu coach de inglés. Misión de hoy: pedir comida en la taberna. ¿Listo?',
    },
    {
        from: 'player',
        text: 'Could I see the menu, please?',
    },
    {
        from: 'npc',
        state: 'portrait-happy',
        eval: 'Pronunciación 92%',
        text: 'Excellent! Now ask for the dish of the day.',
        translation: '¡Excelente! Ahora pide el plato del día.',
    },
    {
        from: 'player',
        text: "I'd like the dish of the day, please.",
    },
    {
        from: 'npc',
        state: 'portrait-happy',
        eval: '¡Perfecto! +25 XP',
        text: 'Quest complete! You earned 25 XP and 10 gold. See you tomorrow!',
        translation: '¡Misión completada! Ganaste 25 XP y 10 de oro. ¡Hasta mañana!',
    },
];

const TYPE_SPEED_MS = 28;
const NPC_PAUSE_MS = 1500;
const RECORDING_MS = 1400;
const PLAYER_PAUSE_MS = 900;
const LOOP_PAUSE_MS = 7000;

const withName = (text, name) => text.replaceAll('{name}', name);

// Retrato del NPC recortado del atlas /npcs/{id}a.png, igual que NPCPortrait
// del juego pero sin depender de NPC_CONFIG: los frames del atlas ya se llaman
// portrait-idle / portrait-talking / portrait-happy.
const DemoPortrait = ({ npcId, state, size = 132, className = '' }) => {
    const [atlas, setAtlas] = useState(null);

    useEffect(() => {
        let active = true;
        setAtlas(null);
        fetch(`/npcs/${npcId}a.json`)
            .then((res) => res.json())
            .then((data) => { if (active) setAtlas(data); })
            .catch(() => {});
        return () => { active = false; };
    }, [npcId]);

    const frame = atlas?.frames.find((f) => f.filename === state)?.frame
        || atlas?.frames.find((f) => f.filename === 'portrait-idle')?.frame;

    if (!frame) {
        return <div style={{ width: size, height: size }} className={`bg-gray-900/40 animate-pulse ${className}`} />;
    }

    const scale = size / frame.h;
    return (
        <div
            className={`pixelated shrink-0 ${className}`}
            style={{
                width: frame.w * scale,
                height: size,
                backgroundImage: `url(/npcs/${npcId}a.png)`,
                backgroundPosition: `-${frame.x * scale}px -${frame.y * scale}px`,
                backgroundSize: `${atlas.meta.size.w * scale}px ${atlas.meta.size.h * scale}px`,
                backgroundRepeat: 'no-repeat',
            }}
        />
    );
};

export const DialogueDemo = ({ coaches = DEMO_COACHES, onPlay }) => {
    const containerRef = useRef(null);
    const chatRef = useRef(null);
    const [coach, setCoach] = useState(coaches[0]);
    const [running, setRunning] = useState(false);
    const [stepIdx, setStepIdx] = useState(0);
    const [messages, setMessages] = useState([]);
    const [typed, setTyped] = useState('');
    const [recording, setRecording] = useState(false);
    const [npcState, setNpcState] = useState('portrait-idle');

    const finished = stepIdx >= SCRIPT.length;

    const restart = (nextCoach = coach) => {
        setCoach(nextCoach);
        setMessages([]);
        setTyped('');
        setRecording(false);
        setNpcState('portrait-idle');
        setStepIdx(0);
    };

    // Arranca la simulación solo cuando el bloque entra en pantalla.
    useEffect(() => {
        const el = containerRef.current;
        if (!el || running) return;
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setRunning(true); },
            { threshold: 0.35 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [running]);

    // Máquina de estados de la conversación: un efecto por paso del guion.
    // coach.id está en las deps para que cambiar de coach limpie los timers
    // en vuelo y reinicie el paso actual desde cero.
    useEffect(() => {
        if (!running) return;

        const timers = [];
        const after = (ms, fn) => timers.push(setTimeout(fn, ms));

        if (stepIdx >= SCRIPT.length) {
            after(LOOP_PAUSE_MS, () => restart());
            return () => timers.forEach(clearTimeout);
        }

        const step = SCRIPT[stepIdx];

        if (step.from === 'npc') {
            setNpcState(step.state || 'portrait-talking');
            const fullText = withName(step.text, coach.name);
            let i = 0;
            const interval = setInterval(() => {
                i += 1;
                setTyped(fullText.slice(0, i));
                if (i >= fullText.length) {
                    clearInterval(interval);
                    setTyped('');
                    setMessages((prev) => [...prev, { ...step, text: fullText, translation: withName(step.translation || '', coach.name) }]);
                    after(NPC_PAUSE_MS, () => setStepIdx((s) => s + 1));
                }
            }, TYPE_SPEED_MS);
            return () => {
                clearInterval(interval);
                timers.forEach(clearTimeout);
            };
        }

        setRecording(true);
        after(RECORDING_MS, () => {
            setRecording(false);
            setMessages((prev) => [...prev, step]);
            after(PLAYER_PAUSE_MS, () => setStepIdx((s) => s + 1));
        });
        return () => {
            setRecording(false);
            timers.forEach(clearTimeout);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [running, stepIdx, coach.id]);

    // Mantiene la conversación pegada al último mensaje.
    useEffect(() => {
        const el = chatRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages, typed, recording, finished]);

    return (
        <div ref={containerRef} className="max-w-4xl mx-auto">
            {/* Selector de coach: cambia el template del NPC solo en la landing */}
            <div className="flex items-center justify-center gap-3 mb-5 flex-wrap">
                <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Elige a tu coach</span>
                <div className="flex items-center gap-2">
                    {coaches.map((c) => (
                        <button
                            key={c.id}
                            onClick={() => restart(c)}
                            title={c.name}
                            aria-label={`Hablar con ${c.name}`}
                            className={`p-1 rounded-xl border-2 transition-all cursor-pointer bg-gray-950/60 hover:scale-110 active:scale-95 ${
                                coach.id === c.id
                                    ? 'border-yellow-400 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                                    : 'border-white/10 hover:border-yellow-500/50 opacity-70 hover:opacity-100'
                            }`}
                        >
                            <DemoPortrait npcId={c.id} state="portrait-idle" size={44} />
                        </button>
                    ))}
                </div>
            </div>

            {/* Placa con el nombre del NPC, como en el juego */}
            <div className="relative inline-block ml-4 sm:ml-10 mb-[-6px] z-20">
                <div className="bg-[var(--color-orange-vibrant)] text-white px-5 py-2 border-4 border-[var(--color-gold)] shadow-[0_8px_16px_rgba(0,0,0,0.5)] relative">
                    <div className="absolute -left-2 -top-2 w-4 h-4 bg-[var(--color-gold)] rotate-45 border border-[var(--color-gold-dark)]"></div>
                    <div className="absolute -right-2 -top-2 w-4 h-4 bg-[var(--color-gold)] rotate-45 border border-[var(--color-gold-dark)]"></div>
                    <span className="block font-medieval text-base sm:text-xl tracking-widest uppercase drop-shadow-[2px_2px_0_rgba(0,0,0,0.5)]">
                        {coach.name} · Coach de IA
                    </span>
                </div>
            </div>

            {/* Pergamino de diálogo */}
            <div className="bg-[var(--color-parchment)] border-4 sm:border-8 border-double border-[var(--color-gold)] p-4 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative">
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-start">
                    <DemoPortrait npcId={coach.id} state={npcState} className="drop-shadow-[0_10px_20px_rgba(0,0,0,0.45)]" />

                    <div className="flex-1 w-full min-w-0">
                        <div ref={chatRef} className="h-64 overflow-y-auto pr-1 space-y-3 scroll-smooth">
                            {messages.map((msg, idx) => (
                                msg.from === 'npc' ? (
                                    <div key={idx} className="bg-white/70 border-l-4 border-[var(--color-gold-dark)] p-3 shadow-sm max-w-[92%]">
                                        {msg.eval && (
                                            <span className="inline-flex items-center gap-1.5 mb-1.5 px-2.5 py-1 bg-[var(--color-base-dark)] text-[var(--color-gold)] border border-[var(--color-gold)] text-[10px] font-medieval uppercase tracking-widest">
                                                <AlertCircle size={11} />
                                                {msg.eval}
                                            </span>
                                        )}
                                        <p className="font-serif text-[var(--color-base-dark)] text-sm sm:text-base leading-relaxed">{msg.text}</p>
                                        {msg.translation && (
                                            <p className="text-xs text-gray-500 italic mt-1">{msg.translation}</p>
                                        )}
                                    </div>
                                ) : (
                                    <div key={idx} className="flex justify-end">
                                        <div className="bg-[var(--color-accent-blue)] text-white p-3 shadow-md max-w-[85%] flex items-start gap-2">
                                            <Mic size={14} className="shrink-0 mt-0.5 text-cyan-300" />
                                            <p className="font-serif text-sm sm:text-base leading-relaxed">{msg.text}</p>
                                        </div>
                                    </div>
                                )
                            ))}

                            {typed && (
                                <div className="bg-white/70 border-l-4 border-[var(--color-gold-dark)] p-3 shadow-sm max-w-[92%]">
                                    <p className="font-serif text-[var(--color-base-dark)] text-sm sm:text-base leading-relaxed">
                                        {typed}
                                        <span className="animate-pulse">▌</span>
                                    </p>
                                </div>
                            )}

                            {recording && (
                                <div className="flex justify-end">
                                    <div className="bg-[var(--color-accent-blue)]/80 text-cyan-200 px-4 py-2.5 shadow-md flex items-center gap-2 text-xs uppercase tracking-widest font-bold">
                                        <Mic size={14} className="animate-pulse text-red-400" />
                                        <span>Hablando en inglés…</span>
                                        <span className="flex gap-1">
                                            <span className="w-1 h-3 bg-cyan-300 animate-pulse"></span>
                                            <span className="w-1 h-4 bg-cyan-300 animate-pulse [animation-delay:150ms]"></span>
                                            <span className="w-1 h-2 bg-cyan-300 animate-pulse [animation-delay:300ms]"></span>
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* CTA al terminar el guion, antes de reiniciar el bucle */}
                            {finished && (
                                <div className="flex flex-col items-center gap-3 py-3 text-center">
                                    <p className="font-medieval uppercase tracking-wider text-[var(--color-base-dark)] text-sm sm:text-base">
                                        ¿Listo para intentarlo de verdad?
                                    </p>
                                    <div className="flex items-center gap-3 flex-wrap justify-center">
                                        <button
                                            onClick={onPlay}
                                            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 text-black font-extrabold text-xs uppercase font-medieval tracking-widest border-2 border-yellow-700 shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                        >
                                            <Gamepad2 size={14} />
                                            <span>Jugar gratis</span>
                                        </button>
                                        <button
                                            onClick={() => restart()}
                                            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-[var(--color-base-dark)] transition-colors cursor-pointer"
                                        >
                                            <RotateCcw size={12} />
                                            <span>Ver de nuevo</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Barra de entrada: en el juego real aquí hablas; en la landing lleva al registro */}
                        <button
                            onClick={onPlay}
                            title="Jugar ahora"
                            className="mt-3 w-full flex items-center gap-2 bg-white/60 border-2 border-[var(--color-parchment-dark)] px-3 py-2.5 hover:bg-white/90 hover:border-[var(--color-gold-dark)] transition-all cursor-pointer text-left"
                        >
                            <span className={`p-1.5 rounded-full ${recording ? 'bg-red-500/20 text-red-500' : 'text-[var(--color-gold-dark)]'}`}>
                                <Mic size={16} className={recording ? 'animate-pulse' : ''} />
                            </span>
                            <span className="text-sm text-gray-500 italic font-serif select-none">
                                Pulsa el micrófono y responde en inglés…
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            <p className="flex items-center justify-center gap-1.5 text-xs text-gray-500 mt-4 text-center">
                <Sparkles size={12} className="text-amber-400" />
                <span>Demo simulada — dentro del juego la conversación usa tu voz real y se adapta a tu nivel.</span>
            </p>
        </div>
    );
};

export default DialogueDemo;
