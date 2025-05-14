--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ltree; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS ltree WITH SCHEMA public;


--
-- Name: EXTENSION ltree; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION ltree IS 'data type for hierarchical tree-like structures';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.account (
    id integer NOT NULL,
    name text,
    email text,
    email_verified boolean,
    created_at timestamp with time zone,
    pw text
);


ALTER TABLE public.account OWNER TO postgres;

--
-- Name: account_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.account_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.account_id_seq OWNER TO postgres;

--
-- Name: account_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.account_id_seq OWNED BY public.account.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    order_id character varying(20) NOT NULL,
    id_source character varying(50),
    order_source character varying(20) NOT NULL,
    guest_name character varying(50) NOT NULL,
    phone character varying(20) NOT NULL,
    id_number character varying(30) NOT NULL,
    room_type character varying(20) NOT NULL,
    room_number character varying(20) NOT NULL,
    check_in_date date NOT NULL,
    check_out_date date NOT NULL,
    status character varying(20) NOT NULL,
    payment_method character varying(20),
    room_price numeric(10,2) NOT NULL,
    deposit numeric(10,2),
    create_time timestamp without time zone NOT NULL,
    actual_check_in_time timestamp without time zone,
    actual_check_out_time timestamp without time zone,
    remarks text
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: room_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.room_types (
    type_code character varying(20) NOT NULL,
    type_name character varying(50) NOT NULL,
    base_price numeric(10,2) NOT NULL,
    description text,
    is_closed boolean DEFAULT false NOT NULL
);


ALTER TABLE public.room_types OWNER TO postgres;

--
-- Name: rooms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rooms (
    room_id integer NOT NULL,
    room_number character varying(20) NOT NULL,
    type_code character varying(20) NOT NULL,
    status character varying(20) NOT NULL,
    price numeric(10,2) NOT NULL,
    is_closed boolean DEFAULT false NOT NULL
);


ALTER TABLE public.rooms OWNER TO postgres;

--
-- Name: COLUMN rooms.is_closed; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rooms.is_closed IS '是否关闭销售';


--
-- Name: account id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account ALTER COLUMN id SET DEFAULT nextval('public.account_id_seq'::regclass);


--
-- Name: account account_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_email_key UNIQUE (email);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (order_id);


--
-- Name: room_types room_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.room_types
    ADD CONSTRAINT room_types_pkey PRIMARY KEY (type_code);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (room_id);


--
-- Name: rooms rooms_room_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_room_number_key UNIQUE (room_number);


--
-- Name: accountemailindex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX accountemailindex ON public.account USING btree (email);


--
-- Name: idx_orders_check_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_check_dates ON public.orders USING btree (check_in_date, check_out_date);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_room_types_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_room_types_name ON public.room_types USING btree (type_name);


--
-- Name: idx_rooms_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rooms_number ON public.rooms USING btree (room_number);


--
-- Name: idx_rooms_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rooms_status ON public.rooms USING btree (status);


--
-- Name: idx_rooms_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rooms_type ON public.rooms USING btree (type_code);


--
-- Name: orders orders_room_number_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_room_number_fkey FOREIGN KEY (room_number) REFERENCES public.rooms(room_number);


--
-- Name: orders orders_room_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_room_type_fkey FOREIGN KEY (room_type) REFERENCES public.room_types(type_code);


--
-- PostgreSQL database dump complete
--

