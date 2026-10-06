from pathlib import Path
import pandas as pd
import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import execute_values
import numpy as np
import logging
import os
import glob
import zipfile
import subprocess

load_dotenv(Path(__file__).resolve().parents[3] / ".env")

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def create_database_if_not_exists(db_params):
    """Create the database if it doesn't exist"""
    # Connect to PostgreSQL server without specifying a database
    conn_params = db_params.copy()

    # Use 'postgres' as the default database to connect to
    conn_params['database'] = 'postgres'

    try:
        # Connect to the default database
        conn = psycopg2.connect(**conn_params)
        conn.autocommit = True  # Set autocommit to create database
        cur = conn.cursor()

        # Check if the database exists
        cur.execute(f"SELECT 1 FROM pg_database WHERE datname = '{db_params['database']}'")
        exists = cur.fetchone()

        # If database doesn't exist, create it
        if not exists:
            logger.info(f"Database '{db_params['database']}' does not exist. Creating...")

            # Escape the database name to prevent SQL injection
            db_name = db_params['database'].replace("'", "''")
            cur.execute(f"CREATE DATABASE {db_name}")

            logger.info(f"Database '{db_params['database']}' created successfully.")
        else:
            logger.info(f"Database '{db_params['database']}' already exists.")

        # Close connection to default database
        cur.close()
        conn.close()

    except Exception as e:
        logger.error(f"Error creating database: {e}")
        raise


def connect_to_postgres(db_params):
    """Connect to PostgreSQL database"""
    try:
        conn = psycopg2.connect(**db_params)
        logger.info("Successfully connected to PostgreSQL database")
        return conn
    except Exception as e:
        logger.error(f"Error connecting to PostgreSQL database: {e}")
        raise


def create_tables(conn):
    """Create dimension and fact tables for star schema"""
    with conn.cursor() as cur:
        try:
            # Create dimension tables
            cur.execute("""
            CREATE TABLE IF NOT EXISTS dim_date (
                date_id SERIAL PRIMARY KEY,
                full_date DATE NOT NULL,
                UNIQUE(full_date)
            )
            """)

            # Create global location table
            cur.execute("""
            CREATE TABLE IF NOT EXISTS dim_global_location (
                global_location_id SERIAL PRIMARY KEY,
                iso3 CHAR(3) NOT NULL,
                country VARCHAR(200) NOT NULL,
                subregion VARCHAR(200),
                region VARCHAR(200),
                UNIQUE(iso3)
            )
            """)

            # Create specific location table
            cur.execute("""
            CREATE TABLE IF NOT EXISTS dim_spez_location (
                spez_location_id SERIAL PRIMARY KEY,
                iso3 CHAR(3) NOT NULL,
                city VARCHAR(200),
                administrative_region VARCHAR(200),
                UNIQUE(iso3, city, administrative_region),
                FOREIGN KEY (iso3) REFERENCES dim_global_location(iso3)
            )
            """)

            cur.execute("""
            CREATE TABLE IF NOT EXISTS dim_drug (
                drug_id SERIAL PRIMARY KEY,
                drug_substance VARCHAR(200) NOT NULL,
                measurement_unit VARCHAR(200),
                UNIQUE(drug_substance, measurement_unit)
            )
            """)

            cur.execute("""
            CREATE TABLE IF NOT EXISTS dim_transportation (
                transport_id SERIAL PRIMARY KEY,
                transportation_mode VARCHAR(200),
                physical_seizure_location VARCHAR(200),
                UNIQUE(transportation_mode, physical_seizure_location)
            )
            """)

            cur.execute("""
            CREATE TABLE IF NOT EXISTS dim_source (
                source_id SERIAL PRIMARY KEY,
                source VARCHAR(200),
                reporting_channel VARCHAR(200),
                UNIQUE(source, reporting_channel)
            )
            """)

            # Create fact table
            cur.execute("""
            CREATE TABLE IF NOT EXISTS fact_seizures (
                seizure_id SERIAL PRIMARY KEY,
                date_id INT REFERENCES dim_date(date_id),
                global_location_id INT REFERENCES dim_global_location(global_location_id),
                spez_location_id INT REFERENCES dim_spez_location(spez_location_id),
                drug_id INT REFERENCES dim_drug(drug_id),
                transport_id INT REFERENCES dim_transportation(transport_id),
                source_id INT REFERENCES dim_source(source_id),
                quantity FLOAT
            )
            """)

            # Create staging table
            cur.execute("""
            CREATE TABLE IF NOT EXISTS staging_seizures (
                seizure_date DATE,
                country VARCHAR(200),
                iso3 CHAR(3),
                subregion VARCHAR(200),
                region VARCHAR(200),
                drug_substance VARCHAR(200),
                quantity FLOAT,
                measurement_unit VARCHAR(200),
                city VARCHAR(200),
                administrative_region VARCHAR(200),
                physical_seizure_location VARCHAR(200),
                transportation_mode VARCHAR(200),
                source VARCHAR(200),
                reporting_channel VARCHAR(200),
                file_name VARCHAR(200)
            )
            """)

            conn.commit()
            logger.info("Successfully created all tables")
        except Exception as e:
            conn.rollback()
            logger.error(f"Error creating tables: {e}")
            raise


