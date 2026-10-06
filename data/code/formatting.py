def format_data():
    import os
    import pandas as pd

    # Update the expected column order to match your actual data
    expected_columns = [
        'Seizure Date', 'Country/Territory of Seizure', 'ISO3', 'Region',
        'Subregion', 'City', 'Administrative Region', 'Drug/Substance',
        'Measurement Unit', 'Quantity Seized', 'Physical Seizure Location',
        'Trafficking Mode of Transportation', 'Source', 'Reporting Channel'
    ]

    # Create output directory if it doesn't exist
    output_dir = '../processed_data/'
    if not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    # Find all CSV files in the split_sheets directory
    csv_files = "../split_sheets/"

    # Keep track of total rows removed
    total_rows_removed = 0

    for file_path in os.listdir(csv_files):
        try:
            print(f"Processing {file_path}...")
            if "Drug" in file_path:
                print("Skipping!")
                continue

            # Read the CSV file
            df = pd.read_csv(csv_files + file_path)

            # Check if all expected columns exist in the dataframe
            missing_columns = [col for col in expected_columns if col not in df.columns]
            if missing_columns:
                print(f"Warning: Missing columns in {file_path}: {missing_columns}")
                # You can choose to skip or continue processing these files
                continue

            # Only reorder if all columns exist and are in a different order
            if set(df.columns) == set(expected_columns) and list(df.columns) != expected_columns:
                df = df[expected_columns]

            # Replace "Data not available" with "NA" in specified columns
            for col in ['Physical Seizure Location', 'Trafficking Mode of Transportation', 'Administrative Region', "City"]:
                if col in df.columns:  # Check if column exists before processing
                    df[col] = df[col].replace('', 'NA')
                    df[col] = df[col].fillna('NA')
                    df[col] = df[col].replace('nan', 'NA')
                    df[col] = df[col].replace('Data not available', 'NA')

            # Clean up various text columns - adding checks to ensure columns exist
            text_columns = ['City', 'Drug/Substance', 'Physical Seizure Location',
                            'Administrative Region', 'Country/Territory of Seizure', "Trafficking Mode of Transportation"]

            for col in text_columns:
                if col in df.columns:
                    # First convert to string
                    df[col] = df[col].astype(str)

                    # Remove commas, quotes, apostrophes, and replace newlines with spaces
                    df[col] = df[col].str.replace(',', '', regex=False) \
                        .str.replace('"', '', regex=False) \
                        .str.replace("'", '', regex=False) \
                        .str.replace("\n", ' ', regex=False) \
                        .str.replace("\r", ' ', regex=False) \
                        .str.strip()

                    # Replace empty values with NA
                    df[col] = df[col].replace('', 'NA')

            # Remove rows where Administrative Region is 'Владимирская Область'
            if 'Administrative Region' in df.columns:
                # Count rows to be removed
                rows_to_remove = df[df['Administrative Region'] == 'Владимирская Область'].shape[0]
                if rows_to_remove > 0:
                    print(f"Removing {rows_to_remove} rows with Administrative Region = 'Владимирская Область' from {file_path}")
                    total_rows_removed += rows_to_remove

                    # Remove the rows
                    df = df[df['Administrative Region'] != 'Владимирская Область']

            # Save to output directory
            output_path = os.path.join(output_dir, os.path.basename(file_path))
            try:
                # Save without quoting to avoid double quotes
                df.to_csv(output_path, index=False, quoting=0)  # QUOTE_MINIMAL
                print(f"Saved processed file to {output_path}")
            except Exception as save_error:
                print(f"Error saving to {output_path}: {str(save_error)}")
                print(f"Directory exists check: {os.path.exists(output_dir)}")
                # Try to create directory again just to be sure
                os.makedirs(output_dir, exist_ok=True)
                # Try saving again
                df.to_csv(output_path, index=False, quoting=0)  # QUOTE_MINIMAL

        except Exception as e:
            print(f"Error processing {file_path}: {str(e)}")

    # Print the total number of rows removed across all files
    print(f"Total rows removed: {total_rows_removed}")
    print("All files processed!")