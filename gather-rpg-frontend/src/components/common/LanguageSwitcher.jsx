import React from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

export const LanguageSwitcher = () => {
    const { i18n } = useTranslation();

    const toggleLanguage = () => {
        const newLang = i18n.language.startsWith('es') ? 'en' : 'es';
        i18n.changeLanguage(newLang);
    };

    const currentLangLabel = i18n.language.startsWith('es') ? 'ES' : 'EN';

    return (
        <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700 hover:border-orange-500/50 hover:bg-gray-800 text-gray-400 hover:text-orange-400 transition-all active:scale-95 group"
            title="Switch Language / Cambiar Idioma"
        >
            <Languages size={18} className="group-hover:rotate-12 transition-transform" />
            <span className="text-xs font-bold font-mono uppercase tracking-wider">
                {currentLangLabel}
            </span>
        </button>
    );
};

export default LanguageSwitcher;
