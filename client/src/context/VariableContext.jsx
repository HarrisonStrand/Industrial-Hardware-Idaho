import { createContext } from "react";
import VariablesData from "../data/section-variables.json";

export const VariableContext = createContext();

export function VariablesProvider({ children }) {
  const variables = VariablesData.variables;

  return (
    <VariableContext.Provider value={variables}>
      {children}
    </VariableContext.Provider>
  );
}