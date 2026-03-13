from app.db.database import engine
from sqlalchemy import MetaData
from sqlalchemy.schema import CreateTable

def dump_schema():
    print("Reflecting database schema...")
    metadata = MetaData()
    metadata.reflect(bind=engine)
    
    output_file = "full_schema.sql"
    with open(output_file, "w", encoding="utf-8") as f:
        for table in metadata.sorted_tables:
            # Generate CREATE TABLE statement
            create_stmt = str(CreateTable(table).compile(engine)).strip()
            f.write(create_stmt + ";\n\n")
            
    print(f"Schema successfully dumped to: {output_file}")

if __name__ == "__main__":
    dump_schema()
