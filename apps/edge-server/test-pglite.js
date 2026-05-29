const { PGlite } = require('@electric-sql/pglite');

async function test() {
  try {
    const db = new PGlite('./yparenaos-db');
    console.log('Connected to PGLite');
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS test_users (
        user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL
      );
    `);
    console.log('Created table');
    
    const res = await db.query(
      `INSERT INTO test_users (email) VALUES ($1) RETURNING *`,
      ['test@example.com']
    );
    console.log('Inserted user:', res.rows[0]);
    
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
