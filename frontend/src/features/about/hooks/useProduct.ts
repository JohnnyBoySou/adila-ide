import { useEffect, useState } from "react";
import { rpc } from "../rpc";
import type { ProductInfo } from "../types";

export function useProduct(): ProductInfo | undefined {
  const [product, setProduct] = useState<ProductInfo | undefined>();
  useEffect(() => {
    let cancelled = false;
    void rpc.productInfo().then((p) => {
      if (!cancelled) {
        setProduct(p);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return product;
}