def load_csvs_to_staging(conn, csv_folder):
    """Load multiple CSV files from a folder into staging table"""
    try:
        # Get list of all CSV files in the folder
        csv_files = glob.glob(os.path.join(csv_folder, "*.csv"))
        logger.info(f"Found {len(csv_files)} CSV files in folder: {csv_folder}")

        if not csv_files:
            logger.warning(f"No CSV files found in {csv_folder}")
            return

        # Clear staging table
        with conn.cursor() as cur:
            cur.execute("TRUNCATE TABLE staging_seizures")
            conn.commit()

        # Process each CSV file
        for csv_file in csv_files:
            file_name = os.path.basename(csv_file)
            logger.info(f"Processing file: {file_name}")

            # Read CSV file
            df = pd.read_csv(csv_file)
            logger.info(f"File {file_name} loaded with {len(df)} rows")

            # Handle potential NaN values
            df = df.replace({np.nan: None})

            # Convert date string to proper date format
            df['Seizure Date'] = pd.to_datetime(df['Seizure Date']).dt.date

            with conn.cursor() as cur:
                # Prepare data for insertion
                cols = [
                    'seizure_date', 'country', 'iso3', 'subregion', 'region',
                    'drug_substance', 'quantity', 'measurement_unit', 'city',
                    'administrative_region', 'physical_seizure_location',
                    'transportation_mode', 'source', 'reporting_channel', 'file_name'
                ]

                # Map DataFrame columns to table columns
                data = [
                    (
                        row['Seizure Date'],
                        row['Country/Territory of Seizure'],
                        row['ISO3'],
                        row['Subregion'],
                        row['Region'],
                        row['Drug/Substance'],
                        row['Quantity Seized'],
                        row['Measurement Unit'],
                        row['City'],
                        row['Administrative Region'],
                        row['Physical Seizure Location'],
                        row['Trafficking Mode of Transportation'],
                        row['Source'],
                        row['Reporting Channel'],
                        file_name
                    )
                    for _, row in df.iterrows()
                ]

                # Bulk insert
                insert_query = f"""
                INSERT INTO staging_seizures ({', '.join(cols)})
                VALUES %s
                """
                execute_values(cur, insert_query, data)

                conn.commit()
                logger.info(f"Successfully loaded {len(df)} rows from {file_name} into staging table")

        # Get total count from staging table
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM staging_seizures")
            total_count = cur.fetchone()[0]
            logger.info(f"Total of {total_count} rows loaded into staging table from all files")

    except Exception as e:
        conn.rollback()
        logger.error(f"Error loading CSVs to staging: {e}")
        raise


def populate_dimension_tables(conn):
    """Populate all dimension tables from staging data"""
    try:
        with conn.cursor() as cur:
            # Populate dim_date
            cur.execute("""
            INSERT INTO dim_date (full_date)
            SELECT DISTINCT 
                seizure_date
            FROM staging_seizures
            ON CONFLICT (full_date) DO NOTHING
            """)

            # Populate dim_global_location
            cur.execute("""
            INSERT INTO dim_global_location (iso3, country, subregion, region)
            SELECT DISTINCT 
                iso3,
                country,
                subregion,
                region
            FROM staging_seizures
            WHERE iso3 IS NOT NULL
            ON CONFLICT (iso3) DO NOTHING
            """)

            # Populate dim_spez_location
            cur.execute("""
            INSERT INTO dim_spez_location (iso3, city, administrative_region)
            SELECT DISTINCT 
                iso3,
                city,
                administrative_region
            FROM staging_seizures
            WHERE iso3 IS NOT NULL
            ON CONFLICT (iso3, city, administrative_region) DO NOTHING
            """)

            # Populate dim_drug
            cur.execute("""
            INSERT INTO dim_drug (drug_substance, measurement_unit)
            SELECT DISTINCT 
                drug_substance,
                measurement_unit
            FROM staging_seizures
            ON CONFLICT (drug_substance, measurement_unit) DO NOTHING
            """)

            # Populate dim_transportation
            cur.execute("""
            INSERT INTO dim_transportation (transportation_mode, physical_seizure_location)
            SELECT DISTINCT 
                transportation_mode,
                physical_seizure_location
            FROM staging_seizures
            ON CONFLICT (transportation_mode, physical_seizure_location) DO NOTHING
            """)

            # Populate dim_source
            cur.execute("""
            INSERT INTO dim_source (source, reporting_channel)
            SELECT DISTINCT 
                source,
                reporting_channel
            FROM staging_seizures
            ON CONFLICT (source, reporting_channel) DO NOTHING
            """)

            conn.commit()
            logger.info("Successfully populated all dimension tables")
    except Exception as e:
        conn.rollback()
        logger.error(f"Error populating dimension tables: {e}")
        raise


