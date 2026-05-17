import React, { createContext, useContext, useState } from "react";
import {
  LEADS as INITIAL_LEADS,
  CASOS as INITIAL_CASOS,
  type Lead, type Caso,
} from "./data";

type Store = {
  leads: Lead[];
  casos: Caso[];
  moveLeadStatus: (id: string, status: string) => void;
  moveCasoStatus: (id: string, status: string) => void;
};

const DataCtx = createContext<Store | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [casos, setCasos] = useState<Caso[]>(INITIAL_CASOS);

  const moveLeadStatus = (id: string, status: string) =>
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, status } : l)));
  const moveCasoStatus = (id: string, status: string) =>
    setCasos(prev => prev.map(c => (c.id === id ? { ...c, status } : c)));

  return (
    <DataCtx.Provider value={{ leads, casos, moveLeadStatus, moveCasoStatus }}>
      {children}
    </DataCtx.Provider>
  );
}

export function useStore() {
  const v = useContext(DataCtx);
  if (!v) throw new Error("useStore outside DataProvider");
  return v;
}
