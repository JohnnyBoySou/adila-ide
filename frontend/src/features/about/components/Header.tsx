import type { ProductInfo, UpdateState } from "../types";
import { ActionsMenu } from "./ActionsMenu";
import { UpdatePill } from "./UpdatePill";

type HeaderProps = {
  product: ProductInfo | undefined;
  updateState: UpdateState | undefined;
};

export function Header({ product, updateState }: HeaderProps) {
  return (
    <header className="flex items-center gap-3 px-6 py-4 border-b shrink-0">
      <img src="/icon.png" alt="Adila IDE" className="size-8 object-contain" />
      <div className="flex flex-col min-w-0">
        <span className="font-semibold text-base leading-tight">
          {product?.name ?? "Adila IDE"}
        </span>
        <span className="text-xs text-muted-foreground leading-tight">
          v{product?.version ?? "…"}
        </span>
      </div>
      <div className="flex-1" />
      <UpdatePill state={updateState} />
      <ActionsMenu product={product} />
    </header>
  );
}