def populate_fact_table(conn):
    """Populate fact table by joining dimension tables with staging data using a more efficient approach"""
    try:
        # Create temporary table with dimension keys
        with conn.cursor() as cur:
            # Create temporary table to hold the dimension keys
            cur.execute("""
            CREATE TEMPORARY TABLE temp_fact_keys AS
            SELECT
                stg.seizure_date,
                stg.iso3,
                stg.city,
                stg.administrative_region,
                stg.drug_substance,
                stg.measurement_unit,
                stg.transportation_mode,
                stg.physical_seizure_location,
                stg.source,
                stg.reporting_channel,
                stg.quantity,
                d.date_id,
                gl.global_location_id,
                sl.spez_location_id,
                dr.drug_id,
                t.transport_id,
                s.source_id
            FROM 
                staging_seizures stg
            LEFT JOIN 
                dim_date d ON stg.seizure_date = d.full_date
            LEFT JOIN 
                dim_global_location gl ON stg.iso3 = gl.iso3
            LEFT JOIN 
                dim_spez_location sl ON stg.iso3 = sl.iso3
                    AND COALESCE(stg.city, '') = COALESCE(sl.city, '')
                    AND COALESCE(stg.administrative_region, '') = COALESCE(sl.administrative_region, '')
            LEFT JOIN 
                dim_drug dr ON stg.drug_substance = dr.drug_substance
                    AND COALESCE(stg.measurement_unit, '') = COALESCE(dr.measurement_unit, '')
            LEFT JOIN 
                dim_transportation t ON COALESCE(stg.transportation_mode, '') = COALESCE(t.transportation_mode, '')
                    AND COALESCE(stg.physical_seizure_location, '') = COALESCE(t.physical_seizure_location, '')
            LEFT JOIN 
                dim_source s ON COALESCE(stg.source, '') = COALESCE(s.source, '')
                    AND COALESCE(stg.reporting_channel, '') = COALESCE(s.reporting_channel, '')
            """)
            conn.commit()

            # Create indexes on the temporary table to speed up the next operations
            cur.execute("CREATE INDEX idx_temp_fact_keys_date_id ON temp_fact_keys(date_id)")
            cur.execute("CREATE INDEX idx_temp_fact_keys_global_location_id ON temp_fact_keys(global_location_id)")
            cur.execute("CREATE INDEX idx_temp_fact_keys_spez_location_id ON temp_fact_keys(spez_location_id)")
            cur.execute("CREATE INDEX idx_temp_fact_keys_drug_id ON temp_fact_keys(drug_id)")
            cur.execute("CREATE INDEX idx_temp_fact_keys_transport_id ON temp_fact_keys(transport_id)")
            cur.execute("CREATE INDEX idx_temp_fact_keys_source_id ON temp_fact_keys(source_id)")
            conn.commit()

            # Log any missing dimension keys
            cur.execute("""
            SELECT COUNT(*) FROM temp_fact_keys 
            WHERE date_id IS NULL OR global_location_id IS NULL OR spez_location_id IS NULL 
               OR drug_id IS NULL OR transport_id IS NULL OR source_id IS NULL
            """)
            result = cur.fetchone()
            missing_keys = 0 if result is None else result[0]
            if missing_keys > 0:
                logger.warning(f"Found {missing_keys} rows with missing dimension keys")

            # Get total count of valid rows
            cur.execute("""
            SELECT COUNT(*) FROM temp_fact_keys 
            WHERE date_id IS NOT NULL 
              AND global_location_id IS NOT NULL 
              AND spez_location_id IS NOT NULL
              AND drug_id IS NOT NULL 
              AND transport_id IS NOT NULL
              AND source_id IS NOT NULL
            """)
            result = cur.fetchone()
            total_rows = 0 if result is None else result[0]

            batch_size = 100000  # Adjust this based on your system's memory

            if total_rows == 0:
                logger.warning("No valid rows found to insert into fact table!")
                return

            logger.info(f"Populating fact table with {total_rows} rows in batches of {batch_size}")

            # Process in batches with execute_values directly from temp table
            offset = 0
            rows_processed = 0

            while offset < total_rows:
                # Get a batch of rows from the temp table
                cur.execute("""
                SELECT 
                    date_id, global_location_id, spez_location_id, 
                    drug_id, transport_id, source_id, quantity
                FROM temp_fact_keys
                WHERE date_id IS NOT NULL 
                  AND global_location_id IS NOT NULL 
                  AND spez_location_id IS NOT NULL
                  AND drug_id IS NOT NULL 
                  AND transport_id IS NOT NULL
                  AND source_id IS NOT NULL
                LIMIT %s OFFSET %s
                """, (batch_size, offset))

                batch = cur.fetchall()
                if not batch:
                    break  # No more rows to process

                # Insert the batch
                execute_values(
                    cur,
                    """
                    INSERT INTO fact_seizures (
                        date_id, global_location_id, spez_location_id, 
                        drug_id, transport_id, source_id, quantity
                    ) VALUES %s
                    """,
                    batch
                )
                conn.commit()

                rows_processed += len(batch)
                logger.info(f"Processed {rows_processed} of {total_rows} rows ({(rows_processed / total_rows) * 100:.1f}%)")

                # Move to the next batch
                offset += batch_size

            # Drop temporary table
            cur.execute("DROP TABLE IF EXISTS temp_fact_keys")
            conn.commit()

            logger.info(f"Successfully populated fact table with {rows_processed} rows")

    except Exception as e:
        conn.rollback()
        logger.error(f"Error populating fact table: {e}")
        raise


