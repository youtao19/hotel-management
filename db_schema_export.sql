-- Table: rooms
CREATE TABLE rooms (
    room_id integer(32,0) NOT NULL,
    room_number character varying(20) NOT NULL,
    type_code character varying(20) NOT NULL,
    status character varying(20) NOT NULL,
    price numeric(10,2) NOT NULL,
    is_closed boolean DEFAULT false,
    PRIMARY KEY (room_id),
    FOREIGN KEY (type_code) REFERENCES room_types(type_code)
);

CREATE UNIQUE INDEX rooms_pkey ON public.rooms USING btree (room_id);
CREATE INDEX idx_rooms_status ON public.rooms USING btree (status);
CREATE INDEX idx_rooms_type ON public.rooms USING btree (type_code);
CREATE UNIQUE INDEX rooms_room_number_key ON public.rooms USING btree (room_number);
CREATE INDEX idx_rooms_number ON public.rooms USING btree (room_number);
-- Table: orders
CREATE TABLE orders (
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
    remarks text,
    PRIMARY KEY (order_id),
    FOREIGN KEY (room_type) REFERENCES room_types(type_code),
    FOREIGN KEY (room_number) REFERENCES rooms(room_number)
);

CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (order_id);
CREATE INDEX idx_orders_status ON public.orders USING btree (status);
CREATE INDEX idx_orders_check_dates ON public.orders USING btree (check_in_date, check_out_date);
-- Table: inventory
CREATE TABLE inventory (
    date date NOT NULL,
    type_code character varying(20) NOT NULL,
    total_rooms integer(32,0) NOT NULL,
    available_rooms integer(32,0) NOT NULL,
    price_adjustment numeric(10,2),
    PRIMARY KEY (date, type_code),
    FOREIGN KEY (type_code) REFERENCES room_types(type_code)
);

CREATE UNIQUE INDEX inventory_pkey ON public.inventory USING btree (date, type_code);
CREATE INDEX idx_inventory_date ON public.inventory USING btree (date);
-- Table: bills
CREATE TABLE bills (
    order_id character varying(20) NOT NULL,
    room_number character varying(10) NOT NULL,
    guest_name character varying(50),
    deposit numeric(10,2),
    refund_deposit boolean NOT NULL,
    room_fee numeric(10,2),
    total_income numeric(10,2),
    pay_way character varying(20) NOT NULL,
    create_time timestamp without time zone NOT NULL,
    remarks text,
    PRIMARY KEY (order_id),
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

CREATE UNIQUE INDEX bills_pkey ON public.bills USING btree (order_id);
CREATE INDEX idx_bills_order_id ON public.bills USING btree (order_id);
-- Table: account
CREATE TABLE account (
    id integer(32,0) DEFAULT nextval('account_id_seq'::regclass) NOT NULL,
    name text,
    email text,
    email_verified boolean,
    created_at timestamp with time zone,
    pw text,
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX account_pkey ON public.account USING btree (id);
CREATE UNIQUE INDEX account_email_key ON public.account USING btree (email);
CREATE INDEX accountemailindex ON public.account USING btree (email);
-- Table: room_types
CREATE TABLE room_types (
    type_code character varying(20) NOT NULL,
    type_name character varying(50) NOT NULL,
    base_price numeric(10,2) NOT NULL,
    description text,
    is_closed boolean DEFAULT false NOT NULL,
    PRIMARY KEY (type_code)
);

CREATE UNIQUE INDEX room_types_pkey ON public.room_types USING btree (type_code);
CREATE INDEX idx_room_types_name ON public.room_types USING btree (type_name);
