import { useState } from "react";
import { Download } from "lucide-react";
import { downloadAndInstall } from "@/lib/apkUpdater";

interface Props {
  url: string;
  version: string;
  /** "sm" = rodapés compactos, "md" = padrão. */
  size?: "sm" | "md";
  /** Botão ocupa a largura toda (usado no popup). */
  fullWidth?: boolean;
  /** Sobrescreve o texto do botão (default "Baixar vX"). */
  label?: string;
}

const SIZES = {
  sm: { pad: "px-3 py-1.5 text-[10px] gap-1", icon: 10, bar: "h-1.5", txt: "text-[10px]" },
  md: { pad: "px-4 py-2 text-xs gap-2", icon: 12, bar: "h-2", txt: "text-xs" },
} as const;

/**
 * Botão de atualização in-app: baixa o APK dentro do app com barra de progresso
 * e abre o instalador do sistema. Reaproveitado no popup e nos rodapés.
 */
const UpdateDownloadButton = ({ url, version, size = "md", fullWidth = false, label }: Props) => {
  const [progress, setProgress] = useState<number | null>(null);
  const [needsPerm, setNeedsPerm] = useState(false);
  const s = SIZES[size];

  const handle = async () => {
    setNeedsPerm(false);
    setProgress(0);
    try {
      const res = await downloadAndInstall(url, (p) => setProgress(p));
      if (res === "permission") setNeedsPerm(true);
      // Reseta a barra: se cancelar a tela "Instalar?", o botão reaparece.
      setProgress(null);
    } catch {
      setProgress(null);
    }
  };

  if (progress !== null) {
    return (
      <div className={fullWidth ? "" : "max-w-[200px] mx-auto"}>
        <div className={`${s.bar} w-full bg-muted rounded-full overflow-hidden`}>
          <div
            className="h-full bg-primary transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className={`${s.txt} text-muted-foreground mt-0.5 text-center`}>
          {progress < 100 ? `Baixando ${progress}%` : "Abrindo instalador..."}
        </p>
      </div>
    );
  }

  return (
    <>
      {needsPerm && (
        <p className={`${s.txt} text-muted-foreground mb-2`}>
          Permita "instalar apps desconhecidos" nas configurações que abriram e toque novamente.
        </p>
      )}
      <button
        type="button"
        onClick={handle}
        className={`${fullWidth ? "w-full flex" : "inline-flex"} items-center justify-center ${s.pad} bg-primary text-primary-foreground rounded-lg font-semibold uppercase tracking-wider hover:bg-primary/90 transition-colors`}
      >
        <Download size={s.icon} />
        {needsPerm ? "Tentar novamente" : (label ?? `Baixar v${version}`)}
      </button>
    </>
  );
};

export default UpdateDownloadButton;
