-- =====================================================================
-- FerreMax v2 · ESTRUCTURA (tablas vacías). Ejecutar ANTES de importar los CSV.
-- Generado desde ferremax_dev (Prisma 7.10.1, migración 20261026235559_inicial)
--
-- Contenido: las 13 tablas, índices, RLS y el registro de migraciones de Prisma.
-- NO incluye administradores: el admin se crea con el seed (ver db/LEEME.md).
--
-- Uso: Supabase > SQL Editor > pegar > Run. Luego importar los CSV en orden (ver LEEME.md).
-- Corre en una sola transacción: si algo falla, no queda nada a medias.
-- Requiere una base sin estas tablas.
-- =====================================================================
BEGIN;
--
-- PostgreSQL database dump
--


-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: Modo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Modo" AS ENUM (
    'CONV',
    'ML'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admins (
    id integer NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    creado_en timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: admins_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admins_id_seq OWNED BY public.admins.id;


--
-- Name: boleta_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boleta_items (
    id integer NOT NULL,
    id_boleta text NOT NULL,
    sku text NOT NULL,
    cantidad integer NOT NULL,
    precio numeric(10,2) NOT NULL
);


--
-- Name: boleta_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.boleta_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: boleta_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.boleta_items_id_seq OWNED BY public.boleta_items.id;


--
-- Name: boletas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boletas (
    id_boleta text NOT NULL,
    fecha timestamp(3) with time zone NOT NULL,
    cliente_codigo text NOT NULL
);


--
-- Name: configuracion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.configuracion (
    id integer DEFAULT 1 NOT NULL,
    modo_activo public."Modo" DEFAULT 'ML'::public."Modo" NOT NULL,
    k integer DEFAULT 5 NOT NULL,
    soporte_min double precision DEFAULT 0.01 NOT NULL,
    confianza_min double precision DEFAULT 0.15 NOT NULL,
    lift_min double precision DEFAULT 1.2 NOT NULL,
    peso_contenido double precision DEFAULT 1.0 NOT NULL,
    variante_ml text DEFAULT 'COMPLETO'::text NOT NULL,
    fuente_datos text DEFAULT 'sintetico'::text NOT NULL,
    reordenador jsonb,
    actualizada_en timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT configuracion_fila_unica CHECK ((id = 1))
);


--
-- Name: evaluaciones_offline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluaciones_offline (
    id integer NOT NULL,
    fecha timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    resultado jsonb NOT NULL
);


--
-- Name: evaluaciones_offline_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.evaluaciones_offline_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evaluaciones_offline_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.evaluaciones_offline_id_seq OWNED BY public.evaluaciones_offline.id;


--
-- Name: eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eventos (
    id bigint NOT NULL,
    id_sesion text NOT NULL,
    codigo_cliente text NOT NULL,
    escenario text,
    condicion public."Modo" NOT NULL,
    tipo_evento text NOT NULL,
    texto_consulta text,
    sku text,
    posicion_recom integer,
    origen text,
    "timestamp" bigint NOT NULL,
    recibido_en timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: eventos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.eventos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: eventos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.eventos_id_seq OWNED BY public.eventos.id;


--
-- Name: modelos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modelos (
    id integer NOT NULL,
    version text NOT NULL,
    tipo text NOT NULL,
    fecha timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metricas jsonb NOT NULL,
    artefacto text,
    vigente boolean DEFAULT false NOT NULL
);


--
-- Name: modelos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.modelos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: modelos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.modelos_id_seq OWNED BY public.modelos.id;


--
-- Name: pedido_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedido_items (
    id integer NOT NULL,
    pedido_id integer NOT NULL,
    sku text NOT NULL,
    cantidad integer NOT NULL,
    precio numeric(10,2) NOT NULL,
    origen text NOT NULL
);


--
-- Name: pedido_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pedido_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pedido_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pedido_items_id_seq OWNED BY public.pedido_items.id;


--
-- Name: pedidos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedidos (
    id integer NOT NULL,
    fecha timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    id_sesion text NOT NULL,
    codigo_cliente text NOT NULL,
    escenario text,
    condicion public."Modo" NOT NULL,
    entrega text,
    pago text,
    total numeric(10,2) NOT NULL,
    estado text DEFAULT 'Registrado'::text NOT NULL
);


--
-- Name: pedidos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pedidos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pedidos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pedidos_id_seq OWNED BY public.pedidos.id;


--
-- Name: productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productos (
    sku text NOT NULL,
    nombre text NOT NULL,
    marca text,
    categoria text,
    subcategoria text,
    unidad text,
    uso text,
    precio numeric(10,2) NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    imagen_url text
);


--
-- Name: reglas_asociacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reglas_asociacion (
    id integer NOT NULL,
    antecedente text[],
    consecuente text[],
    soporte double precision NOT NULL,
    confianza double precision NOT NULL,
    lift double precision NOT NULL,
    vigente boolean DEFAULT true NOT NULL,
    version_modelo text,
    creada_en timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: reglas_asociacion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reglas_asociacion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reglas_asociacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reglas_asociacion_id_seq OWNED BY public.reglas_asociacion.id;


--
-- Name: sesiones_evaluacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sesiones_evaluacion (
    id_sesion text NOT NULL,
    codigo_cliente text NOT NULL,
    escenario text NOT NULL,
    condicion public."Modo" NOT NULL,
    orden text NOT NULL,
    token_dispositivo text NOT NULL,
    inicio timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fin timestamp(3) with time zone,
    valida boolean DEFAULT true NOT NULL,
    completa boolean DEFAULT false NOT NULL
);


--
-- Name: admins id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins ALTER COLUMN id SET DEFAULT nextval('public.admins_id_seq'::regclass);


--
-- Name: boleta_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boleta_items ALTER COLUMN id SET DEFAULT nextval('public.boleta_items_id_seq'::regclass);


--
-- Name: evaluaciones_offline id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones_offline ALTER COLUMN id SET DEFAULT nextval('public.evaluaciones_offline_id_seq'::regclass);


--
-- Name: eventos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos ALTER COLUMN id SET DEFAULT nextval('public.eventos_id_seq'::regclass);


--
-- Name: modelos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modelos ALTER COLUMN id SET DEFAULT nextval('public.modelos_id_seq'::regclass);


--
-- Name: pedido_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido_items ALTER COLUMN id SET DEFAULT nextval('public.pedido_items_id_seq'::regclass);


--
-- Name: pedidos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos ALTER COLUMN id SET DEFAULT nextval('public.pedidos_id_seq'::regclass);


--
-- Name: reglas_asociacion id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_asociacion ALTER COLUMN id SET DEFAULT nextval('public.reglas_asociacion_id_seq'::regclass);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public._prisma_migrations VALUES ('0a7d9f0c-22e1-4cd1-ae3d-d0b696aaee4a', 'e804901231b83cf193cfa335d16b96e629e433978fdae6656d58c860376324e2', '2026-10-26 18:55:59.380233-05', '20261026235559_inicial', NULL, NULL, '2026-10-26 18:55:59.305289-05', 1);
INSERT INTO public._prisma_migrations VALUES ('e89f5401-d0b9-428b-9e8f-68905b660c76', 'fb1b970eea7f635317f86546f8cb1034bba11dddecefc5facebdd96b408ab328', '2026-10-26 19:05:38.84704-05', '20261027000511_rls_supabase', NULL, NULL, '2026-10-26 19:05:38.8423-05', 1);


--
-- Data for Name: evaluaciones_offline; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: eventos; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: modelos; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: pedido_items; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: pedidos; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: reglas_asociacion; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: sesiones_evaluacion; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Name: admins_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.admins_id_seq', 1, true);


--
-- Name: boleta_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.boleta_items_id_seq', 13556, true);


--
-- Name: evaluaciones_offline_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.evaluaciones_offline_id_seq', 1, false);


--
-- Name: eventos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.eventos_id_seq', 1, false);


--
-- Name: modelos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.modelos_id_seq', 1, false);


--
-- Name: pedido_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pedido_items_id_seq', 1, false);


--
-- Name: pedidos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pedidos_id_seq', 1, false);


--
-- Name: reglas_asociacion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.reglas_asociacion_id_seq', 1, false);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- Name: boleta_items boleta_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boleta_items
    ADD CONSTRAINT boleta_items_pkey PRIMARY KEY (id);


--
-- Name: boletas boletas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boletas
    ADD CONSTRAINT boletas_pkey PRIMARY KEY (id_boleta);


--
-- Name: configuracion configuracion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_pkey PRIMARY KEY (id);


--
-- Name: evaluaciones_offline evaluaciones_offline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluaciones_offline
    ADD CONSTRAINT evaluaciones_offline_pkey PRIMARY KEY (id);


--
-- Name: eventos eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos
    ADD CONSTRAINT eventos_pkey PRIMARY KEY (id);


--
-- Name: modelos modelos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modelos
    ADD CONSTRAINT modelos_pkey PRIMARY KEY (id);


--
-- Name: pedido_items pedido_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido_items
    ADD CONSTRAINT pedido_items_pkey PRIMARY KEY (id);


--
-- Name: pedidos pedidos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_pkey PRIMARY KEY (id);


--
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (sku);


--
-- Name: reglas_asociacion reglas_asociacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reglas_asociacion
    ADD CONSTRAINT reglas_asociacion_pkey PRIMARY KEY (id);


--
-- Name: sesiones_evaluacion sesiones_evaluacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones_evaluacion
    ADD CONSTRAINT sesiones_evaluacion_pkey PRIMARY KEY (id_sesion);


--
-- Name: admins_username_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX admins_username_key ON public.admins USING btree (username);


--
-- Name: boleta_items_id_boleta_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX boleta_items_id_boleta_idx ON public.boleta_items USING btree (id_boleta);


--
-- Name: boleta_items_sku_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX boleta_items_sku_idx ON public.boleta_items USING btree (sku);


--
-- Name: boletas_cliente_codigo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX boletas_cliente_codigo_idx ON public.boletas USING btree (cliente_codigo);


--
-- Name: boletas_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX boletas_fecha_idx ON public.boletas USING btree (fecha);


--
-- Name: evaluaciones_offline_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX evaluaciones_offline_fecha_idx ON public.evaluaciones_offline USING btree (fecha);


--
-- Name: eventos_codigo_cliente_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eventos_codigo_cliente_idx ON public.eventos USING btree (codigo_cliente);


--
-- Name: eventos_id_sesion_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eventos_id_sesion_idx ON public.eventos USING btree (id_sesion);


--
-- Name: eventos_tipo_evento_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eventos_tipo_evento_idx ON public.eventos USING btree (tipo_evento);


--
-- Name: modelos_version_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX modelos_version_key ON public.modelos USING btree (version);


--
-- Name: pedido_items_pedido_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pedido_items_pedido_id_idx ON public.pedido_items USING btree (pedido_id);


--
-- Name: pedidos_codigo_cliente_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pedidos_codigo_cliente_idx ON public.pedidos USING btree (codigo_cliente);


--
-- Name: pedidos_id_sesion_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pedidos_id_sesion_idx ON public.pedidos USING btree (id_sesion);


--
-- Name: productos_categoria_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX productos_categoria_idx ON public.productos USING btree (categoria);


--
-- Name: reglas_asociacion_vigente_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reglas_asociacion_vigente_idx ON public.reglas_asociacion USING btree (vigente);


--
-- Name: sesiones_evaluacion_codigo_cliente_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sesiones_evaluacion_codigo_cliente_idx ON public.sesiones_evaluacion USING btree (codigo_cliente);


--
-- Name: sesiones_evaluacion_fin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sesiones_evaluacion_fin_idx ON public.sesiones_evaluacion USING btree (fin);


--
-- Name: sesiones_evaluacion_token_dispositivo_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sesiones_evaluacion_token_dispositivo_key ON public.sesiones_evaluacion USING btree (token_dispositivo);


--
-- Name: boleta_items boleta_items_id_boleta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boleta_items
    ADD CONSTRAINT boleta_items_id_boleta_fkey FOREIGN KEY (id_boleta) REFERENCES public.boletas(id_boleta) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: boleta_items boleta_items_sku_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boleta_items
    ADD CONSTRAINT boleta_items_sku_fkey FOREIGN KEY (sku) REFERENCES public.productos(sku) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: pedido_items pedido_items_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido_items
    ADD CONSTRAINT pedido_items_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: pedido_items pedido_items_sku_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido_items
    ADD CONSTRAINT pedido_items_sku_fkey FOREIGN KEY (sku) REFERENCES public.productos(sku) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: _prisma_migrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: admins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

--
-- Name: boleta_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.boleta_items ENABLE ROW LEVEL SECURITY;

--
-- Name: boletas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.boletas ENABLE ROW LEVEL SECURITY;

--
-- Name: configuracion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

--
-- Name: evaluaciones_offline; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.evaluaciones_offline ENABLE ROW LEVEL SECURITY;

--
-- Name: eventos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;

--
-- Name: modelos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.modelos ENABLE ROW LEVEL SECURITY;

--
-- Name: pedido_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pedido_items ENABLE ROW LEVEL SECURITY;

--
-- Name: pedidos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

--
-- Name: productos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

--
-- Name: reglas_asociacion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reglas_asociacion ENABLE ROW LEVEL SECURITY;

--
-- Name: sesiones_evaluacion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sesiones_evaluacion ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--



COMMIT;
