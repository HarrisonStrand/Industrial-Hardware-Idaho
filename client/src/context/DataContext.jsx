import { createContext } from "react";
import brandData from "../data/brand.json";

export const DataContext = createContext();

export function DataProvider({ children }) {
  // brandData.brand is now an object, not an array
  const brand = brandData.brand;

  return (
    <DataContext.Provider value={brand}>
      {children}
    </DataContext.Provider>
  );
}