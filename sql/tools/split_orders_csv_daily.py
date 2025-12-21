#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import csv
import os
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP


OUTPUT_FIELDS = [
    "order_id",
    "id_source",
    "order_source",
    "guest_name",
    "phone",
    "room_type",
    "room_number",
    "check_in_date",
    "check_out_date",
    "stay_date",
    "status",
    "payment_method",
    "total_price",
    "deposit",
    "create_time",
    "stay_type",
    "remarks",
    "is_prepaid",
    "prepaid_amount",
]


def parse_ymd(value: str) -> date:
    parts = (value or "").split("-")
    if len(parts) != 3:
        raise ValueError(f"invalid date: {value!r}")
    y, m, d = (int(p) for p in parts)
    return date(y, m, d)


def to_decimal(value: str) -> Decimal:
    raw = (value or "").strip()
    if raw == "":
        return Decimal("0")
    return Decimal(raw)


def to_cents(value: Decimal) -> int:
    return int((value * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def cents_to_str(cents: int) -> str:
    return f"{Decimal(cents) / 100:.2f}"


@dataclass(frozen=True)
class SplitStats:
    input_rows: int
    output_rows: int
    input_total_cents: int
    output_total_cents: int


def split_row(row: dict) -> list[dict]:
    check_in = parse_ymd(row.get("check_in_date", ""))
    check_out = parse_ymd(row.get("check_out_date", ""))
    stay_type = (row.get("stay_type") or "").strip()

    stay_days = (check_out - check_in).days
    if stay_days <= 0:
        stay_days = 1
    if stay_type == "休息房" and check_in == check_out:
        stay_days = 1

    total_cents = to_cents(to_decimal(row.get("total_price")))
    base = total_cents // stay_days
    remainder = total_cents - base * stay_days

    deposit_cents = to_cents(to_decimal(row.get("deposit")))
    prepaid_cents = to_cents(to_decimal(row.get("prepaid_amount")))

    out_rows: list[dict] = []
    for i in range(stay_days):
        stay_date = check_in + timedelta(days=i)
        day_total = base + (1 if i < remainder else 0)
        out_rows.append(
            {
                "order_id": row.get("order_id", ""),
                "id_source": row.get("id_source", ""),
                "order_source": row.get("order_source", ""),
                "guest_name": row.get("guest_name", ""),
                "phone": row.get("phone", ""),
                "room_type": row.get("room_type", ""),
                "room_number": row.get("room_number", ""),
                "check_in_date": row.get("check_in_date", ""),
                "check_out_date": row.get("check_out_date", ""),
                "stay_date": stay_date.isoformat(),
                "status": row.get("status", ""),
                "payment_method": row.get("payment_method", ""),
                "total_price": cents_to_str(day_total),
                "deposit": cents_to_str(deposit_cents if i == 0 else 0),
                "create_time": row.get("create_time", ""),
                "stay_type": row.get("stay_type", ""),
                "remarks": row.get("remarks", ""),
                "is_prepaid": row.get("is_prepaid", ""),
                "prepaid_amount": cents_to_str(prepaid_cents if i == 0 else 0),
            }
        )

    if sum(to_cents(to_decimal(r["total_price"])) for r in out_rows) != total_cents:
        raise ValueError(f"price split mismatch for order_id={row.get('order_id')!r}")
    return out_rows


def transform_csv(input_path: str, output_path: str) -> SplitStats:
    input_rows = 0
    output_rows = 0
    input_total_cents = 0
    output_total_cents = 0

    with open(input_path, "r", encoding="utf-8", newline="") as f_in:
        reader = csv.DictReader(f_in)
        with open(output_path, "w", encoding="utf-8", newline="") as f_out:
            writer = csv.DictWriter(
                f_out,
                fieldnames=OUTPUT_FIELDS,
                extrasaction="ignore",
                lineterminator="\n",
            )
            writer.writeheader()

            for row in reader:
                input_rows += 1
                input_total_cents += to_cents(to_decimal(row.get("total_price")))
                out = split_row(row)
                for out_row in out:
                    output_rows += 1
                    output_total_cents += to_cents(to_decimal(out_row.get("total_price")))
                    writer.writerow(out_row)

    return SplitStats(
        input_rows=input_rows,
        output_rows=output_rows,
        input_total_cents=input_total_cents,
        output_total_cents=output_total_cents,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Split sql/orders.csv into daily rows (one stay_date per row).")
    parser.add_argument("--in", dest="input_path", default="sql/orders.csv")
    parser.add_argument("--out", dest="output_path", default="sql/orders.csv")
    parser.add_argument("--tmp", dest="tmp_path", default="")
    args = parser.parse_args()

    input_path = args.input_path
    output_path = args.output_path
    tmp_path = args.tmp_path or f"{output_path}.tmp"

    if not os.path.exists(input_path):
        raise SystemExit(f"input not found: {input_path}")

    stats = transform_csv(input_path=input_path, output_path=tmp_path)

    if stats.input_total_cents != stats.output_total_cents:
        raise SystemExit(
            f"sum mismatch: input_total={stats.input_total_cents}c output_total={stats.output_total_cents}c"
        )

    os.replace(tmp_path, output_path)
    print(
        f"ok: {stats.input_rows} orders -> {stats.output_rows} daily rows; "
        f"total_price sum kept: {stats.input_total_cents}c"
    )


if __name__ == "__main__":
    main()
