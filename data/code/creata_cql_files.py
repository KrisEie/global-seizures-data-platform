import math

import pandas as pd
import os

mapper = {
    "dim_date.csv": "Date",
    "dim_drug.csv": "Drug",
    "dim_global_location.csv": "Global_Location",
    "dim_source.csv": "Source",
    "dim_spez_location.csv": "Spez_Location",
    "dim_transportation.csv": "Transportation",
    "fact_seizures.csv": "Seizures",
}

def csv_to_cypher(csv_folder, output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    files = [f for f in os.listdir(csv_folder) if f.endswith(".csv")]

    index_file = os.path.join(output_dir, "make_index.cql")
    print(index_file)
    with open(index_file, "w") as cql_file:
        cql_file.write("""
CREATE INDEX FOR (d:Date) ON (d.date_id);
CREATE INDEX FOR (dr:Drug) ON (dr.drug_id);
CREATE INDEX FOR (g:Global_Location) ON (g.global_location_id);
CREATE INDEX FOR (src:Source) ON (src.source_id);
CREATE INDEX FOR (sp:Spez_Location) ON (sp.spez_location_id);
CREATE INDEX FOR (t:Transportation) ON (t.transport_id);

CREATE INDEX FOR (s:Seizures) ON (s.seizure_id);
CREATE INDEX FOR (s:Seizures) ON (s.date_id);
CREATE INDEX FOR (s:Seizures) ON (s.drug_id);
CREATE INDEX FOR (s:Seizures) ON (s.global_location_id);
CREATE INDEX FOR (s:Seizures) ON (s.source_id);
CREATE INDEX FOR (s:Seizures) ON (s.spez_location_id);

""")

    for file in files:
        file_path = os.path.join(csv_folder, file)
        base_filename = file[:-4]

        idx = 0
        for df_chunk in pd.read_csv(file_path, encoding="utf-8", chunksize=100_000):
            if 'spez_location' in file:
                df_chunk = df_chunk[df_chunk['administrative_region'] != 'Владимирская Область']
            filename = os.path.join(output_dir, f"{base_filename}_{idx}.cql")
            print(filename)
            with (open(filename, "w") as cql_file):
                for _, row in df_chunk.iterrows():
                    node_label = file[:-4]
                    node_name = mapper.get(file)
                    properties = []
                    for header, value in row.items():
                        if isinstance(value, int):
                            properties.append(f"\t{header}: toInteger({value})")
                        elif isinstance(value, float):
                            if not math.isnan(value):
                                properties.append(f"\t{header}: toFloat({value})")
                        else:


                            properties.append(f"\t{header}: '{value.encode('utf-8').decode('utf-8')}'")
                    cql_file.write(f"CREATE ({node_label}:{node_name} {{\n" + ",\n".join(properties) + "\n});\n")
            idx = idx + 1
        print(f"Finished: {file_path}")
    index_file = os.path.join(output_dir, "set_relations.cql")
    with open(index_file, "w") as cql_file:
        cql_file.write("""
MATCH (d:Date), (s:Seizures)
WHERE d.date_id = s.date_id
MERGE (s)-[:OCCURRED_ON]->(d);

MATCH (dr:Drug), (s:Seizures)
WHERE dr.drug_id = s.drug_id
MERGE (s)-[:INVOLVES_DRUG]->(dr);

MATCH (g:Global_Location), (s:Seizures)
WHERE g.global_location_id = s.global_location_id
MERGE (s)-[:HAPPENED_IN]->(g);

MATCH (src:Source), (s:Seizures)
WHERE src.source_id = s.source_id
MERGE (s)-[:REPORTED_BY]->(src);

MATCH (sp:Spez_Location), (s:Seizures)
WHERE sp.spez_location_id = s.spez_location_id
MERGE (s)-[:SPECIFIC_LOCATION]->(sp);

MATCH (t:Transportation), (s:Seizures)
WHERE t.transport_id = s.seizure_id
MERGE (s)-[:TRANSPORTED_VIA]->(t);
        """)

    print(f"Cypher queries saved to {index_file}")

# Usage example
csv_to_cypher("../pg_db", "../neo4j_db")
