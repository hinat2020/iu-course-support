"""Extract reviewed PDF table ranges; never fuzzy-match or update course master.

Run with the official PDF path and repository root. pdfplumber is an offline
build-time extraction tool, not an application dependency.
"""
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path
import pdfplumber

# Explicitly reviewed 1-based PDF ranges. No name-based automatic assignment.
MATCHES = {
    "innovation-spirit": (1, 5), "business-introduction": (6, 7),
    "english-core-skills-1": (10, 11), "english-core-skills-2": (12, 13),
    "esports": (14, 17), "study-skills": (23, 24),
    "basic-mathematics": (25, 26), "social-research-methods": (27, 28),
    "management-foundations": (29, 29), "marketing-foundations": (37, 38),
    "market-innovation": (39, 40), "accounting-introduction": (41, 42),
    "corporate-law-basics": (49, 50), "ict-introduction": (53, 54),
    "programming-fundamentals-practicum": (55, 56),
    "prototyping-practicum": (57, 60), "computer-architecture": (61, 62),
    "operating-systems-intro": (63, 64), "data-structures-and-processing": (65, 66),
    "applied-information-mathematics-a": (67, 68),
    "applied-information-mathematics-b": (69, 70), "database": (73, 74),
    "design-introduction": (82, 83), "interaction-design-intro": (84, 84),
    "network-technology": (91, 92), "project-introduction": (105, 106),
    "business-english-practicum-1a": (160, 162),
    "business-english-practicum-1b": (163, 165),
    "business-english-practicum-2a": (166, 168),
    "business-english-practicum-2b": (169, 171),
}

def text(value):
    if value is None:
        return ""
    # Normalize PDF-only CJK glyphs and half-width kana without collapsing
    # meaningful Roman numerals such as Ⅰ / Ⅱ into ASCII I / II.
    normalized = "".join(
        unicodedata.normalize("NFKC", c)
        if 0x2E80 <= ord(c) <= 0x2FDF or 0xFF61 <= ord(c) <= 0xFF9F
        else c
        for c in value
    )
    return unicodedata.normalize("NFC", normalized).strip()

def key(value):
    return re.sub(r"\s+", "", text(value))

FIELDS = {
    "担当教員": "instructor", "授業概要": "overview",
    "授業の目的・到達目標": "objectives", "成績評価の方法": "grading",
    "準備学修（予習・復習、課題等）": "preparation", "教科書": "textbooks",
    "参考書": "references", "備考": "notes", "昨年度からの振り返り": "previousYearReflection",
}
HEADER = {"配当学年": "grade", "学期": "semester", "科目分類": "category",
          "授業科目名": "courseName", "授業形態": "classFormat", "授業コード": "courseCode",
          "単位数": "credits", "必修・選択の別": "requiredElective", "アクティブ・ラーニング": "activeLearning"}

