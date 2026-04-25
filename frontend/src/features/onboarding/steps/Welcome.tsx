export function Welcome() {
  return (
    <div className="flex flex-col items-center gap-6 text-center w-full">
      <div className="w-full overflow-hidden rounded-xl border border-border/50 shadow-sm bg-muted/30">
        <img
          src="/onboarding_1.png"
          alt="Adila IDE"
          className="w-full object-cover max-h-56"
        />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Bem-vindo ao Adila IDE
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Um editor rápido, independente e focado no que importa. Vamos
          configurar algumas coisas em 30 segundos.
        </p>
      </div>
    </div>
  );
}
