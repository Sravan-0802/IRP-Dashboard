from pathlib import Path

import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils.dataframe import dataframe_to_rows
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

ROOT = Path(__file__).resolve().parents[2]
EXPORTS = ROOT / "exports"
STAMP = "2026-11-11"
PREFIX = f"IRP-Dashboard-Visitors-from-Oct-2026-{STAMP}"
OUT = EXPORTS / f"{PREFIX}.xlsx"

daily_uid = pd.read_csv(EXPORTS / f"{PREFIX}-Daily-UID.csv")
weekly_uid = pd.read_csv(EXPORTS / f"{PREFIX}-Weekly-UID.csv")
daily_sum = pd.read_csv(EXPORTS / f"{PREFIX}-Daily-Summary.csv")
weekly_sum = pd.read_csv(EXPORTS / f"{PREFIX}-Weekly-Summary.csv")

HEADER_FILL = PatternFill("solid", fgColor="1F4E79")
HEADER_FONT = Font(bold=True, color="FFFFFF")
TITLE_FONT = Font(bold=True, size=16, color="1F4E79")
SUB_FONT = Font(bold=True, size=12, color="1F4E79")
THIN = Border(
    left=Side(style="thin", color="D9D9D9"),
    right=Side(style="thin", color="D9D9D9"),
    top=Side(style="thin", color="D9D9D9"),
    bottom=Side(style="thin", color="D9D9D9"),
)
ALT = PatternFill("solid", fgColor="F2F7FB")
NUM_FMT = "#,##0"


def style_header(ws, ncols):
    for col in range(1, ncols + 1):
        cell = ws.cell(1, col)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center")


def autosize(ws, min_width=10, max_width=42):
    for col in ws.columns:
        letter = get_column_letter(col[0].column)
        width = min_width
        for cell in col:
            if cell.value is None:
                continue
            width = max(width, min(max_width, len(str(cell.value)) + 2))
        ws.column_dimensions[letter].width = width


def write_table(ws, df, table_name):
    for r_idx, row in enumerate(dataframe_to_rows(df, index=False, header=True), start=1):
        for c_idx, value in enumerate(row, start=1):
            cell = ws.cell(r_idx, c_idx, value)
            cell.border = THIN
            if r_idx == 1:
                continue
            if r_idx % 2 == 0:
                cell.fill = ALT
            if isinstance(value, (int, float)) and not pd.isna(value):
                cell.number_format = NUM_FMT
    style_header(ws, df.shape[1])
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(df.shape[1])}{df.shape[0] + 1}"
    table = Table(
        displayName=table_name,
        ref=f"A1:{get_column_letter(df.shape[1])}{df.shape[0] + 1}",
    )
    table.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True)
    ws.add_table(table)
    autosize(ws)
    ws.row_dimensions[1].height = 22


wb = Workbook()

# Overview
ws = wb.active
ws.title = "Overview"
ws["A1"] = "IRP Dashboard visitors"
ws["A1"].font = TITLE_FONT
ws["A2"] = "From 1 Oct 2026 IST through 11 Nov 2026 IST"
ws["A2"].font = Font(italic=True, color="666666")
ws["A4"] = "Metric"
ws["B4"] = "Value"
style_header(ws, 2)

unique_uids = int(daily_uid["user_id"].nunique())
total_visits = int(daily_sum["visit_count"].sum())
metrics = [
    ("Period start (IST)", "2026-10-01"),
    ("Period end (IST)", "2026-11-11"),
    ("Days with visits", int(len(daily_sum))),
    ("ISO weeks", int(len(weekly_sum))),
    ("Unique UIDs", unique_uids),
    ("Total visits (dashboard sessions)", total_visits),
    ("Daily UID rows (date × uid)", int(len(daily_uid))),
    ("Weekly UID rows (week × uid)", int(len(weekly_uid))),
]
for i, (label, value) in enumerate(metrics, start=5):
    ws.cell(i, 1, label).border = THIN
    cell = ws.cell(i, 2, value)
    cell.border = THIN
    if isinstance(value, int):
        cell.number_format = NUM_FMT
    if i % 2 == 0:
        ws.cell(i, 1).fill = ALT
        cell.fill = ALT

ws["A14"] = "Weekly totals"
ws["A14"].font = SUB_FONT
headers = ["iso_year", "iso_week", "week_start_ist", "week_end_ist", "unique_uids", "visit_count"]
for c, h in enumerate(headers, start=1):
    cell = ws.cell(15, c, h)
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.alignment = Alignment(horizontal="center")
    cell.border = THIN
for r, row in enumerate(weekly_sum.itertuples(index=False), start=16):
    for c, value in enumerate(row, start=1):
        cell = ws.cell(r, c, value)
        cell.border = THIN
        if isinstance(value, (int, float)):
            cell.number_format = NUM_FMT
        if r % 2 == 0:
            cell.fill = ALT

ws["A24"] = "Notes"
ws["A24"].font = SUB_FONT
ws["A25"] = "One visit = one dashboard_visit event (one browser session)."
ws["A26"] = "Dates and weeks are Asia/Kolkata (IST)."
ws["A27"] = "Weeks are ISO (Monday–Sunday). W40 unique/visit counts include only 1–4 Oct."
ws["A28"] = "Daily UID / Weekly UID sheets are the uid-level counts."
ws.column_dimensions["A"].width = 38
ws.column_dimensions["B"].width = 18
ws.column_dimensions["C"].width = 16
ws.column_dimensions["D"].width = 16
ws.column_dimensions["E"].width = 14
ws.column_dimensions["F"].width = 14

daily_uid_sheet = wb.create_sheet("Daily UID")
write_table(daily_uid_sheet, daily_uid, "DailyUID")

weekly_uid_sheet = wb.create_sheet("Weekly UID")
write_table(weekly_uid_sheet, weekly_uid, "WeeklyUID")

daily_sum_sheet = wb.create_sheet("Daily Summary")
write_table(daily_sum_sheet, daily_sum, "DailySummary")

weekly_sum_sheet = wb.create_sheet("Weekly Summary")
write_table(weekly_sum_sheet, weekly_sum, "WeeklySummary")

wb.save(OUT)
print(str(OUT))
print(f"unique_uids={unique_uids} visits={total_visits} daily_uid={len(daily_uid)} weekly_uid={len(weekly_uid)}")
