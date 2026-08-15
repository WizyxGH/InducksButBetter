import sqlite3
import json

db = sqlite3.connect('temp.sqlite')
def query(sql, args=()):
    cursor = db.cursor()
    cursor.execute(sql, args)
    return [dict(zip([col[0] for col in cursor.description], row)) for row in cursor.fetchall()]

print(json.dumps({
    "issue": query("SELECT * FROM inducks_issue WHERE issuecode LIKE 'fr/JMAG%1'"),
}, indent=2))
