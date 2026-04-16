import React, { useState } from 'react';
import { HelpCircle, Heart, Zap, Shield, Sparkles, Target } from 'lucide-react';

const ITEM_TYPES = [
    { value: 'health', label: 'Consumible Salud', icon: Heart },
    { value: 'mana', label: 'Consumible Maná', icon: Zap },
    { value: 'reviver', label: 'Revividor', icon: Sparkles },
    { value: 'throwable', label: 'Arma Arrojable', icon: Target },
    { value: 'weapon', label: 'Arma', icon: Target },
    { value: 'defense', label: 'Defensa', icon: Shield },
    { value: 'mission_item', label: 'Ítem de Misión', icon: Sparkles },
    { value: 'other', label: 'Otro / Material', icon: HelpCircle }
];

export const ItemIcon = ({ iconKey, type, size = 48, className = "" }) => {
    const [error, setError] = useState(false);
    
    // Path fixed to /Items/sprites. If iconKey already has extension, use it, else append .png
    const iconUrl = iconKey ? (iconKey.endsWith('.png') ? `/Items/sprites/${iconKey}` : `/Items/sprites/${iconKey}.png`) : null;
    
    const DefaultIcon = ITEM_TYPES.find(t => t.value === type)?.icon || HelpCircle;

    if (!iconUrl || error) {
        return (
            <div 
                className={`flex items-center justify-center bg-gray-700/50 rounded-lg text-gray-400 ${className}`} 
                style={{ width: size, height: size }}
            >
                <DefaultIcon size={size * 0.5} />
            </div>
        );
    }

    return (
        <img 
            src={iconUrl} 
            alt="Item Icon" 
            onError={() => setError(true)}
            className={`rounded-lg object-contain ${className}`}
            style={{ width: size, height: size }}
        />
    );
};
