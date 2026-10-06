import os
from pathlib import Path
from urllib.parse import quote
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")
import pandas as pd
from pymongo import MongoClient


# MongoDB connection
def connect_to_mongodb():
    uri = os.getenv('MONGODB_URI')
    if not uri:
        username = quote(os.environ['MONGODB_USER'], safe='')
        password = quote(os.environ['MONGODB_PASSWORD'], safe='')
        host = os.getenv('MONGODB_HOST', '127.0.0.1')
        port = os.getenv('MONGODB_PORT', '27017')
        auth_source = quote(os.getenv('MONGODB_AUTH_SOURCE', 'admin'), safe='')
        uri = f'mongodb://{username}:{password}@{host}:{port}/?authSource={auth_source}'
    client = MongoClient(uri)
    db = client[os.getenv('MONGODB_DB', 'drug_seizures_db')]
    return db, client


# Import CSV files to MongoDB
def import_csv_to_mongodb():
    db, client = connect_to_mongodb()

    # Path to CSV files
    csv_dir = '../split_sheets'

    # Get all CSV files
    csv_files = [f for f in os.listdir(csv_dir) if f.endswith('.csv')]

    # Process each CSV file
    for csv_file in csv_files:
        # Skip drug list files
        if "Drug list and Measurement Units" in csv_file:
            print(f"Skipping {csv_file}")
            continue

        print(f"Processing {csv_file}...")

        # Extract year from filename
        year = None
        if "_20" in csv_file:
            year = csv_file.split("_")[-1].split(".")[0]

        # Read CSV file
        file_path = os.path.join(csv_dir, csv_file)
        df = pd.read_csv(file_path, encoding='utf-8')

        # Convert DataFrame to dictionary
        records = df.to_dict('records')

        # Add year as a field if available
        if year:
            for record in records:
                record['year'] = year

        # Insert into MongoDB
        collection_name = 'seizures'
        db[collection_name].insert_many(records)

        print(f"Imported {len(records)} records from {csv_file}")

    # Create dimension collections
    create_dimension_collections(db)

    # Close connection
    client.close()
    print("Import completed!")


# Create dimension collections
def create_dimension_collections(db):
    # Create date dimension
    print("Creating date dimension...")
    db.command({
        'aggregate': 'seizures',
        'pipeline': [
            {'$group': {
                '_id': {
                    'year': '$year',
                    'month': '$Month',
                    'day': '$Day'
                }
            }},
            {'$project': {
                '_id': 0,
                'year': '$_id.year',
                'month': '$_id.month',
                'day': '$_id.day'
            }},
            {'$out': 'dim_date'}
        ],
        'cursor': {}
    })

    # Create drug dimension
    print("Creating drug dimension...")
    db.command({
        'aggregate': 'seizures',
        'pipeline': [
            {'$group': {
                '_id': '$Drug'
            }},
            {'$project': {
                '_id': 0,
                'drug_name': '$_id'
            }},
            {'$out': 'dim_drug'}
        ],
        'cursor': {}
    })

    # Create location dimension
    print("Creating location dimension...")
    db.command({
        'aggregate': 'seizures',
        'pipeline': [
            {'$group': {
                '_id': {
                    'country': '$Country',
                    'region': '$Region',
                    'city': '$City'
                }
            }},
            {'$project': {
                '_id': 0,
                'country': '$_id.country',
                'region': '$_id.region',
                'city': '$_id.city'
            }},
            {'$out': 'dim_location'}
        ],
        'cursor': {}
    })


if __name__ == "__main__":
    import_csv_to_mongodb()
