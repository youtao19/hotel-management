-- 酒店管理系统数据库表结构导出
-- 导出时间: 2025-10-11T09:02:30.762Z
-- PostgreSQL 数据库

-- Table: account
CREATE TABLE account (
    id integer(32,0) DEFAULT nextval('account_id_seq'::regclass) NOT NULL,
    name text,
    email text,
    email_verified boolean,
    created_at timestamp with time zone,
    pw text,
    PRIMARY KEY (id),
    UNIQUE (email)
);

CREATE UNIQUE INDEX account_email_key ON public.account USING btree (email);
CREATE INDEX accountemailindex ON public.account USING btree (email);

-- Table: bills
CREATE TABLE bills (
    bill_id integer(32,0) DEFAULT nextval('bills_bill_id_seq'::regclass) NOT NULL,
    order_id character varying(50) NOT NULL,
    room_number character varying(10) NOT NULL,
    guest_name character varying(50),
    change_price numeric(10,2) DEFAULT 0,
    change_type text,
    pay_way character varying(50) NOT NULL,
    create_time timestamp without time zone NOT NULL,
    remarks text,
    stay_type text,
    stay_date date,
    PRIMARY KEY (bill_id),
    FOREIGN KEY (order_id) REFERENCES public.orders(order_id)
);

CREATE INDEX idx_bills_order_id ON public.bills USING btree (order_id);

-- Table: handover
CREATE TABLE handover (
    id integer(32,0) DEFAULT nextval('handover_id_seq'::regclass) NOT NULL,
    date date NOT NULL,
    handover_person character varying(50) NOT NULL,
    takeover_person character varying(50) NOT NULL,
    vip_card integer DEFAULT 0,
    payment_type smallint NOT NULL,
    reserve_cash numeric(10,2) DEFAULT 0,
    room_income numeric(10,2) DEFAULT 0,
    rest_income numeric(10,2) DEFAULT 0,
    rent_income numeric(10,2) DEFAULT 0,
    total_income numeric(10,2) DEFAULT 0,
    room_refund numeric(10,2) DEFAULT 0,
    rest_refund numeric(10,2) DEFAULT 0,
    retained numeric(10,2) DEFAULT 0,
    handover numeric(10,2) DEFAULT 0,
    task_list jsonb DEFAULT '[]'::jsonb,
    remarks text,
    PRIMARY KEY (id),
    UNIQUE (date, payment_type)
);

CREATE INDEX idx_handover_date ON public.handover USING btree (date);
CREATE UNIQUE INDEX unique_date_payment ON public.handover USING btree (date, payment_type);

-- Table: order_changes
CREATE TABLE order_changes (
    change_id integer(32,0) DEFAULT nextval('order_changes_change_id_seq'::regclass) NOT NULL,
    order_id character varying(50) NOT NULL,
    changed_at timestamp with time zone DEFAULT now(),
    changed_by character varying(50),
    changes jsonb,
    reason text,
    PRIMARY KEY (change_id),
    FOREIGN KEY (order_id) REFERENCES public.orders(order_id)
);

CREATE INDEX idx_order_changes_order_id ON public.order_changes USING btree (order_id);
CREATE INDEX idx_order_changes_changed_at ON public.order_changes USING btree (changed_at);

-- Table: orders
CREATE TABLE orders (
    order_id character varying(50) NOT NULL,
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
    total_price numeric(10,2),
    deposit numeric(10,2),
    create_time timestamp without time zone NOT NULL,
    stay_type text,
    remarks text,
    PRIMARY KEY (order_id),
    UNIQUE (check_in_date, check_out_date, guest_name, room_type),
    FOREIGN KEY (room_type) REFERENCES public.room_types(type_code),
    FOREIGN KEY (room_number) REFERENCES public.rooms(room_number)
);

CREATE UNIQUE INDEX unique_order_constraint ON public.orders USING btree (guest_name, check_in_date, check_out_date, room_type);
CREATE INDEX idx_orders_status ON public.orders USING btree (status);
CREATE INDEX idx_orders_check_dates ON public.orders USING btree (check_in_date, check_out_date);
CREATE INDEX idx_orders_create_time ON public.orders USING btree (create_time DESC);
CREATE UNIQUE INDEX uniq_orders_active ON public.orders USING btree (guest_name, check_in_date, check_out_date, room_type);

-- Table: review_invitations
CREATE TABLE review_invitations (
    id integer(32,0) DEFAULT nextval('review_invitations_id_seq'::regclass) NOT NULL,
    order_id character varying(50) NOT NULL,
    invited boolean DEFAULT false NOT NULL,
    positive_review boolean,
    invite_time timestamp without time zone,
    update_time timestamp without time zone,
    PRIMARY KEY (id),
    UNIQUE (order_id),
    FOREIGN KEY (order_id) REFERENCES public.orders(order_id)
);

CREATE UNIQUE INDEX review_invitations_order_id_key ON public.review_invitations USING btree (order_id);
CREATE INDEX idx_review_invitations_order_id ON public.review_invitations USING btree (order_id);
CREATE INDEX idx_review_invitations_invited ON public.review_invitations USING btree (invited);
CREATE INDEX idx_review_invitations_positive_review ON public.review_invitations USING btree (positive_review);

-- Table: room_types
CREATE TABLE room_types (
    type_code character varying(20) NOT NULL,
    type_name character varying(50) NOT NULL,
    base_price numeric(10,2) NOT NULL,
    description text,
    is_closed boolean DEFAULT false NOT NULL,
    PRIMARY KEY (type_code)
);

CREATE INDEX idx_room_types_name ON public.room_types USING btree (type_name);

-- Table: rooms
CREATE TABLE rooms (
    room_id integer NOT NULL,
    room_number character varying(20) NOT NULL,
    type_code character varying(20) NOT NULL,
    status character varying(20) NOT NULL,
    price numeric(10,2) NOT NULL,
    is_closed boolean DEFAULT false,
    PRIMARY KEY (room_id),
    UNIQUE (room_number),
    FOREIGN KEY (type_code) REFERENCES public.room_types(type_code)
);

CREATE UNIQUE INDEX rooms_room_number_key ON public.rooms USING btree (room_number);
CREATE INDEX idx_rooms_status ON public.rooms USING btree (status);
CREATE INDEX idx_rooms_type ON public.rooms USING btree (type_code);
CREATE INDEX idx_rooms_number ON public.rooms USING btree (room_number);

