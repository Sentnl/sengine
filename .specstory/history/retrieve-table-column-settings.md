## SpecStory

## Retrieve Table Column Settings (15/01/2025, 12:04:35)

_**User**_

hw can I get the currently colum,n settings for a table?

---

_**Assistant**_

To get the current column settings for a table in PostgreSQL, you can use the `pg` library to query the table schema. Here's how you can do it:

```javascript:src/models/db.js
// ... existing code ...

export const getTableSchema = async (tableName) => {
  const pool = getDatabase();
  const query = `
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = $1
  `;
  const result = await pool.query(query, [tableName]);
  return result.rows;
};

// ... existing code ...
```

This function will return the column names, data types, nullability, and default values for the specified table. Just call it with the table name you want to inspect.

---



---

