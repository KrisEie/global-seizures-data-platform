import os
import pandas as pd


def rename_specific_csv_columns():
    """
    Find specific CSV files in a folder and apply new column names to them,
    overwriting the original files.

    Parameters:
    - folder_path: Path to the folder containing CSV files
    - target_files: List of specific file names to process
    - new_column_names: List of new column names to apply to the files
    """

    # Define the folder path, target files, and column names
    folder_path = "../split_sheets/"  # Replace with your actual folder path

    # The specific files you're looking for
    target_files = [
        "IDS-data-2018_23-Feb25_0_2023.csv",
        "IDS-data-2024-Feb25_0_2024.csv"
    ]

    # The new column names to apply
    new_column_names = [
        "Seizure Date",
        "Country/Territory of Seizure",
        "ISO3",
        "Region",
        "Subregion",
        "City",
        "Administrative Region",
        "Drug/Substance",
        "Measurement Unit",
        "Quantity Seized",
        "Physical Seizure Location",
        "Trafficking Mode of Transportation",
        "Source",
        "Reporting Channel"
    ]
    # List all CSV files in the folder
    csv_files = [f for f in os.listdir(folder_path) if f.endswith('.csv')]

    for file_name in csv_files:
        # Check if this is one of our target files
        if file_name in target_files:
            file_path = os.path.join(folder_path, file_name)
            print(f"Processing {file_name}...")

            # Read the CSV file
            df = pd.read_csv(file_path)

            # Check if the number of columns match
            if len(df.columns) != len(new_column_names):
                print(f"  Warning: {file_name} has {len(df.columns)} columns but {len(new_column_names)} names provided.")
                print(f"  Columns in file: {list(df.columns)}")
                print(f"  New names provided: {new_column_names}")
                continue

            # Assign new column names
            df.columns = new_column_names

            # Save the updated DataFrame back to the same file (overwriting)
            df.to_csv(file_path, index=False)

            print(f"Renamed columns and overwrote {file_path}")


# Run the function
if __name__ == "__main__":
    rename_specific_csv_columns()
