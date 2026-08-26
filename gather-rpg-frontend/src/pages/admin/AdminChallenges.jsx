import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, Plus, Trash2, Edit2, Search, X, AlertCircle, Save, HelpCircle, Volume2, Globe, Sparkles, Tag, Check, Award } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import api from '../../services/api';

const CHALLENGE_TYPES = [
    { value: 'vocabulary', label: 'Vocabulario', icon: Brain },
    { value: 'grammar', label: 'Gramática', icon: Globe },
    { value: 'pronunciation', label: 'Pronunciación', icon: Volume2 },
    { value: 'listening', label: 'Comprensión Auditiva', icon: Volume2 }
];

const DIFFICULTY_LEVELS = [
    { value: 'beginner', label: 'Principiante', color: 'text-green-400 bg-green-500/10 border-green-500/20' },
    { value: 'intermediate', label: 'Intermedio', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
    { value: 'advanced', label: 'Avanzado', color: 'text-red-400 bg-red-500/10 border-red-500/20' }
];

const ChallengeCard = ({ challenge, onEdit, onDelete, selected, onToggleSelect, examWorlds = [] }) => {
    const TypeIcon = CHALLENGE_TYPES.find(t => t.value === challenge.type)?.icon || HelpCircle;
    const difficultyInfo = DIFFICULTY_LEVELS.find(d => d.value === challenge.difficulty) || DIFFICULTY_LEVELS[0];

    return (
        <div className={`bg-gray-800 border rounded-xl p-5 transition-all group flex flex-col justify-between h-full ${
            selected ? 'border-yellow-500 ring-2 ring-yellow-500/30' : 'border-gray-700 hover:border-yellow-500/50'
        }`}>
            <div>
                <div className="flex justify-between items-start gap-2 mb-3">
                    <div className="flex items-center gap-2">
                        {onToggleSelect && (
                            <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => onToggleSelect(challenge.id)}
                                className="w-4 h-4 accent-yellow-500 cursor-pointer"
                                title="Seleccionar para acciones masivas"
                            />
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${difficultyInfo.color} uppercase tracking-wider`}>
                            {difficultyInfo.label}
                        </span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onEdit(challenge)} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded">
                            <Edit2 size={14} />
                        </button>
                        <button onClick={() => onDelete(challenge.id)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded">
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-yellow-500/10 rounded-lg text-yellow-400">
                        <TypeIcon size={16} />
                    </div>
                    <span className="text-xs text-gray-400 uppercase tracking-widest font-semibold">
                        {CHALLENGE_TYPES.find(t => t.value === challenge.type)?.label || challenge.type}
                    </span>
                </div>

                <div className="text-white font-bold text-sm mb-2 line-clamp-3">
                    <ReactMarkdown className="prose prose-invert prose-sm max-w-none prose-p:my-0">{challenge.question}</ReactMarkdown>
                </div>
                {challenge.question_es && (
                    <p className="text-xs text-gray-500 italic mb-3 line-clamp-2">
                        {challenge.question_es}
                    </p>
                )}

                {/* Options List */}
                <div className="space-y-1.5 mb-4">
                    {[challenge.option_1, challenge.option_2, challenge.option_3].map((opt, i) => {
                        const optIndex = i + 1;
                        const isCorrect = challenge.correct_option === optIndex;
                        if (!opt && challenge.type === 'pronunciation') return null; // pronunciation cards might not have option 2 & 3
                        return (
                            <div 
                                key={optIndex} 
                                className={`text-xs px-2.5 py-1.5 rounded-lg flex items-center justify-between ${
                                    isCorrect 
                                    ? 'bg-green-500/10 border border-green-500/20 text-green-400 font-medium' 
                                    : 'bg-gray-900/40 border border-transparent text-gray-400'
                                }`}
                            >
                                <span className="truncate pr-2">{opt || `Opción ${optIndex}`}</span>
                                {isCorrect && <Check size={12} />}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="border-t border-gray-700/50 pt-3 mt-auto">
                {/* Pertenencia al examen de un mundo: es lo que decide si esta
                    pregunta puede salir en su mapa final. */}
                {examWorlds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                        {examWorlds.map(w => (
                            <span key={w.id} className="text-[9px] bg-purple-500/15 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/40 flex items-center gap-0.5 font-bold uppercase tracking-wider">
                                <Award size={8} /> Examen: {w.name}
                            </span>
                        ))}
                    </div>
                )}
                {challenge.tags && challenge.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                        {challenge.tags.map(tag => (
                            <span key={tag} className="text-[9px] bg-gray-900 text-gray-400 px-1.5 py-0.5 rounded border border-gray-800 flex items-center gap-0.5 font-medium">
                                <Tag size={8} /> {tag}
                            </span>
                        ))}
                    </div>
                )}
                {challenge.explanation_es && (
                    <p className="text-[10px] text-gray-500 line-clamp-2">
                        <span className="font-bold text-gray-400">Explicación: </span>
                        {challenge.explanation_es}
                    </p>
                )}
            </div>
        </div>
    );
};

export const AdminChallenges = () => {
    const { t } = useTranslation();
    const [challenges, setChallenges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [selectedType, setSelectedType] = useState('all');
    const [selectedDifficulty, setSelectedDifficulty] = useState('all');
    const [selectedTag, setSelectedTag] = useState('all');
    // ── Paginación ───────────────────────────────────────────────────────────
    // Con 600+ retos, pintar todas las cards de golpe en el DOM es lo que hace
    // la pantalla pesada. Se pagina en el cliente (los datos ya llegan todos del
    // backend) para no tener que tocar /admin/challenges.
    const PAGE_SIZE = 24;
    const [currentPage, setCurrentPage] = useState(1);
    // ── Mundos ───────────────────────────────────────────────────────────────
    // Un reto "pertenece" al examen de un mundo si lleva su exam_tag. Los tags
    // temáticos del mundo (food, animals…) son transversales: los comparten
    // varios mundos, así que se tratan como tags sueltos, nunca como bloque.
    const [worlds, setWorlds] = useState([]);
    const [selectedWorld, setSelectedWorld] = useState('all'); // 'all' | 'none' | id
    const [selectedIds, setSelectedIds] = useState([]);        // selección para acciones masivas
    const [bulkWorldId, setBulkWorldId] = useState('');
    const [bulkBusy, setBulkBusy] = useState(false);
    const [bulkMsg, setBulkMsg] = useState(null);
    const [modalWorldId, setModalWorldId] = useState('');      // mundo elegido dentro del modal
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingChallenge, setEditingChallenge] = useState(null);
    const [formData, setFormData] = useState({
        type: 'vocabulary',
        question: '',
        option_1: '',
        option_2: '',
        option_3: '',
        correct_option: 1,
        explanation_es: '',
        question_es: '',
        tags: '',
        difficulty: 'beginner',
        language_learning: 'english',
        phonetic: '',
        requires_audio: false,
        audio_url: ''
    });

    const [importOpen, setImportOpen] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importReport, setImportReport] = useState(null);
    const [importError, setImportError] = useState(null);

    const handleDownloadCSVTemplate = () => {
        const csvContent = 
            "type,question,question_es,option_1,option_2,option_3,correct_option,explanation_es,tags,difficulty,phonetic,requires_audio,audio_url\n" +
            "vocabulary,gato,¿Cuál es la traducción de 'gato'?,cat,dog,bird,1,\"'Cat' significa gato en inglés.\",\"vocabulary,animals,beginner\",beginner,/kæt/,false,\n" +
            "grammar,She ___ to the cinema yesterday.,Ella ___ al cine ayer.,went,goes,go,1,\"El verbo 'go' en pasado simple es 'went'.\",\"grammar,past-simple,intermediate\",intermediate,,false,\n" +
            "pronunciation,squirrel,Pronuncia la palabra: 'squirrel',squirrel,,,1,\"La pronunciación de 'squirrel' suele ser difícil para hispanohablantes.\",\"pronunciation,phonetics,advanced\",advanced,/ˈskwɪrəl/,false,\n" +
            "listening,select the word that corresponds to the sound,Selecciona la palabra que corresponde al sonido.,water,waiter,winter,1,\"El audio pronuncia la palabra 'water'.\",\"listening,sounds,intermediate\",intermediate,,true,/audio/challenges/water.mp3";
            
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "plantilla_desafios_cards.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadJSONTemplate = () => {
        const jsonData = [
          {
            "type": "vocabulary",
            "question": "apple",
            "question_es": "¿Cuál es la traducción de 'apple'?",
            "option_1": "manzana",
            "option_2": "plátano",
            "option_3": "naranja",
            "correct_option": 1,
            "explanation_es": "'Apple' significa manzana.",
            "tags": ["vocabulary", "fruits", "beginner"],
            "difficulty": "beginner",
            "phonetic": "/ˈæp.əl/",
            "requires_audio": false
          },
          {
            "type": "grammar",
            "question": "They ___ soccer at the moment.",
            "question_es": "Ellos ___ fútbol en este momento.",
            "option_1": "are playing",
            "option_2": "play",
            "option_3": "is playing",
            "correct_option": 1,
            "explanation_es": "Para present continuous con 'they' se usa 'are playing'.",
            "tags": ["grammar", "present-continuous", "intermediate"],
            "difficulty": "intermediate",
            "requires_audio": false
          },
          {
            "type": "pronunciation",
            "question": "hello",
            "question_es": "Pronuncia la palabra: 'hello'",
            "option_1": "hello",
            "correct_option": 1,
            "explanation_es": "La palabra es 'hello'.",
            "tags": ["pronunciation", "basics", "beginner"],
            "difficulty": "beginner",
            "phonetic": "/həˈloʊ/",
            "requires_audio": false
          },
          {
            "type": "listening",
            "question": "Identify the word from the audio.",
            "question_es": "Identifica la palabra del audio.",
            "option_1": "house",
            "option_2": "mouse",
            "option_3": "mouth",
            "correct_option": 1,
            "explanation_es": "El audio dice 'house'.",
            "tags": ["listening", "minimal-pairs", "advanced"],
            "difficulty": "advanced",
            "requires_audio": true,
            "audio_url": "/audio/challenges/house.mp3"
          }
        ];

        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "plantilla_desafios_cards.json");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportSubmit = async () => {
        if (!importFile) return;
        setImporting(true);
        setImportReport(null);
        setImportError(null);

        const formDataPayload = new FormData();
        formDataPayload.append('file', importFile);

        try {
            const res = await api.post('/admin/challenges/import', formDataPayload, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            setImportReport(res.data);
            setImportFile(null);
            fetchData();
        } catch (err) {
            setImportError(err.response?.data?.error || 'Error al importar los desafíos');
        } finally {
            setImporting(false);
        }
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/challenges');
            setChallenges(res.data || []);
            setError(null);
        } catch (err) {
            setError('Error al cargar los desafíos');
        } finally {
            setLoading(false);
        }
    };

    // Mundos: alimentan el selector de tags del modal, el filtro de la lista y las
    // acciones masivas. Un fallo aquí no rompe la pantalla — solo se queda sin la
    // ayuda de mundos y se sigue etiquetando a mano.
    const fetchWorlds = async () => {
        try {
            const res = await api.get('/admin/worlds');
            setWorlds(res.data || []);
        } catch {
            setWorlds([]);
        }
    };

    useEffect(() => {
        fetchData();
        fetchWorlds();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Format tags back into string slice
        const tagsArray = formData.tags
            .split(',')
            .map(tag => tag.trim().toLowerCase())
            .filter(Boolean);

        const payload = {
            ...formData,
            correct_option: parseInt(formData.correct_option),
            tags: tagsArray,
            requires_audio: formData.requires_audio === 'true' || formData.requires_audio === true
        };

        try {
            if (editingChallenge) {
                await api.put(`/admin/challenges/${editingChallenge.id}`, payload);
            } else {
                await api.post('/admin/challenges', payload);
            }
            setIsModalOpen(false);
            setEditingChallenge(null);
            fetchData();
        } catch (err) {
            setError('Error al guardar el desafío');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Seguro que deseas eliminar esta card?')) return;
        try {
            await api.delete(`/admin/challenges/${id}`);
            fetchData();
        } catch (err) {
            setError('Error al eliminar el desafío');
        }
    };

    const openCreateModal = () => {
        setEditingChallenge(null);
        setFormData({
            type: 'vocabulary',
            question: '',
            option_1: '',
            option_2: '',
            option_3: '',
            correct_option: 1,
            explanation_es: '',
            question_es: '',
            tags: 'vocabulary',
            difficulty: 'beginner',
            language_learning: 'english',
            phonetic: '',
            requires_audio: false,
            audio_url: ''
        });
        setIsModalOpen(true);
    };

    const openEditModal = (challenge) => {
        setEditingChallenge(challenge);
        setFormData({
            type: challenge.type,
            question: challenge.question,
            option_1: challenge.option_1,
            option_2: challenge.option_2,
            option_3: challenge.option_3,
            correct_option: challenge.correct_option,
            explanation_es: challenge.explanation_es || '',
            question_es: challenge.question_es || '',
            tags: challenge.tags ? challenge.tags.join(', ') : '',
            difficulty: challenge.difficulty || 'beginner',
            language_learning: challenge.language_learning || 'english',
            phonetic: challenge.phonetic || '',
            requires_audio: challenge.requires_audio || false,
            audio_url: challenge.audio_url || ''
        });
        setIsModalOpen(true);
    };

    // ── Helpers de mundos ────────────────────────────────────────────────────

    /** Mundos a cuyo EXAMEN pertenece un reto (lleva su exam_tag). */
    const worldsOfChallenge = (c) => {
        const tags = c.tags || [];
        return worlds.filter(w => w.exam_tag && tags.includes(w.exam_tag));
    };

    /** Tags que un mundo puede aportar: el de examen + los temáticos, por separado. */
    const worldTagOptions = (world) => {
        if (!world) return [];
        const out = [];
        if (world.exam_tag) out.push({ tag: world.exam_tag, exam: true });
        (world.challenge_tags || []).forEach(t => out.push({ tag: t, exam: false }));
        return out;
    };

    const parseTags = (str) => str.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

    /** Activa/desactiva UN tag en el campo de texto del modal. */
    const toggleFormTag = (tag) => {
        const current = parseTags(formData.tags);
        const next = current.includes(tag)
            ? current.filter(t => t !== tag)
            : [...current, tag];
        setFormData({ ...formData, tags: next.join(', ') });
    };

    // Catálogo de tags para el filtro: se deriva de los retos ya cargados, no
    // hay endpoint aparte. Con 90+ tags un <select> nativo (buscable con teclado)
    // es más práctico que chips.
    const allTags = [...new Set(challenges.flatMap(c => c.tags || []))].sort();

    const filteredChallenges = challenges.filter(c => {
        const q = search.toLowerCase();
        const matchesSearch = q === '' ||
            c.question.toLowerCase().includes(q) ||
            (c.question_es && c.question_es.toLowerCase().includes(q)) ||
            (c.explanation_es && c.explanation_es.toLowerCase().includes(q)) ||
            (c.tags || []).some(tag => tag.toLowerCase().includes(q));

        const matchesType = selectedType === 'all' || c.type === selectedType;
        const matchesDifficulty = selectedDifficulty === 'all' || c.difficulty === selectedDifficulty;
        const matchesTag = selectedTag === 'all' || (c.tags || []).includes(selectedTag);

        // Filtro por mundo: 'none' = retos que no están en el examen de ningún mundo.
        let matchesWorld = true;
        if (selectedWorld === 'none') {
            matchesWorld = worldsOfChallenge(c).length === 0;
        } else if (selectedWorld !== 'all') {
            const w = worlds.find(x => String(x.id) === String(selectedWorld));
            matchesWorld = !!w && !!w.exam_tag && (c.tags || []).includes(w.exam_tag);
        }

        return matchesSearch && matchesType && matchesDifficulty && matchesTag && matchesWorld;
    });

    // Volver a la página 1 cada vez que cambia algún filtro — si no, se puede
    // quedar viendo una página vacía tras acotar los resultados.
    useEffect(() => {
        setCurrentPage(1);
    }, [search, selectedType, selectedDifficulty, selectedTag, selectedWorld]);

    const pageCount = Math.max(1, Math.ceil(filteredChallenges.length / PAGE_SIZE));
    const safePage = Math.min(currentPage, pageCount);
    const pagedChallenges = filteredChallenges.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    // ── Acciones masivas ─────────────────────────────────────────────────────

    const allVisibleSelected = filteredChallenges.length > 0
        && filteredChallenges.every(c => selectedIds.includes(c.id));

    const toggleSelectAllVisible = () => {
        if (allVisibleSelected) {
            const visible = new Set(filteredChallenges.map(c => c.id));
            setSelectedIds(prev => prev.filter(id => !visible.has(id)));
        } else {
            setSelectedIds(prev => [...new Set([...prev, ...filteredChallenges.map(c => c.id)])]);
        }
    };

    const toggleSelectOne = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    /**
     * Añade o quita el tag de examen de un mundo a todos los retos seleccionados,
     * en una sola llamada atómica. Al terminar refresca los mundos para que el
     * conteo del pool (pool_health) refleje el cambio inmediatamente.
     */
    const handleBulkExamTag = async (mode) => {
        const world = worlds.find(w => String(w.id) === String(bulkWorldId));
        if (!world || !world.exam_tag) {
            setBulkMsg({ type: 'error', text: 'Ese mundo no tiene tag de examen configurado.' });
            return;
        }
        setBulkBusy(true);
        setBulkMsg(null);
        try {
            const res = await api.post('/admin/challenges/bulk-tags', {
                ids: selectedIds,
                add_tags: mode === 'add' ? [world.exam_tag] : [],
                remove_tags: mode === 'remove' ? [world.exam_tag] : [],
            });
            await fetchData();
            await fetchWorlds();
            const updated = res.data?.updated ?? selectedIds.length;
            setBulkMsg({
                type: 'success',
                text: mode === 'add'
                    ? `${updated} retos añadidos al examen de "${world.name}".`
                    : `${updated} retos quitados del examen de "${world.name}".`,
            });
            setSelectedIds([]);
        } catch (err) {
            setBulkMsg({ type: 'error', text: err.response?.data?.error || 'Error al etiquetar' });
        } finally {
            setBulkBusy(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-yellow-500/10 p-2 rounded-lg">
                        <Brain size={28} className="text-yellow-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Desafíos y Cards de Inglés</h1>
                        <p className="text-gray-400 text-sm">Gestiona las tarjetas de aprendizaje del sistema y las batallas de cartas ninja.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setImportOpen(!importOpen)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all border whitespace-nowrap text-sm ${
                            importOpen
                            ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                            : 'bg-gray-800 hover:bg-gray-700 text-white border-gray-700'
                        }`}
                    >
                        <Sparkles size={16} className={importOpen ? 'text-yellow-400 animate-pulse' : 'text-gray-400'} />
                        Importación Masiva
                    </button>
                    <button 
                        onClick={openCreateModal}
                        className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-lg font-bold transition-all shadow-lg whitespace-nowrap text-sm"
                    >
                        <Plus size={20} />
                        Nuevo Desafío
                    </button>
                </div>
            </div>

            {/* Import Block Panel */}
            {importOpen && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4 animate-fadeIn">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Sparkles size={20} className="text-yellow-400" />
                                Importar Desafíos en Lote (CSV / JSON)
                            </h2>
                            <p className="text-gray-400 text-xs mt-1">
                                Sube un archivo en formato CSV o JSON que siga la estructura del sistema. Todos los desafíos válidos se añadirán o actualizarán (por ID).
                            </p>
                        </div>
                        <button onClick={() => setImportOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Download Templates Column */}
                        <div className="bg-gray-850 border border-gray-800/80 rounded-xl p-5 space-y-4 flex flex-col justify-between">
                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                    <HelpCircle size={16} className="text-yellow-500" />
                                    Descargar Plantillas de Ejemplo
                                </h3>
                                <p className="text-gray-400 text-xs leading-relaxed">
                                    Descarga los archivos de modelo preconfigurados con ejemplos de cada tipo de card (Vocabulario, Gramática, Pronunciación y Audición) para guiarte en el llenado de datos.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3 pt-2">
                                <button 
                                    onClick={handleDownloadCSVTemplate}
                                    className="flex items-center gap-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 px-3.5 py-2 rounded-lg text-xs font-bold transition-all"
                                >
                                    Descargar Plantilla CSV
                                </button>
                                <button 
                                    onClick={handleDownloadJSONTemplate}
                                    className="flex items-center gap-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 px-3.5 py-2 rounded-lg text-xs font-bold transition-all"
                                >
                                    Descargar Plantilla JSON
                                </button>
                            </div>
                        </div>

                        {/* Upload File Column */}
                        <div className="bg-gray-850 border border-gray-800/80 rounded-xl p-5 flex flex-col justify-between space-y-4">
                            <h3 className="text-sm font-semibold text-white">Subir Archivo</h3>
                            
                            <div className="flex items-center justify-center w-full">
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-700 hover:border-yellow-500/50 rounded-xl cursor-pointer bg-gray-900/40 hover:bg-gray-900/60 transition-all p-4">
                                    <div className="flex flex-col items-center justify-center text-center space-y-2">
                                        <Plus size={24} className="text-gray-500" />
                                        <span className="text-xs text-gray-300 font-semibold truncate max-w-xs">
                                            {importFile ? importFile.name : "Selecciona un archivo CSV o JSON"}
                                        </span>
                                        <span className="text-[10px] text-gray-500">Límite de tamaño: 50MB</span>
                                    </div>
                                    <input 
                                        type="file" 
                                        accept=".csv,.json"
                                        className="hidden"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files.length > 0) {
                                                setImportFile(e.target.files[0]);
                                                setImportReport(null);
                                                setImportError(null);
                                            }
                                        }}
                                    />
                                </label>
                            </div>

                            <button 
                                onClick={handleImportSubmit}
                                disabled={!importFile || importing}
                                className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-800 disabled:text-gray-600 disabled:border-gray-750 text-black py-2.5 rounded-lg text-xs font-bold transition-all shadow-md shadow-yellow-500/10 flex items-center justify-center gap-2"
                            >
                                {importing ? (
                                    <>
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-black"></div>
                                        Procesando Importación...
                                    </>
                                ) : (
                                    "Comenzar Importación"
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Import Status / Report Messages */}
                    {importError && (
                        <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-4 rounded-xl flex items-start gap-3">
                            <AlertCircle size={20} className="shrink-0 mt-0.5" />
                            <div className="text-xs">
                                <span className="font-bold">Error de Importación: </span>
                                {importError}
                            </div>
                        </div>
                    )}

                    {importReport && (
                        <div className={`p-4 rounded-xl border text-xs space-y-2 ${
                            importReport.success 
                            ? 'bg-green-900/10 border-green-500/20 text-green-400' 
                            : 'bg-yellow-900/10 border-yellow-500/20 text-yellow-400'
                        }`}>
                            <div className="flex items-center gap-2 font-bold text-sm">
                                {importReport.success ? <Check size={18} /> : <AlertCircle size={18} />}
                                <span>
                                    {importReport.success 
                                        ? "¡Importación completada con éxito!" 
                                        : "Importación completada con observaciones."}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-1 font-medium">
                                <div>Importados correctamente: <span className="font-bold text-white">{importReport.imported}</span></div>
                                <div>Fallidos/Omitidos: <span className="font-bold text-white">{importReport.failed}</span></div>
                            </div>
                            
                            {importReport.errors && importReport.errors.length > 0 && (
                                <div className="pt-2 border-t border-gray-800 space-y-1">
                                    <span className="font-bold uppercase tracking-wider text-[10px] text-gray-400 block mb-1">Detalle de Errores:</span>
                                    <div className="max-h-36 overflow-y-auto custom-scrollbar space-y-1.5 pr-2">
                                        {importReport.errors.map((err, i) => (
                                            <div key={i} className="bg-black/35 p-2 rounded border border-gray-850 text-[11px] leading-relaxed text-gray-300">
                                                {err.record && <span className="font-bold text-red-400">Registro #{err.record}: </span>}
                                                {err.question && <span className="font-bold text-yellow-400">Card '{err.question}': </span>}
                                                {err.error}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Filters */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input 
                        type="text"
                        placeholder="Buscar por pregunta, traducción o explicación..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-2 focus:ring-yellow-500/50 focus:outline-none w-full"
                    />
                </div>
                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    <select
                        value={selectedType}
                        onChange={e => setSelectedType(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none w-full md:w-44"
                    >
                        <option value="all">Todos los Tipos</option>
                        <option value="vocabulary">Vocabulario</option>
                        <option value="grammar">Gramática</option>
                        <option value="pronunciation">Pronunciación</option>
                        <option value="listening">Audición</option>
                    </select>

                    <select
                        value={selectedDifficulty}
                        onChange={e => setSelectedDifficulty(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none w-full md:w-44"
                    >
                        <option value="all">Todas las Dificultades</option>
                        <option value="beginner">Principiante</option>
                        <option value="intermediate">Intermedio</option>
                        <option value="advanced">Avanzado</option>
                    </select>

                    {allTags.length > 0 && (
                        <select
                            value={selectedTag}
                            onChange={e => setSelectedTag(e.target.value)}
                            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none w-full md:w-44"
                        >
                            <option value="all">Todos los Tags</option>
                            {allTags.map(tag => (
                                <option key={tag} value={tag}>{tag}</option>
                            ))}
                        </select>
                    )}

                    {/* Filtro por mundo: sirve para ver qué hay ya en un examen. */}
                    {worlds.length > 0 && (
                        <select
                            value={selectedWorld}
                            onChange={e => setSelectedWorld(e.target.value)}
                            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none w-full md:w-52"
                        >
                            <option value="all">Todos los Mundos</option>
                            <option value="none">Sin examen asignado</option>
                            {worlds.filter(w => w.exam_tag).map(w => (
                                <option key={w.id} value={w.id}>
                                    Examen: {w.name} ({w.pool_health?.exam_count ?? 0})
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* ── Acciones masivas ─────────────────────────────────────────────
                Etiquetar el pool de examen reto por reto es inviable (641 en la
                base): aquí se hace en una sola llamada atómica. */}
            {worlds.some(w => w.exam_tag) && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer shrink-0">
                        <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={toggleSelectAllVisible}
                            className="w-4 h-4 accent-yellow-500"
                        />
                        Seleccionar los {filteredChallenges.length} encontrados (todas las páginas)
                    </label>

                    <span className={`text-sm shrink-0 ${selectedIds.length ? 'text-yellow-400 font-bold' : 'text-gray-600'}`}>
                        {selectedIds.length} seleccionados
                    </span>

                    <div className="flex flex-wrap gap-2 items-center lg:ml-auto">
                        <select
                            value={bulkWorldId}
                            onChange={e => setBulkWorldId(e.target.value)}
                            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                        >
                            <option value="">Elige un mundo…</option>
                            {worlds.filter(w => w.exam_tag).map(w => (
                                <option key={w.id} value={w.id}>{w.name} → {w.exam_tag}</option>
                            ))}
                        </select>
                        <button
                            disabled={!selectedIds.length || !bulkWorldId || bulkBusy}
                            onClick={() => handleBulkExamTag('add')}
                            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-lg transition-all"
                        >
                            <Check size={15} /> Añadir al examen
                        </button>
                        <button
                            disabled={!selectedIds.length || !bulkWorldId || bulkBusy}
                            onClick={() => handleBulkExamTag('remove')}
                            className="flex items-center gap-1.5 bg-gray-800 hover:bg-red-600/40 border border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 text-sm px-4 py-2 rounded-lg transition-all"
                        >
                            <X size={15} /> Quitar
                        </button>
                        {selectedIds.length > 0 && (
                            <button onClick={() => setSelectedIds([])} className="text-xs text-gray-500 hover:text-gray-300 underline">
                                limpiar
                            </button>
                        )}
                    </div>

                    {bulkMsg && (
                        <div className={`text-sm w-full lg:w-auto ${bulkMsg.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {bulkMsg.text}
                        </div>
                    )}
                </div>
            )}

            {error && (
                <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-4 rounded-xl flex items-center gap-3 animate-shake">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
                </div>
            ) : (
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {pagedChallenges.map(challenge => (
                        <ChallengeCard
                            key={challenge.id}
                            challenge={challenge}
                            onEdit={openEditModal}
                            onDelete={handleDelete}
                            selected={selectedIds.includes(challenge.id)}
                            onToggleSelect={worlds.some(w => w.exam_tag) ? toggleSelectOne : null}
                            examWorlds={worldsOfChallenge(challenge)}
                        />
                    ))}
                    {filteredChallenges.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-500 bg-gray-800/20 rounded-2xl border-2 border-dashed border-gray-800">
                            <Brain className="mx-auto mb-3 opacity-20" size={48} />
                            <p>No se encontraron desafíos configurados.</p>
                        </div>
                    )}
                </div>

                {filteredChallenges.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                        <span className="text-xs text-gray-500">
                            Mostrando {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredChallenges.length)} de {filteredChallenges.length}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={safePage <= 1}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-800 border border-gray-700 text-gray-300 hover:border-yellow-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                Anterior
                            </button>
                            <span className="text-xs text-gray-400 px-2">
                                Página {safePage} de {pageCount}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))}
                                disabled={safePage >= pageCount}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-800 border border-gray-700 text-gray-300 hover:border-yellow-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
                </>
            )}

            {/* Form Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-zoomIn">
                        <div className="flex items-center justify-between p-6 border-b border-gray-800">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                {editingChallenge ? <Edit2 size={20} className="text-blue-400" /> : <Plus size={20} className="text-green-400" />}
                                {editingChallenge ? 'Editar Desafío' : 'Crear Nuevo Desafío'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Tipo de Desafío</label>
                                    <select 
                                        value={formData.type}
                                        onChange={e => {
                                            const newType = e.target.value;
                                            const reqAudio = newType === 'pronunciation' || newType === 'listening';
                                            setFormData({
                                                ...formData, 
                                                type: newType,
                                                requires_audio: reqAudio
                                            });
                                        }}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                                    >
                                        <option value="vocabulary">Vocabulario</option>
                                        <option value="grammar">Gramática</option>
                                        <option value="pronunciation">Pronunciación</option>
                                        <option value="listening">Comprensión Auditiva</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Dificultad</label>
                                    <select 
                                        value={formData.difficulty}
                                        onChange={e => setFormData({...formData, difficulty: e.target.value})}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                                    >
                                        <option value="beginner">Principiante (Beginner)</option>
                                        <option value="intermediate">Intermedio (Intermediate)</option>
                                        <option value="advanced">Avanzado (Advanced)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Pregunta / Texto en Inglés</label>
                                <textarea 
                                    rows="2" required
                                    value={formData.question}
                                    onChange={e => setFormData({...formData, question: e.target.value})}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none resize-none font-medium text-sm"
                                    placeholder="ej: What is the translation of 'gato'?"
                                />
                                {formData.question && (
                                    <div className="mt-2 p-3 bg-gray-900 rounded-lg border border-gray-750 text-sm text-gray-300">
                                        <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Vista Previa:</div>
                                        <ReactMarkdown className="prose prose-invert prose-sm max-w-none">{formData.question}</ReactMarkdown>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Traducción o Contexto en Español</label>
                                <textarea 
                                    rows="2"
                                    value={formData.question_es}
                                    onChange={e => setFormData({...formData, question_es: e.target.value})}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none resize-none text-sm"
                                    placeholder="ej: ¿Cuál es la traducción de 'gato'?"
                                />
                                {formData.question_es && (
                                    <div className="mt-2 p-3 bg-gray-900 rounded-lg border border-gray-750 text-sm text-gray-300">
                                        <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Vista Previa:</div>
                                        <ReactMarkdown className="prose prose-invert prose-sm max-w-none">{formData.question_es}</ReactMarkdown>
                                    </div>
                                )}
                            </div>

                            {/* Options section - Hide option 2/3 for pronunciation if not needed, but keep them for others */}
                            <div className="space-y-3 bg-gray-850 p-4 rounded-xl border border-gray-800">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Opciones de Respuesta</h3>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Opción 1 {formData.type === 'pronunciation' && '(Respuesta esperada)'}</label>
                                    <input 
                                        type="text" required
                                        value={formData.option_1}
                                        onChange={e => setFormData({...formData, option_1: e.target.value})}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                                        placeholder="Ej: Cat"
                                    />
                                </div>

                                {formData.type !== 'pronunciation' && (
                                    <>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Opción 2</label>
                                            <input 
                                                type="text" required
                                                value={formData.option_2}
                                                onChange={e => setFormData({...formData, option_2: e.target.value})}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                                                placeholder="Ej: Dog"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Opción 3</label>
                                            <input 
                                                type="text" required
                                                value={formData.option_3}
                                                onChange={e => setFormData({...formData, option_3: e.target.value})}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                                                placeholder="Ej: Bird"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Opción Correcta</label>
                                            <div className="flex gap-4">
                                                {[1, 2, 3].map(num => (
                                                    <label key={num} className="flex items-center gap-2 text-xs text-white cursor-pointer">
                                                        <input 
                                                            type="radio" 
                                                            name="correct_option"
                                                            value={num}
                                                            checked={parseInt(formData.correct_option) === num}
                                                            onChange={e => setFormData({...formData, correct_option: parseInt(e.target.value)})}
                                                            className="text-yellow-500 focus:ring-0"
                                                        />
                                                        Opción {num}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Fonética (Opcional)</label>
                                    <input 
                                        type="text"
                                        value={formData.phonetic}
                                        onChange={e => setFormData({...formData, phonetic: e.target.value})}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                                        placeholder="ej: /kæt/"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Tags (Separados por coma)</label>
                                    <input
                                        type="text"
                                        value={formData.tags}
                                        onChange={e => setFormData({...formData, tags: e.target.value})}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                                        placeholder="ej: vocabulary, animal, basic"
                                    />
                                </div>
                            </div>

                            {/* ── Tags desde un mundo ──────────────────────────────────
                                Evita tener que recordar el exam_tag exacto. Cada tag es
                                un botón independiente: el de examen (morado, exclusivo
                                del mundo) y los temáticos (compartidos entre mundos, por
                                eso se activan uno a uno y no en bloque). Todo lo que se
                                marca aquí se refleja en el campo de tags de arriba. */}
                            {worlds.length > 0 && (
                                <div className="bg-gray-850 p-4 rounded-xl border border-gray-800 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Globe size={14} className="text-emerald-400" />
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tags desde un mundo</label>
                                    </div>
                                    <select
                                        value={modalWorldId}
                                        onChange={e => setModalWorldId(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                                    >
                                        <option value="">Elige un mundo para ver sus tags…</option>
                                        {worlds.map(w => (
                                            <option key={w.id} value={w.id}>{w.name} ({w.difficulty})</option>
                                        ))}
                                    </select>

                                    {(() => {
                                        const w = worlds.find(x => String(x.id) === String(modalWorldId));
                                        const opts = worldTagOptions(w);
                                        const current = parseTags(formData.tags);
                                        if (!w) return null;
                                        if (opts.length === 0) {
                                            return <p className="text-[11px] text-amber-400/80">Este mundo no tiene tags configurados todavía.</p>;
                                        }
                                        return (
                                            <>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {opts.map(({ tag, exam }) => {
                                                        const on = current.includes(tag);
                                                        return (
                                                            <button
                                                                key={tag}
                                                                type="button"
                                                                onClick={() => toggleFormTag(tag)}
                                                                title={exam ? 'Tag de examen: solo este mundo lo usa' : 'Tag temático: compartido entre mundos'}
                                                                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                                                                    on
                                                                        ? exam
                                                                            ? 'bg-purple-500/25 border-purple-500 text-purple-200 font-bold'
                                                                            : 'bg-emerald-600/25 border-emerald-500 text-emerald-200'
                                                                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                                                                }`}
                                                            >
                                                                {exam ? <Award size={10} /> : <Tag size={10} />}
                                                                {tag}
                                                                {on && <Check size={10} />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <p className="text-[10px] text-gray-500 leading-snug">
                                                    <span className="text-purple-300 font-bold">Morado</span> = examen final del mundo (decide si esta pregunta sale en su mapa final).
                                                    <span className="text-emerald-300 font-bold"> Verde</span> = tema, se usa en las misiones normales y lo pueden compartir varios mundos.
                                                </p>
                                            </>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* Audio config */}
                            <div className="bg-gray-850 p-4 rounded-xl border border-gray-800 space-y-3">
                                <label className="flex items-center gap-2 text-xs text-white cursor-pointer font-bold uppercase tracking-wider">
                                    <input 
                                        type="checkbox"
                                        checked={formData.requires_audio === true || formData.requires_audio === 'true'}
                                        onChange={e => setFormData({...formData, requires_audio: e.target.checked})}
                                        className="rounded text-yellow-500 focus:ring-0"
                                    />
                                    ¿Requiere Audio para responder?
                                </label>
                                {(formData.requires_audio === true || formData.requires_audio === 'true') && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">URL del Archivo de Audio (Opcional)</label>
                                        <input 
                                            type="text"
                                            value={formData.audio_url}
                                            onChange={e => setFormData({...formData, audio_url: e.target.value})}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                                            placeholder="ej: /audio/challenges/vocabulary_adventure.mp3"
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Explicación de la Respuesta (Español)</label>
                                <textarea 
                                    rows="2"
                                    value={formData.explanation_es}
                                    onChange={e => setFormData({...formData, explanation_es: e.target.value})}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none resize-none text-xs"
                                    placeholder="ej: 'Cat' significa gato en inglés."
                                />
                                {formData.explanation_es && (
                                    <div className="mt-2 p-3 bg-gray-900 rounded-lg border border-gray-750 text-xs text-gray-300">
                                        <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Vista Previa:</div>
                                        <ReactMarkdown className="prose prose-invert prose-sm max-w-none">{formData.explanation_es}</ReactMarkdown>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-750 text-gray-400 rounded-xl font-bold transition-all border border-gray-700"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl font-bold transition-all shadow-lg shadow-yellow-500/20 flex items-center justify-center gap-2"
                                >
                                    <Save size={18} />
                                    {editingChallenge ? 'Guardar Cambios' : 'Crear Desafío'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
