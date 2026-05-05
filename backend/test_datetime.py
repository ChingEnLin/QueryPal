from datetime import datetime

dt_str = "2026-03-12T10:00"
if len(dt_str) == 10:
    dt_str += "T00:00:00"
if "Z" not in dt_str and "+" not in dt_str[-6:] and "-" not in dt_str[-6:]:
    dt_str += "Z"

print(dt_str)
print(datetime.fromisoformat(dt_str.replace("Z", "+00:00")))
