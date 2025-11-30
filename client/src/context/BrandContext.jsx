import { createContext } from "react";
import brandData from "../data/brand.json";

export const BrandContext = createContext();

export function BrandProvider({ children }) {
  const brand = brandData.brand;

  return (
    <BrandContext.Provider value={brand}>
      {children}
    </BrandContext.Provider>
  );
}