/** Ícono de Material Symbols. Decorativo por defecto (aria-hidden); pasa `etiqueta` si transmite información. */
export function Icono({ nombre, lleno, className = "", etiqueta }: { nombre: string; lleno?: boolean; className?: string; etiqueta?: string }) {
  return (
    <span
      className={`icono ${lleno ? "icono-lleno" : ""} ${className}`}
      aria-hidden={etiqueta ? undefined : true}
      role={etiqueta ? "img" : undefined}
      aria-label={etiqueta}
      translate="no"
    >
      {nombre}
    </span>
  );
}
