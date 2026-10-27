-- Supabase expone el esquema public por su Data API (PostgREST) con la clave anon.
-- Se activa RLS sin políticas: los roles anon/authenticated no ven nada.
-- El backend (Prisma) y el recommender conectan como dueño de las tablas, que no está sujeto a RLS.
ALTER TABLE "productos"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "boletas"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "boleta_items"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "configuracion"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reglas_asociacion"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "modelos"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evaluaciones_offline" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sesiones_evaluacion"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eventos"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pedidos"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pedido_items"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admins"               ENABLE ROW LEVEL SECURITY;
-- _prisma_migrations no existe en la base "shadow" que usa prisma migrate dev
DO $$ BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Configuración de fila única
ALTER TABLE "configuracion" ADD CONSTRAINT "configuracion_fila_unica" CHECK ("id" = 1);
