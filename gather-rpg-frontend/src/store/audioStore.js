import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';

export const useAudioStore = create(
    subscribeWithSelector(
        persist(
            (set) => ({
                masterVolume: 1.0,
                musicVolume: 0.5,
                sfxVolume: 0.8,
                voiceVolume: 0.8,

                setVolume: (channel, value) => set({ [channel]: value }),

                // Helpers specifically for mute toggles if needed later
                isMuted: false,
                toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
            }),
            {
                name: 'gather-rpg-audio-settings',
            }
        )
    )
);