def verify_import(conn):
    """Verify the data import by running a few checks"""
    try:
        with conn.cursor() as cur:
            # Check count of rows in staging table
            cur.execute("SELECT COUNT(*) FROM staging_seizures")
            staging_count = cur.fetchone()[0]

            # Check count of rows in fact table
            cur.execute("SELECT COUNT(*) FROM fact_seizures")
            fact_count = cur.fetchone()[0]

            # Get counts of dimension tables
            cur.execute("SELECT COUNT(*) FROM dim_date")
            date_count = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM dim_global_location")
            global_location_count = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM dim_spez_location")
            spez_location_count = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM dim_drug")
            drug_count = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM dim_transportation")
            transport_count = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM dim_source")
            source_count = cur.fetchone()[0]

            logger.info(f"Staging table count: {staging_count}")
            logger.info(f"Fact table count: {fact_count}")
            logger.info(f"Dimension tables counts: Date={date_count}, Global Location={global_location_count}, "
                        f"Specific Location={spez_location_count}, Drug={drug_count}, "
                        f"Transport={transport_count}, Source={source_count}")

            # Verify if staging count matches fact count
            if staging_count == fact_count:
                logger.info("All rows from staging successfully transferred to fact table!")
            else:
                logger.warning(f"Mismatch between staging ({staging_count}) and fact ({fact_count}) table counts.")

            # Sample query to verify the star schema works
            cur.execute("""
            SELECT 
                d.full_date,
                gl.country,
                sl.city,
                dr.drug_substance,
                SUM(f.quantity) as total_quantity,
                dr.measurement_unit
            FROM fact_seizures f
            JOIN dim_date d ON f.date_id = d.date_id
            JOIN dim_global_location gl ON f.global_location_id = gl.global_location_id
            JOIN dim_spez_location sl ON f.spez_location_id = sl.spez_location_id
            JOIN dim_drug dr ON f.drug_id = dr.drug_id
            GROUP BY d.full_date, gl.country, sl.city, dr.drug_substance, dr.measurement_unit
            ORDER BY d.full_date, gl.country
            LIMIT 5
            """)

            sample_results = cur.fetchall()
            logger.info("Sample query results (first 5 rows):")
            for row in sample_results:
                logger.info(row)

            # Show files processed
            cur.execute("""
            SELECT file_name, COUNT(*) as row_count
            FROM staging_seizures
            GROUP BY file_name
            ORDER BY row_count DESC
            """)

            file_counts = cur.fetchall()
            logger.info("Files processed:")
            for file_name, count in file_counts:
                logger.info(f"  {file_name}: {count} rows")

    except Exception as e:
        logger.error(f"Error verifying import: {e}")
        raise


