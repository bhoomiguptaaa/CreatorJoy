import asyncio
import sys
from pathlib import Path
import asyncpg

# Add the parent directory to Python path to import app config
sys.path.append(str(Path(__file__).parent.parent))

from app.config import settings

async def main():
    print(f"Connecting to database at: {settings.database_url.split('@')[-1]}...")
    try:
        conn = await asyncpg.connect(settings.database_url)
    except Exception as e:
        print(f"\nError: Could not connect to the database. Make sure your DATABASE_URL in .env is correct.\nDetail: {e}")
        sys.exit(1)
        
    try:
        # Enable required Postgres extensions
        print("Enabling vector and pgcrypto extensions...")
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        await conn.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
        
        # Paths to migration SQL files
        migrations_dir = Path(__file__).parent.parent / "migrations"
        migration_files = sorted(migrations_dir.glob("*.sql"))
        
        if not migration_files:
            print("No migration files found in migrations directory.")
            return

        for migration_file in migration_files:
            print(f"Running migration {migration_file.name}...")
            sql = migration_file.read_text(encoding="utf-8")
            
            # Execute SQL
            await conn.execute(sql)
            print(f"✓ Migration {migration_file.name} completed successfully.")
            
        print("\nAll database migrations applied successfully!")
    except Exception as e:
        print(f"\nMigration failed: {e}")
        sys.exit(1)
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
