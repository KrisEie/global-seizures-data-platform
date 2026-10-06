import split_sheets, rename_cols_with_errors, formatting

# xlsx to csv -> takes form og_data -> split_data/
split_sheets.execute_split()

# some columns were wrongly named -> output in split_sheets/
rename_cols_with_errors.rename_specific_csv_columns()

# reorder cols & replace Data not available -> NA  -> creates data in processed_data/
formatting.format_data()
