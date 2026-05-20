import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Map, Maximize, Music, LocateFixed } from 'lucide-react';

export const CreateMapModal = ({ isOpen, onClose, onSubmit }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        sceneKey: '',
        width: 3200,
        height: 3200,
        spawnX: 1600,
        spawnY: 1600,
        bgmTrack: 'none'
    });

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'sceneKey' ? value.toLowerCase().replace(/\s+/g, '_') : value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="bg-gray-800/50 px-6 py-4 flex items-center justify-between border-b border-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="bg-green-500/20 p-2 rounded-lg">
                            <Map className="text-green-400" size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-white">Nuevo Mapa</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Scene Key */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">
                            Clave de la Escena (ID Único)
                        </label>
                        <input
                            required
                            name="sceneKey"
                            value={formData.sceneKey}
                            onChange={handleChange}
                            placeholder="ej: bosque_combate_1"
                            className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-green-500 focus:outline-none transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Width/Height */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">
                                <Maximize size={14} /> Ancho (px)
                            </label>
                            <input
                                type="number"
                                name="width"
                                value={formData.width}
                                onChange={handleChange}
                                className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-green-500 focus:outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">
                                <Maximize size={14} /> Alto (px)
                            </label>
                            <input
                                type="number"
                                name="height"
                                value={formData.height}
                                onChange={handleChange}
                                className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-green-500 focus:outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Spawn X/Y */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">
                                <LocateFixed size={14} /> Spawn X
                            </label>
                            <input
                                type="number"
                                name="spawnX"
                                value={formData.spawnX}
                                onChange={handleChange}
                                className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-green-500 focus:outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">
                                <LocateFixed size={14} /> Spawn Y
                            </label>
                            <input
                                type="number"
                                name="spawnY"
                                value={formData.spawnY}
                                onChange={handleChange}
                                className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-green-500 focus:outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* BGM */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">
                            <Music size={14} /> Música de Fondo
                        </label>
                        <select
                            name="bgmTrack"
                            value={formData.bgmTrack}
                            onChange={handleChange}
                            className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-green-500 focus:outline-none transition-all appearance-none"
                        >
                            <option value="none">Sin música</option>
                            <option value="lobby-bgm">Lobby Theme</option>
                            <option value="forest-bgm">Forest Theme</option>
                            <option value="battle-bgm">Battle Theme</option>
                            <option value="dungeon-bgm">Dungeon Theme</option>
                        </select>
                    </div>

                    {/* Footer */}
                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-[2] bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-900/20 transition-all active:scale-95"
                        >
                            Crear Mapa
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
