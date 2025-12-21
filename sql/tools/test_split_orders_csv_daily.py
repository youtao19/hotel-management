#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import csv
import tempfile
from pathlib import Path

from split_orders_csv_daily import OUTPUT_FIELDS, transform_csv


SAMPLE_INPUT_HEADER = [
    "order_id",
    "id_source",
    "order_source",
    "guest_name",
    "phone",
    "room_type",
    "room_number",
    "check_in_date",
    "check_out_date",
    "status",
    "payment_method",
    "total_price",
    "deposit",
    "create_time",
    "stay_type",
    "remarks",
    "is_prepaid",
    "prepaid_amount",
    "prepaid_at",
]


def read_rows(path: Path) -> list[dict]:
    with open(path, "r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def main() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        input_csv = tmp / "orders.input.csv"
        output_csv = tmp / "orders.output.csv"

        with open(input_csv, "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=SAMPLE_INPUT_HEADER, lineterminator="\n")
            w.writeheader()
            w.writerow(
                {
                    "order_id": "O_TEST_MULTI",
                    "id_source": "",
                    "order_source": "front_desk",
                    "guest_name": "张三",
                    "phone": "13000000000",
                    "room_type": "asu_xiao_zhu",
                    "room_number": "101",
                    "check_in_date": "2025-01-01",
                    "check_out_date": "2025-01-04",
                    "status": "checked-out",
                    "payment_method": "现金",
                    "total_price": "100.00",
                    "deposit": "50.00",
                    "create_time": "2025-01-01 12:00:00.000000",
                    "stay_type": "客房",
                    "remarks": "",
                    "is_prepaid": "false",
                    "prepaid_amount": "0.00",
                    "prepaid_at": "",
                }
            )
            w.writerow(
                {
                    "order_id": "O_TEST_SINGLE",
                    "id_source": "",
                    "order_source": "meituan",
                    "guest_name": "李四",
                    "phone": "",
                    "room_type": "bo_ye_shuang",
                    "room_number": "208",
                    "check_in_date": "2025-02-10",
                    "check_out_date": "2025-02-11",
                    "status": "checked-in",
                    "payment_method": "平台",
                    "total_price": "80.50",
                    "deposit": "0.00",
                    "create_time": "2025-02-10 08:00:00.000000",
                    "stay_type": "客房",
                    "remarks": "",
                    "is_prepaid": "false",
                    "prepaid_amount": "0.00",
                    "prepaid_at": "",
                }
            )
            w.writerow(
                {
                    "order_id": "O_TEST_REST",
                    "id_source": "",
                    "order_source": "front_desk",
                    "guest_name": "王五",
                    "phone": "",
                    "room_type": "yi_jiang_nan",
                    "room_number": "305",
                    "check_in_date": "2025-03-05",
                    "check_out_date": "2025-03-05",
                    "status": "checked-out",
                    "payment_method": "微邮付",
                    "total_price": "99.99",
                    "deposit": "20.00",
                    "create_time": "2025-03-05 09:00:00.000000",
                    "stay_type": "休息房",
                    "remarks": "【休息房】",
                    "is_prepaid": "true",
                    "prepaid_amount": "99.99",
                    "prepaid_at": "2025-03-05 09:00:00.000000",
                }
            )

        stats = transform_csv(str(input_csv), str(output_csv))
        assert stats.input_rows == 3
        assert stats.output_rows == 5  # 3晚 -> 3行，其余各1行
        assert stats.input_total_cents == stats.output_total_cents

        rows = read_rows(output_csv)
        assert list(rows[0].keys()) == OUTPUT_FIELDS

        multi = [r for r in rows if r["order_id"] == "O_TEST_MULTI"]
        assert [r["stay_date"] for r in multi] == ["2025-01-01", "2025-01-02", "2025-01-03"]
        assert [r["total_price"] for r in multi] == ["33.34", "33.33", "33.33"]
        assert [r["deposit"] for r in multi] == ["50.00", "0.00", "0.00"]
        assert [r["prepaid_amount"] for r in multi] == ["0.00", "0.00", "0.00"]

        rest = [r for r in rows if r["order_id"] == "O_TEST_REST"][0]
        assert rest["stay_date"] == "2025-03-05"
        assert rest["total_price"] == "99.99"
        assert rest["deposit"] == "20.00"
        assert rest["prepaid_amount"] == "99.99"

        print("ok: sample cases passed")


if __name__ == "__main__":
    main()

