import { create } from 'zustand'

export const useAppStore = create((set) => ({
  mode: 'meme', // 'meme' or 'kryptos'
  setMode: (mode) => set({ mode }),
  isGlitching: false,
  setGlitching: (isGlitching) => set({ isGlitching }),
  onboardingComplete: false,
  setOnboardingComplete: (onboardingComplete) => set({ onboardingComplete }),
}))
