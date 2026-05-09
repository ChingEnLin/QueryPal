import re

query = "db['my_col'].update_many({'a': 1}, {'$set': {'a': 2}})"
col_match = re.search(r"db\[['\"]([^'\"]+)['\"]\]\.", query)
if col_match:
    collection = col_match.group(1)
else:
    col_match = re.search(r"db\.([a-zA-Z0-9_]+)\.", query)
    collection = col_match.group(1) if col_match else "unknown"
print("Collection:", collection)
