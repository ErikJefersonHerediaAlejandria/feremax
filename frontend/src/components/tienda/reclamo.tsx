"use client";

import { useState } from "react";
import { Icono } from "../icono";

export function FormularioReclamo() {
  const [enviado, setEnviado] = useState(false);
  if (enviado)
    return (
      <p className="mt-6 flex gap-2 rounded-lg bg-emerald-50 p-4 text-emerald-900" role="status">
        <Icono nombre="check_circle" /> Reclamo de demostración registrado. En el prototipo no se guardan ni envían datos.
      </p>
    );
  return (
    <form
      className="mt-6 grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        setEnviado(true);
      }}
    >
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-sm font-bold text-marca-900">Tipo</legend>
        <div className="flex gap-6 text-sm">
          {["Reclamo", "Queja"].map((t, i) => (
            <label key={t} className="flex items-center gap-2">
              <input type="radio" name="tipo" value={t} defaultChecked={i === 0} className="size-4 accent-acento-700" /> {t}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="text-sm font-semibold text-marca-900">
        Número de pedido (opcional)
        <input name="pedido" className="campo mt-1" inputMode="numeric" />
      </label>
      <label className="text-sm font-semibold text-marca-900">
        Monto reclamado (S/)
        <input name="monto" type="number" min={0} step="0.01" className="campo mt-1" />
      </label>
      <label className="text-sm font-semibold text-marca-900 sm:col-span-2">
        Detalle
        <textarea name="detalle" required rows={4} className="campo mt-1" />
      </label>
      <button type="submit" className="btn-primario sm:col-span-2">
        <Icono nombre="menu_book" /> Registrar reclamo
      </button>
    </form>
  );
}
