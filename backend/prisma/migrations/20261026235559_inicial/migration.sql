-- CreateEnum
CREATE TYPE "Modo" AS ENUM ('CONV', 'ML');

-- CreateTable
CREATE TABLE "productos" (
    "sku" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "marca" TEXT,
    "categoria" TEXT,
    "subcategoria" TEXT,
    "unidad" TEXT,
    "uso" TEXT,
    "precio" DECIMAL(10,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "imagen_url" TEXT,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("sku")
);

-- CreateTable
CREATE TABLE "boletas" (
    "id_boleta" TEXT NOT NULL,
    "fecha" TIMESTAMPTZ(3) NOT NULL,
    "cliente_codigo" TEXT NOT NULL,

    CONSTRAINT "boletas_pkey" PRIMARY KEY ("id_boleta")
);

-- CreateTable
CREATE TABLE "boleta_items" (
    "id" SERIAL NOT NULL,
    "id_boleta" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "boleta_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "modo_activo" "Modo" NOT NULL DEFAULT 'ML',
    "k" INTEGER NOT NULL DEFAULT 5,
    "soporte_min" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "confianza_min" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "lift_min" DOUBLE PRECISION NOT NULL DEFAULT 1.2,
    "peso_contenido" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "variante_ml" TEXT NOT NULL DEFAULT 'COMPLETO',
    "fuente_datos" TEXT NOT NULL DEFAULT 'sintetico',
    "reordenador" JSONB,
    "actualizada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reglas_asociacion" (
    "id" SERIAL NOT NULL,
    "antecedente" TEXT[],
    "consecuente" TEXT[],
    "soporte" DOUBLE PRECISION NOT NULL,
    "confianza" DOUBLE PRECISION NOT NULL,
    "lift" DOUBLE PRECISION NOT NULL,
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "version_modelo" TEXT,
    "creada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reglas_asociacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modelos" (
    "id" SERIAL NOT NULL,
    "version" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metricas" JSONB NOT NULL,
    "artefacto" TEXT,
    "vigente" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "modelos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluaciones_offline" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultado" JSONB NOT NULL,

    CONSTRAINT "evaluaciones_offline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones_evaluacion" (
    "id_sesion" TEXT NOT NULL,
    "codigo_cliente" TEXT NOT NULL,
    "escenario" TEXT NOT NULL,
    "condicion" "Modo" NOT NULL,
    "orden" TEXT NOT NULL,
    "token_dispositivo" TEXT NOT NULL,
    "inicio" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin" TIMESTAMPTZ(3),
    "valida" BOOLEAN NOT NULL DEFAULT true,
    "completa" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sesiones_evaluacion_pkey" PRIMARY KEY ("id_sesion")
);

-- CreateTable
CREATE TABLE "eventos" (
    "id" BIGSERIAL NOT NULL,
    "id_sesion" TEXT NOT NULL,
    "codigo_cliente" TEXT NOT NULL,
    "escenario" TEXT,
    "condicion" "Modo" NOT NULL,
    "tipo_evento" TEXT NOT NULL,
    "texto_consulta" TEXT,
    "sku" TEXT,
    "posicion_recom" INTEGER,
    "origen" TEXT,
    "timestamp" BIGINT NOT NULL,
    "recibido_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_sesion" TEXT NOT NULL,
    "codigo_cliente" TEXT NOT NULL,
    "escenario" TEXT,
    "condicion" "Modo" NOT NULL,
    "entrega" TEXT,
    "pago" TEXT,
    "total" DECIMAL(10,2) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'Registrado',

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_items" (
    "id" SERIAL NOT NULL,
    "pedido_id" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "origen" TEXT NOT NULL,

    CONSTRAINT "pedido_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "productos_categoria_idx" ON "productos"("categoria");

-- CreateIndex
CREATE INDEX "boletas_fecha_idx" ON "boletas"("fecha");

-- CreateIndex
CREATE INDEX "boletas_cliente_codigo_idx" ON "boletas"("cliente_codigo");

-- CreateIndex
CREATE INDEX "boleta_items_id_boleta_idx" ON "boleta_items"("id_boleta");

-- CreateIndex
CREATE INDEX "boleta_items_sku_idx" ON "boleta_items"("sku");

-- CreateIndex
CREATE INDEX "reglas_asociacion_vigente_idx" ON "reglas_asociacion"("vigente");

-- CreateIndex
CREATE UNIQUE INDEX "modelos_version_key" ON "modelos"("version");

-- CreateIndex
CREATE INDEX "evaluaciones_offline_fecha_idx" ON "evaluaciones_offline"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_evaluacion_token_dispositivo_key" ON "sesiones_evaluacion"("token_dispositivo");

-- CreateIndex
CREATE INDEX "sesiones_evaluacion_codigo_cliente_idx" ON "sesiones_evaluacion"("codigo_cliente");

-- CreateIndex
CREATE INDEX "sesiones_evaluacion_fin_idx" ON "sesiones_evaluacion"("fin");

-- CreateIndex
CREATE INDEX "eventos_id_sesion_idx" ON "eventos"("id_sesion");

-- CreateIndex
CREATE INDEX "eventos_codigo_cliente_idx" ON "eventos"("codigo_cliente");

-- CreateIndex
CREATE INDEX "eventos_tipo_evento_idx" ON "eventos"("tipo_evento");

-- CreateIndex
CREATE INDEX "pedidos_id_sesion_idx" ON "pedidos"("id_sesion");

-- CreateIndex
CREATE INDEX "pedidos_codigo_cliente_idx" ON "pedidos"("codigo_cliente");

-- CreateIndex
CREATE INDEX "pedido_items_pedido_id_idx" ON "pedido_items"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "admins_username_key" ON "admins"("username");

-- AddForeignKey
ALTER TABLE "boleta_items" ADD CONSTRAINT "boleta_items_id_boleta_fkey" FOREIGN KEY ("id_boleta") REFERENCES "boletas"("id_boleta") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boleta_items" ADD CONSTRAINT "boleta_items_sku_fkey" FOREIGN KEY ("sku") REFERENCES "productos"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_sku_fkey" FOREIGN KEY ("sku") REFERENCES "productos"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;
