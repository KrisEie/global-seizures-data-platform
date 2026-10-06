import os
import pandas as pd
from openpyxl import load_workbook


def split_xlsx_to_csv(input_folder, output_folder=None):
    """
    Split all Excel files in input_folder into separate CSV files for each sheet.

    Args:
        input_folder (str): Path to folder containing Excel files
        output_folder (str, optional): Path to output folder.
                                      If None, will create a subfolder named 'csv_output'
    """
    # If no output folder specified, create a subfolder
    if output_folder is None:
        output_folder = os.path.join(input_folder, 'csv_output')

    # Create output folder if it doesn't exist
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)

    # Process all xlsx files in the input folder
    for filename in os.listdir(input_folder):
        if filename.endswith('.xlsx'):
            file_path = os.path.join(input_folder, filename)
            file_name_without_ext = os.path.splitext(filename)[0]

            print(f"Processing file: {filename}")

            # Load the workbook to get sheet names
            workbook = load_workbook(file_path, read_only=True)

            # Process each sheet
            for sheet_name in workbook.sheetnames:
                print(f"  Converting sheet: {sheet_name} to CSV")

                # Create output CSV filename
                # Replace any invalid characters in the sheet name for filenames
                safe_sheet_name = sheet_name.replace('/', '_').replace('\\', '_').replace('?', '_').replace('*', '_').replace(':', '_').replace('"',
                                                                                                                                                '_').replace(
                    '<', '_').replace('>', '_').replace('|', '_')
                output_file = os.path.join(
                    output_folder,
                    f"{file_name_without_ext}_{safe_sheet_name}.csv"
                )

                # Read the specific sheet
                df = pd.read_excel(file_path, sheet_name=sheet_name)

                # Write to CSV
                df.to_csv(output_file, index=False)

            # Close the workbook
            workbook.close()
            print(f"Completed processing {filename}")


def execute_split():
    # Get the folder path from user
    input_folder = "../og_data/"

    # Optional: specify output folder
    output_option = "../split_sheets/"
    output_folder = output_option if output_option.strip() else None

    # Run the function
    split_xlsx_to_csv(input_folder, output_folder)

    print("All Excel files have been processed!")

if __name__ == "__main__":
   execute_split()