def export_database_to_sql(conn, output_folder, include_staging=True):
    """
    Export the database to SQL file using pg_dump and compress it to a zip file

    Args:
        conn: Database connection
        output_folder: Folder to save the SQL file
        include_staging: If True, include staging table data in the export
    """
    try:
        # Ensure the output directory exists
        os.makedirs(output_folder, exist_ok=True)

        # Get database parameters from environment variables instead of connection
        host = os.getenv("PG_HOST", "localhost")
        dbname = os.getenv("PG_DATABASE")
        user = os.getenv("PG_USER")
        password = os.getenv("PG_PASSWORD")

        # Validate required parameters
        if not all([dbname, user, password]):
            raise ValueError("Missing required database parameters. Ensure PG_DATABASE, PG_USER, and PG_PASSWORD are set.")

        # Determine file name based on whether staging is included
        sql_file_name = f"{dbname}_{'Staging' if include_staging else 'noStaging'}.sql"
        sql_path = os.path.join(output_folder, sql_file_name)

        # Set environment variable for password
        env = os.environ.copy()
        env['PGPASSWORD'] = password

        # Build the pg_dump command
        cmd = [
            'pg_dump', '-p', os.getenv('PG_PORT', '5433'),
            f'--host={host}',
            f'--dbname={dbname}',
            f'--username={user}',
            '--format=p',  # plain text format
            '--create',  # include CREATE DATABASE statement
            '--clean'  # include DROP DATABASE statement
        ]

        # If we're excluding staging data, add a table exclusion
        if not include_staging:
            cmd.append('--exclude-table-data=staging_seizures')

        # Execute pg_dump and write to file
        logger.info(f"Exporting database to {sql_path}")
        with open(sql_path, 'w') as f:
            subprocess.run(cmd, stdout=f, env=env, check=True)

        logger.info(f"Successfully exported database to {sql_path}")

        # Compress the SQL file to a zip archive
        zip_file_name = f"{dbname}_{'Staging' if include_staging else 'noStaging'}.zip"
        zip_path = os.path.join(output_folder, zip_file_name)

        logger.info(f"Compressing SQL file to {zip_path}")
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(sql_path, arcname=os.path.basename(sql_path))

        # Remove the original SQL file after compression
        os.remove(sql_path)
        logger.info(f"Removed original SQL file after compression")

        logger.info(f"Successfully compressed database export to {zip_path}")
        return zip_path

    except subprocess.CalledProcessError as e:
        logger.error(f"Error executing pg_dump: {e}")
        raise
    except Exception as e:
        logger.error(f"Error exporting database: {e}")
        raise


def check_database_exists(db_params):
    """Check if the database exists and return True if it does, False otherwise"""
    # Connect to PostgreSQL server without specifying a database
    conn_params = db_params.copy()

    # Use 'postgres' as the default database to connect to
    conn_params['database'] = 'postgres'

    try:
        # Connect to the default database
        conn = psycopg2.connect(**conn_params)
        conn.autocommit = True  # Set autocommit to check database
        cur = conn.cursor()

        # Check if the database exists
        cur.execute(f"SELECT 1 FROM pg_database WHERE datname = '{db_params['database']}'")
        exists = cur.fetchone()

        # Close connection to default database
        cur.close()
        conn.close()

        return exists is not None

    except Exception as e:
        logger.error(f"Error checking if database exists: {e}")
        raise


def handle_existing_database(db_params):
    """Handle case where database already exists with user prompt"""
    print(f"\nDatabase '{db_params['database']}' already exists.")
    while True:
        choice = input("Do you want to:\n"
                       "1) Replace existing database\n"
                       "2) Export existing database only\n"
                       "3) Abort\n"
                       "Enter your choice (1-3): ")

        if choice == '1':
            logger.info(f"User chose to replace existing database '{db_params['database']}'")
            return "replace"
        elif choice == '2':
            logger.info(f"User chose to export existing database '{db_params['database']}' only")
            return "export_only"
        elif choice == '3':
            logger.info(f"User chose to abort")
            return "abort"
        else:
            print("Invalid choice. Please enter 1, 2, or 3.")


