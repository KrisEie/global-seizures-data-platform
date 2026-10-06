
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
WHERE t.transport_id = s.transport_id
MERGE (s)-[:TRANSPORTED_VIA]->(t);
        
