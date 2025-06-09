-- account 表结构
CREATE TABLE IF NOT EXISTS "account" (
  "id" integer DEFAULT nextval('account_id_seq'::regclass) NOT NULL,
  "name" text,
  "email" text,
  "email_verified" boolean,
  "created_at" timestamp with time zone,
  "pw" text,
  CONSTRAINT "account_pkey" PRIMARY KEY (id),
  CONSTRAINT "account_email_key" UNIQUE (email)
);

CREATE INDEX accountemailindex ON public.account USING btree (email);

-- room_types 表结构
CREATE TABLE IF NOT EXISTS "room_types" (
  "type_code" character varying(20) NOT NULL,
  "type_name" character varying(50) NOT NULL,
  "base_price" numeric NOT NULL,
  "description" text,
  "is_closed" boolean DEFAULT false NOT NULL,
  CONSTRAINT "room_types_pkey" PRIMARY KEY (type_code)
);

CREATE INDEX idx_room_types_name ON public.room_types USING btree (type_name);

-- rooms 表结构
CREATE TABLE IF NOT EXISTS "rooms" (
  "room_id" integer NOT NULL,
  "room_number" character varying(20) NOT NULL,
  "type_code" character varying(20) NOT NULL,
  "status" character varying(20) NOT NULL,
  "price" numeric NOT NULL,
  "is_closed" boolean DEFAULT false,
  CONSTRAINT "rooms_pkey" PRIMARY KEY (room_id),
  CONSTRAINT "rooms_type_code_fkey" FOREIGN KEY (type_code) REFERENCES public.room_types,
  CONSTRAINT "rooms_room_number_key" UNIQUE (room_number)
);

CREATE INDEX idx_rooms_status ON public.rooms USING btree (status);
CREATE INDEX idx_rooms_type ON public.rooms USING btree (type_code);
CREATE INDEX idx_rooms_number ON public.rooms USING btree (room_number);

-- orders 表结构
CREATE TABLE IF NOT EXISTS "orders" (
  "order_id" character varying(20) NOT NULL,
  "id_source" character varying(50),
  "order_source" character varying(20) NOT NULL,
  "guest_name" character varying(50) NOT NULL,
  "phone" character varying(20) NOT NULL,
  "id_number" character varying(30) NOT NULL,
  "room_type" character varying(20) NOT NULL,
  "room_number" character varying(20) NOT NULL,
  "check_in_date" date NOT NULL,
  "check_out_date" date NOT NULL,
  "status" character varying(20) NOT NULL,
  "payment_method" character varying(20),
  "room_price" numeric NOT NULL,
  "deposit" numeric,
  "create_time" timestamp without time zone NOT NULL,
  "remarks" text,
  CONSTRAINT "orders_pkey" PRIMARY KEY (order_id),
  CONSTRAINT "orders_room_type_fkey" FOREIGN KEY (room_type) REFERENCES public.room_types,
  CONSTRAINT "orders_room_number_fkey" FOREIGN KEY (room_number) REFERENCES public.rooms
);

CREATE INDEX idx_orders_status ON public.orders USING btree (status);
CREATE INDEX idx_orders_check_dates ON public.orders USING btree (check_in_date, check_out_date);

-- bills 表结构
CREATE TABLE IF NOT EXISTS "bills" (
  "order_id" character varying(20) NOT NULL,
  "room_number" character varying(10) NOT NULL,
  "guest_name" character varying(50),
  "deposit" numeric,
  "refund_deposit" boolean NOT NULL,
  "room_fee" numeric,
  "total_income" numeric,
  "pay_way" character varying(20) NOT NULL,
  "create_time" timestamp without time zone NOT NULL,
  "remarks" text,
  CONSTRAINT "bills_pkey" PRIMARY KEY (order_id),
  CONSTRAINT "bills_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders
);

CREATE INDEX idx_bills_order_id ON public.bills USING btree (order_id);