def main():
    # Database connection parameters
    db_params = {
        'host': os.getenv("PG_HOST"),  # Change to your database host
        'database': os.getenv("PG_DATABASE"),  # Change to your database name
        'user': os.getenv("PG_USER"),  # Change to your database username
        'password': os.getenv("PG_PASSWORD"),  # Change to your database password
        'port': int(os.getenv('PG_PORT', '5433')),
        'application_name': 'csv_importer'  # This helps identify the connection in PostgreSQL logs
    }

    # CSV folder path
    csv_folder = '../../processed_data/'  # Change to your CSV folder path

    # Export folder path
    export_folder = '../../pg_db/'  # Change to your export folder path

    # Performance settings
    optimize_for_import = True  # Set to True to temporarily improve import performance

    try:
        # Check if database exists
        db_exists = check_database_exists(db_params)

        action = None
        if db_exists:
            action = handle_existing_database(db_params)

            if action == "abort":
                logger.info("Process aborted by user.")
                return
            elif action == "export_only":
                # Connect to existing database for export
                conn = connect_to_postgres(db_params)

                # Export the existing database
                logger.info(f"Exporting existing database '{db_params['database']}'")
                export_database_to_sql(conn, export_folder, include_staging=True)
                export_database_to_sql(conn, export_folder, include_staging=False)

                conn.close()
                logger.info("Export completed successfully!")
                return

        # If we're here, either the DB doesn't exist or the user chose to replace it

        # Create database if it doesn't exist (or drop and recreate if replacing)
        if action == "replace":
            # Connect to default database to drop the existing one
            conn_params = db_params.copy()
            conn_params['database'] = 'postgres'
            conn = psycopg2.connect(**conn_params)
            conn.autocommit = True
            cur = conn.cursor()

            # Close any existing connections to the database
            cur.execute(f"""
                SELECT pg_terminate_backend(pg_stat_activity.pid)
                FROM pg_stat_activity
                WHERE pg_stat_activity.datname = '{db_params['database']}'
                AND pid <> pg_backend_pid()
            """)

            # Drop the database
            logger.info(f"Dropping existing database '{db_params['database']}'")
            cur.execute(f"DROP DATABASE IF EXISTS {db_params['database']}")

            cur.close()
            conn.close()

            # Now create the database
            create_database_if_not_exists(db_params)
        else:
            # Just create the database if it doesn't exist
            create_database_if_not_exists(db_params)

        # Connect to PostgreSQL
        conn = connect_to_postgres(db_params)

        # Rest of the existing code...
        # Apply performance optimizations if requested (only session-level settings)
        if optimize_for_import:
            with conn.cursor() as cur:
                logger.info("Applying session-level performance optimizations for import...")

                # Increase work_mem for better sort/join performance
                cur.execute("SET work_mem = '256MB'")  # Adjust based on your server's RAM

                # Increase maintenance_work_mem for faster index creation
                cur.execute("SET maintenance_work_mem = '512MB'")  # Adjust based on your server's RAM

                # Disable synchronous commit for faster inserts (note: small risk of data loss if server crashes)
                cur.execute("SET synchronous_commit = off")

                conn.commit()

        # Create tables
        create_tables(conn)

        # Load data into staging table from multiple CSV files
        load_csvs_to_staging(conn, csv_folder)

        # Populate dimension tables
        populate_dimension_tables(conn)

        # Populate fact table
        populate_fact_table(conn)

        # Restore default PostgreSQL settings if they were modified
        if optimize_for_import:
            with conn.cursor() as cur:
                logger.info("Restoring default PostgreSQL settings...")

                # Manual ANALYZE to update statistics for the tables we modified
                cur.execute("ANALYZE fact_seizures")
                cur.execute("ANALYZE dim_date")
                cur.execute("ANALYZE dim_global_location")
                cur.execute("ANALYZE dim_spez_location")
                cur.execute("ANALYZE dim_drug")
                cur.execute("ANALYZE dim_transportation")
                cur.execute("ANALYZE dim_source")

                # Reset session parameters to default
                cur.execute("RESET work_mem")
                cur.execute("RESET maintenance_work_mem")
                cur.execute("RESET synchronous_commit")

                conn.commit()

        # Verify import
        verify_import(conn)

        # Export the database with and without staging data
        export_database_to_sql(conn, export_folder, include_staging=True)
        export_database_to_sql(conn, export_folder, include_staging=False)

        # Close connection
        conn.close()
        logger.info("Database connection closed. Import process completed successfully!")

    except Exception as e:
        logger.error(f"Error in main process: {e}")


if __name__ == "__main__":
    main()