def extract(pdf, start, end):
    result = {name: None for name in [*HEADER.values(), *FIELDS.values()]}
    result.update(academicYear=2026, lessonPlan=[])
    current = None
    pending_lesson_fragments = []
    pending_grading_fragments = []

    def flush_lesson_fragments(next_number=None):
        nonlocal pending_lesson_fragments
        if not pending_lesson_fragments or not result["lessonPlan"]:
            pending_lesson_fragments = []
            return
        last_number = result["lessonPlan"][-1]["number"]
        missing_count = max(0, (next_number or last_number + 1) - last_number - 1)
        for offset in range(missing_count):
            fragment = pending_lesson_fragments.pop(0) if pending_lesson_fragments else None
            result["lessonPlan"].append({"number": last_number + offset + 1, "topic": None, "content": fragment})
        if pending_lesson_fragments:
            last = result["lessonPlan"][-1]
            joined = "\n".join(pending_lesson_fragments)
            last["content"] = "\n".join(filter(None, [last["content"], joined])) or None
        pending_lesson_fragments = []

    def flush_grading_fragments(next_field=None):
        nonlocal pending_grading_fragments
        if not pending_grading_fragments:
            return
        joined = "\n".join(pending_grading_fragments)
        if next_field == "textbooks" and result["preparation"] is None:
            result["preparation"] = joined
        else:
            result["grading"] = "\n".join(filter(None, [result["grading"], joined])) or None
        pending_grading_fragments = []

    for page_number in range(start, end + 1):
        tables = pdf.pages[page_number - 1].extract_tables()
        if not tables:
            continuation = text(pdf.pages[page_number - 1].extract_text())
            if continuation:
                if current == "lessonPlan":
                    pending_lesson_fragments.append(continuation)
                elif current:
                    result[current] = "\n".join(filter(None, [result[current], continuation])) or None
            continue
        for table in tables:
            for row in table:
                first_cell = text(row[0]) if row else ""
                cells = [text(cell) for cell in row if cell is not None]
                if not cells:
                    continue
                label = key(first_cell)
                if label in ("授業年度", "授業科目名", "授業コード"):
                    for i, cell in enumerate(cells[:-1]):
                        if key(cell) in HEADER:
                            result[HEADER[key(cell)]] = cells[i + 1] or None
                    continue
                if label == "授業計画":
                    current = None
                    continue
                content = "\n".join(text(cell) for cell in row[1:] if text(cell)).strip()
                if re.fullmatch(r"第\d+回", label):
                    number = int(re.search(r"\d+", label)[0])
                    flush_lesson_fragments(number)
                    result["lessonPlan"].append({"number": number, "topic": None, "content": content or None})
                    current = "lessonPlan"
                elif label in FIELDS:
                    next_field = FIELDS[label]
                    if current == "lessonPlan" and next_field == "preparation" and result["grading"] is None and pending_lesson_fragments:
                        result["grading"] = "\n".join(pending_lesson_fragments)
                        pending_lesson_fragments = []
                    else:
                        flush_lesson_fragments()
                    flush_grading_fragments(next_field)
                    current = next_field
                    result[current] = content or None
                elif current == "textbooks":
                    # Preserve book-table column labels rather than losing attribution.
                    if label == "書名":
                        continue
                    columns = ["書名", "著者", "出版社", "ISBN", "備考"]
                    book = "\n".join(f"{columns[i] if i < len(columns) else '補足'}：{cell}" for i, cell in enumerate(cells) if cell)
                    result[current] = "\n\n".join(filter(None, [result[current], book])) or None
                elif not label and content:
                    if current == "lessonPlan":
                        embedded_number = re.match(r"第(\d+)回(?:\s|$)", content)
                        if embedded_number:
                            number = int(embedded_number.group(1))
                            flush_lesson_fragments(number)
                            result["lessonPlan"].append({"number": number, "topic": None, "content": content})
                        else:
                            pending_lesson_fragments.append(content)
                    elif current == "grading":
                        pending_grading_fragments.append(content)
                    elif current:
                        result[current] = (result[current] or "") + "\n" + content
                elif any(cells):
                    raise ValueError(f"Unrecognized row at page {page_number}: {cells[:2]}")
    flush_lesson_fragments()
    flush_grading_fragments()
    raw_credit = result["credits"]
    result["credits"] = float(raw_credit.replace("単位", "")) if raw_credit else None
    return result

source, root = Path(sys.argv[1]), Path(sys.argv[2])
catalog = json.loads((root / "src/data/2026/courses.json").read_text(encoding="utf-8"))
output = {}
audit = []
digest = hashlib.sha256(source.read_bytes()).hexdigest()
with pdfplumber.open(source) as pdf:
    for course in catalog:
        cid = course["id"]
        if cid not in MATCHES:
            lecture = cid.startswith("innovation-lecture-")
            audit.append({"courseId": cid, "courseName": course["name"], "status": "ambiguous" if lecture else "unmatched",
                          "pages": [111, 112] if lecture else list(range(113, 154)),
                          "reason": "a／b共通項目・2単位の記載と各1単位のマスタの対応、クラス別適用範囲が未確定。自動紐付けしない。" if lecture else "技法a/bそれぞれの通常シラバス項目なし。個別講座・イベントのシラバスをa/bへ転用しない。"})
            continue
        start, end = MATCHES[cid]
        record = extract(pdf, start, end)
        record["source"] = {"type": "official_syllabus", "academicYear": 2026, "documentName": source.name,
                            "pages": list(range(start, end + 1)), "sha256": digest}
        output[cid] = record
        audit.append({"courseId": cid, "courseName": course["name"], "status": "matched", "pages": record["source"]["pages"],
                      "pdfCourseName": record["courseName"], "courseCode": record["courseCode"],
                      "masterCredits": course["credits"], "pdfCredits": record["credits"],
                      "masterSemester": course["semester"], "pdfSemester": record["semester"],
                      "masterRequirementType": course["requirementType"], "pdfRequiredElective": record["requiredElective"]})
        print(cid, record["courseName"], len(record["lessonPlan"]))
(root / "src/data/2026/syllabus.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
(root / "src/data/2026/syllabus-audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
