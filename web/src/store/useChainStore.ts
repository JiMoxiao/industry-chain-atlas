import { create } from "zustand";
import type { PanelTab } from "@/types/chain";

interface ChainStoreState {
  currentSlug: string;
  selectedNodeId: string | null;
  activeTab: PanelTab;
  selectedGroups: string[];
  searchQuery: string;
  setCurrentSlug: (slug: string) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  setActiveTab: (tab: PanelTab) => void;
  setSelectedGroups: (groups: string[]) => void;
  toggleGroup: (group: string) => void;
  clearGroups: () => void;
  setSearchQuery: (query: string) => void;
  resetForSlug: (slug: string) => void;
}

export const useChainStore = create<ChainStoreState>((set) => ({
  currentSlug: "",
  selectedNodeId: null,
  activeTab: "overview",
  selectedGroups: [],
  searchQuery: "",
  setCurrentSlug: (slug) => set({ currentSlug: slug }),
  setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedGroups: (groups) => set({ selectedGroups: groups }),
  toggleGroup: (group) =>
    set((state) => {
      const exists = state.selectedGroups.includes(group);
      return {
        selectedGroups: exists
          ? state.selectedGroups.filter((item) => item !== group)
          : [...state.selectedGroups, group],
      };
    }),
  clearGroups: () => set({ selectedGroups: [] }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  resetForSlug: (slug) =>
    set({
      currentSlug: slug,
      selectedNodeId: null,
      activeTab: "overview",
      selectedGroups: [],
      searchQuery: "",
    }),
}));
