import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, Check } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

// Native language is what the player understands; the game always teaches English.
// The UI chrome only ships en/es bundles (others fall back to English text), but the
// learning helper text is LLM-translated into ANY of these on the backend.
export const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
    { code: 'pt', label: 'Português' },
    { code: 'fr', label: 'Français' },
    { code: 'de', label: 'Deutsch' },
    { code: 'it', label: 'Italiano' },
    { code: 'ru', label: 'Русский' },
    { code: 'ja', label: '日本語' },
    { code: 'ko', label: '한국어' },
    { code: 'zh', label: '中文' },
    { code: 'ar', label: 'العربية' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'tr', label: 'Türkçe' },
    { code: 'pl', label: 'Polski' },
    { code: 'id', label: 'Bahasa Indonesia' },
    { code: 'vi', label: 'Tiếng Việt' },
];

export const LanguageSwitcher = () => {
    const { i18n } = useTranslation();
    const setNativeLanguage = useAuthStore((s) => s.setNativeLanguage);
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    const current = (i18n.language || 'en').split('-')[0].toLowerCase();
    const currentLabel = (LANGUAGES.find((l) => l.code === current) || LANGUAGES[0]).code.toUpperCase();

    // Close on outside click
    useEffect(() => {
        const onClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    const select = (code) => {
        i18n.changeLanguage(code);
        // Persist as the learning native language (helper translations resolve into it).
        setNativeLanguage(code);
        setOpen(false);
    };

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700 hover:border-orange-500/50 hover:bg-gray-800 text-gray-400 hover:text-orange-400 transition-all active:scale-95 group"
                title="Switch Language / Cambiar Idioma"
            >
                <Languages size={18} className="group-hover:rotate-12 transition-transform" />
                <span className="text-xs font-bold font-mono uppercase tracking-wider">
                    {currentLabel}
                </span>
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-44 max-h-72 overflow-y-auto rounded-lg bg-gray-900 border border-gray-700 shadow-xl z-50 py-1">
                    {LANGUAGES.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => select(lang.code)}
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors hover:bg-gray-800 ${
                                lang.code === current ? 'text-orange-400' : 'text-gray-300'
                            }`}
                        >
                            <span>{lang.label}</span>
                            {lang.code === current && <Check size={14} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LanguageSwitcher;
